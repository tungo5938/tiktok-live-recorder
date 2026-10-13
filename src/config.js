import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT || 3000),
  // How often each channel is checked for live status (seconds)
  checkIntervalSec: Number(process.env.CHECK_INTERVAL_SEC || 60),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(root, 'data')),
  recordingsDir: path.resolve(process.env.RECORDINGS_DIR || path.join(root, 'recordings')),
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // Optional TikTok cookie (sessionid=...) for age-restricted / region-locked lives
  cookie: process.env.TIKTOK_COOKIE || '',
  // origin | uhd | hd | sd | ld  (falls back to the best available)
  quality: process.env.QUALITY || 'origin',
  // Convert .ts to .mp4 after a live ends
  remuxToMp4: process.env.REMUX_TO_MP4 !== 'false',
  publicDir: path.join(root, 'public'),
};
