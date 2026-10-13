import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const file = () => path.join(config.dataDir, 'channels.json');

export function loadChannels() {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    return [];
  }
}

export function saveChannels(channels) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(channels, null, 2));
  fs.renameSync(tmp, file());
}
