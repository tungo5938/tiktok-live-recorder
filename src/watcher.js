import { EventEmitter } from 'node:events';
import { config } from './config.js';
import { getLiveInfo, normalizeUsername } from './tiktok.js';
import { Recording } from './recorder.js';
import { loadChannels, saveChannels } from './store.js';

const log = (...a) => console.log(new Date().toISOString(), ...a);

/**
 * Keeps the list of watched channels, polls each one and starts/stops recordings.
 */
export class Watcher extends EventEmitter {
  constructor() {
    super();
    // username -> { username, enabled, addedAt, nickname, avatar, lastCheck, live, error, lastRecording }
    this.channels = new Map(loadChannels().map((c) => [c.username, c]));
    this.recordings = new Map(); // username -> Recording
    this.checking = new Set();
    this.timer = null;
  }

  start() {
    log(`Watcher started: ${this.channels.size} kênh, kiểm tra mỗi ${config.checkIntervalSec}s`);
    this.checkAll();
    this.timer = setInterval(() => this.checkAll(), config.checkIntervalSec * 1000);
  }

  async shutdown() {
    clearInterval(this.timer);
    const ends = [...this.recordings.values()].map((r) => new Promise((res) => { r.once('end', res); r.stop(); }));
    await Promise.race([Promise.all(ends), new Promise((r) => setTimeout(r, 30000))]);
  }

  persist() {
    saveChannels([...this.channels.values()]);
  }

  list() {
    return [...this.channels.values()].map((c) => {
      const rec = this.recordings.get(c.username);
      return {
        ...c,
        recording: rec
          ? { file: rec.tsFile, startedAt: rec.startedAt, durationSec: rec.durationSec, bytes: rec.bytes }
          : null,
      };
    });
  }

  add(input) {
    const username = normalizeUsername(input);
    if (!this.channels.has(username)) {
      this.channels.set(username, { username, enabled: true, addedAt: Date.now(), live: false });
      this.persist();
      log(`+ @${username}`);
    }
    this.check(username);
    return this.channels.get(username);
  }

  remove(username) {
    this.recordings.get(username)?.stop();
    this.channels.delete(username);
    this.persist();
    log(`- @${username}`);
  }

  setEnabled(username, enabled) {
    const c = this.channels.get(username);
    if (!c) return null;
    c.enabled = enabled;
    if (!enabled) this.recordings.get(username)?.stop();
    this.persist();
    if (enabled) this.check(username);
    return c;
  }

  /** Manual stop: don't auto-restart for the same live session (room). */
  stopRecording(username) {
    const rec = this.recordings.get(username);
    if (!rec) return;
    const c = this.channels.get(username);
    if (c) c.skipRoomId = rec.info.roomId;
    rec.stop();
  }

  /** Undo a manual stop: allow recording the current live session again. */
  resume(username) {
    const c = this.channels.get(username);
    if (!c) return null;
    c.skipRoomId = null;
    return this.check(username);
  }

  async checkAll() {
    for (const c of this.channels.values()) {
      if (!c.enabled) continue;
      await this.check(c.username);
      await new Promise((r) => setTimeout(r, 1500)); // be gentle with TikTok
    }
  }

  async check(username) {
    const c = this.channels.get(username);
    if (!c || !c.enabled || this.checking.has(username)) return;
    this.checking.add(username);
    try {
      const info = await getLiveInfo(username);
      Object.assign(c, {
        nickname: info.nickname,
        avatar: info.avatar,
        live: info.live,
        title: info.title,
        viewers: info.viewers,
        lastCheck: Date.now(),
        error: null,
      });
      if (c.skipRoomId && c.skipRoomId !== info.roomId) c.skipRoomId = null; // new live session
      if (info.live && !this.recordings.has(username) && c.skipRoomId !== info.roomId) {
        if (info.stream) this.startRecording(c, info);
        else c.error = 'Đang live nhưng không lấy được link stream (có thể cần TIKTOK_COOKIE)';
      }
    } catch (e) {
      Object.assign(c, { lastCheck: Date.now(), error: e.message });
    } finally {
      this.checking.delete(username);
      this.persist();
      this.emit('change');
    }
  }

  startRecording(c, info) {
    const rec = new Recording(c.username, info).start();
    this.recordings.set(c.username, rec);
    log(`● REC @${c.username} (${info.stream.quality}) -> ${rec.tsFile}`);
    rec.once('end', ({ file, durationSec, error }) => {
      this.recordings.delete(c.username);
      c.lastRecording = { file, durationSec, endedAt: Date.now(), error: error || null };
      log(`■ STOP @${c.username} ${durationSec}s ${file || ''} ${error ? `(${error})` : ''}`);
      this.persist();
      this.emit('change');
      // The stream may have dropped while the creator is still live -> re-check soon
      if (this.channels.has(c.username)) setTimeout(() => this.check(c.username), 5000);
    });
  }
}
