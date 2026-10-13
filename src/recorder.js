import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from './config.js';

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    p.on('close', (code) => resolve({ code, err }));
    p.on('error', (e) => resolve({ code: -1, err: e.message }));
  });
}

/**
 * Records one live session with ffmpeg (stream copy, no re-encode).
 * Writes to .ts while recording (survives crashes), then remuxes to .mp4.
 * Emits: 'end' ({ file, durationSec, error })
 */
export class Recording extends EventEmitter {
  constructor(username, info) {
    super();
    this.username = username;
    this.info = info;
    this.startedAt = Date.now();
    const dir = path.join(config.recordingsDir, username);
    fs.mkdirSync(dir, { recursive: true });
    this.basePath = path.join(dir, `${username}_${stamp()}`);
    this.tsFile = `${this.basePath}.ts`;
    this.proc = null;
    this.stopping = false;
  }

  start() {
    const url = this.info.stream.flv || this.info.stream.hls;
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '10',
      '-rw_timeout', '15000000',
      '-user_agent', 'Mozilla/5.0',
      '-headers', 'Referer: https://www.tiktok.com/\r\n',
      '-i', url,
      '-map', '0', '-c', 'copy',
      '-f', 'mpegts', this.tsFile,
    ];
    this.proc = spawn(config.ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errTail = '';
    this.proc.stderr.on('data', (d) => (errTail = (errTail + d).slice(-2000)));
    this.proc.on('error', (e) => this.#finish(`Không chạy được ffmpeg: ${e.message}`));
    this.proc.on('close', (code) => this.#finish(code === 0 || this.stopping ? null : errTail.trim() || `ffmpeg exit ${code}`));
    return this;
  }

  get durationSec() {
    return Math.round((Date.now() - this.startedAt) / 1000);
  }

  get bytes() {
    try {
      return fs.statSync(this.tsFile).size;
    } catch {
      return 0;
    }
  }

  stop() {
    if (!this.proc || this.stopping) return;
    this.stopping = true;
    // 'q' makes ffmpeg finalize cleanly; SIGINT as fallback
    try { this.proc.stdin.write('q'); } catch {}
    setTimeout(() => { try { this.proc.kill('SIGINT'); } catch {} }, 3000);
    setTimeout(() => { try { this.proc.kill('SIGKILL'); } catch {} }, 10000);
  }

  async #finish(error) {
    if (this.finished) return;
    this.finished = true;
    const durationSec = this.durationSec;
    let file = this.tsFile;

    if (this.bytes === 0) {
      try { fs.unlinkSync(this.tsFile); } catch {}
      this.emit('end', { file: null, durationSec, error: error || 'Không nhận được dữ liệu' });
      return;
    }

    if (config.remuxToMp4) {
      const mp4 = `${this.basePath}.mp4`;
      const r = await run(config.ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', this.tsFile,
        '-map', '0', '-c', 'copy', '-movflags', '+faststart', mp4,
      ]);
      if (r.code === 0) {
        fs.unlinkSync(this.tsFile);
        file = mp4;
      }
    }
    this.emit('end', { file, durationSec, error });
  }
}
