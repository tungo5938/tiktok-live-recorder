import { config } from './config.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const QUALITY_ORDER = ['origin', 'uhd', 'hd', 'sd', 'ld', 'ao'];

export class TikTokError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Accepts "user", "@user" or a full TikTok URL and returns the bare username. */
export function normalizeUsername(input) {
  let s = String(input || '').trim();
  const m = s.match(/tiktok\.com\/@([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{2,24}$/.test(s)) throw new TikTokError('invalid_username', `Username không hợp lệ: ${input}`);
  return s.toLowerCase();
}

function headers() {
  const h = { 'User-Agent': UA, Referer: 'https://www.tiktok.com/', Accept: 'application/json' };
  if (config.cookie) h.Cookie = config.cookie;
  return h;
}

async function getJson(url) {
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new TikTokError('http_error', `HTTP ${res.status} khi gọi ${new URL(url).pathname}`);
  return res.json();
}

function pickStream(streamDataStr) {
  if (!streamDataStr) return null;
  let parsed;
  try {
    parsed = typeof streamDataStr === 'string' ? JSON.parse(streamDataStr) : streamDataStr;
  } catch {
    return null;
  }
  const data = parsed?.data || {};
  const order = [config.quality, ...QUALITY_ORDER.filter((q) => q !== config.quality)];
  for (const q of order) {
    const main = data[q]?.main;
    if (main?.flv || main?.hls) return { quality: q, flv: main.flv || null, hls: main.hls || null };
  }
  return null;
}

/**
 * Returns live info for a username.
 * status: 2 = live, 4 = offline (TikTok room status codes).
 */
export async function getLiveInfo(username) {
  const url = `https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId=${encodeURIComponent(username)}`;
  const json = await getJson(url);
  if (json.message === 'user_not_found') throw new TikTokError('user_not_found', `Không tìm thấy kênh @${username}`);
  if (!json.data) throw new TikTokError('bad_response', json.message || 'TikTok trả về dữ liệu rỗng');

  const { user = {}, liveRoom = {} } = json.data;
  const live = liveRoom.status === 2;
  let stream = live ? pickStream(liveRoom.streamData?.pull_data?.stream_data) : null;

  // Fallback: webcast room/info has flv_pull_url when the page payload lacks stream data
  if (live && !stream && user.roomId) {
    stream = await getStreamFromRoomInfo(user.roomId).catch(() => null);
  }

  return {
    username,
    nickname: user.nickname || username,
    avatar: user.avatarThumb || '',
    roomId: user.roomId || null,
    live,
    title: liveRoom.title || '',
    startTime: liveRoom.startTime || null,
    viewers: liveRoom.liveRoomStats?.userCount ?? null,
    stream,
  };
}

async function getStreamFromRoomInfo(roomId) {
  const json = await getJson(`https://webcast.tiktok.com/webcast/room/info/?aid=1988&room_id=${roomId}`);
  const su = json?.data?.stream_url;
  if (!su) return null;
  const fromData = pickStream(su.live_core_sdk_data?.pull_data?.stream_data);
  if (fromData) return fromData;
  const flvs = su.flv_pull_url || {};
  const flv = flvs.FULL_HD1 || flvs.HD1 || flvs.SD1 || flvs.SD2 || null;
  const hls = su.hls_pull_url || null;
  return flv || hls ? { quality: 'auto', flv, hls } : null;
}
