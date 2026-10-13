import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from './config.js';
import { Watcher } from './watcher.js';

const ffmpegOk = spawnSync(config.ffmpegPath, ['-version']).status === 0;
if (!ffmpegOk) {
  console.error(`Không tìm thấy ffmpeg ("${config.ffmpegPath}"). Cài ffmpeg trước: brew install ffmpeg / apt install ffmpeg`);
  process.exit(1);
}

fs.mkdirSync(config.recordingsDir, { recursive: true });
const watcher = new Watcher();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => (b += d).length > 1e5 && req.destroy());
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
    });
  });
}

function listRecordings() {
  const out = [];
  if (!fs.existsSync(config.recordingsDir)) return out;
  for (const user of fs.readdirSync(config.recordingsDir)) {
    const dir = path.join(config.recordingsDir, user);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.(mp4|ts|flv)$/.test(name)) continue;
      const st = fs.statSync(path.join(dir, name));
      out.push({ username: user, name, path: `${user}/${name}`, bytes: st.size, mtime: st.mtimeMs });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Resolve a recordings-relative path, refusing anything that escapes the folder
function safeRecordingPath(rel) {
  const p = path.resolve(config.recordingsDir, rel);
  return p.startsWith(config.recordingsDir + path.sep) ? p : null;
}

function serveFile(req, res, file, download) {
  const st = fs.statSync(file);
  if (!st.isFile()) return send(res, 404, 'Not found', 'text/plain');
  const type = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.ts') ? 'video/mp2t' : 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : st.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === 'api') {
      if (parts[1] === 'channels' && parts.length === 2) {
        if (req.method === 'GET') return send(res, 200, watcher.list());
        if (req.method === 'POST') {
          const { username } = await readBody(req);
          return send(res, 201, watcher.add(username));
        }
      }
      if (parts[1] === 'channels' && parts[2]) {
        const u = parts[2];
        if (!watcher.channels.has(u)) return send(res, 404, { error: 'not_found' });
        if (req.method === 'DELETE') { watcher.remove(u); return send(res, 200, { ok: true }); }
        if (req.method === 'PATCH') {
          const { enabled } = await readBody(req);
          return send(res, 200, watcher.setEnabled(u, !!enabled));
        }
        if (req.method === 'POST' && parts[3] === 'check') { await watcher.check(u); return send(res, 200, watcher.channels.get(u)); }
        if (req.method === 'POST' && parts[3] === 'resume') { await watcher.resume(u); return send(res, 200, watcher.channels.get(u)); }
        if (req.method === 'POST' && parts[3] === 'stop') { watcher.stopRecording(u); return send(res, 200, { ok: true }); }
      }
      if (parts[1] === 'recordings' && req.method === 'GET') return send(res, 200, listRecordings());
      if (parts[1] === 'recordings' && req.method === 'DELETE') {
        const p = safeRecordingPath(url.searchParams.get('path') || '');
        if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) return send(res, 404, { error: 'not_found' });
        if ([...watcher.recordings.values()].some((r) => r.tsFile === p)) return send(res, 409, { error: 'Đang ghi file này' });
        fs.unlinkSync(p);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'not_found' });
    }

    if (parts[0] === 'files') {
      const p = safeRecordingPath(parts.slice(1).join('/'));
      if (!p || !fs.existsSync(p)) return send(res, 404, 'Not found', 'text/plain');
      return serveFile(req, res, p, url.searchParams.has('download'));
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return send(res, 200, fs.readFileSync(path.join(config.publicDir, 'index.html')), 'text/html; charset=utf-8');
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    send(res, e.code === 'invalid_username' ? 400 : 500, { error: e.message });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Cổng ${config.port} đang bị dùng (có thể tool đã chạy sẵn). Mở http://localhost:${config.port} hoặc chạy cổng khác: PORT=3001 npm start`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

server.listen(config.port, () => {
  console.log(`TikTok Live Recorder: http://localhost:${config.port}`);
  console.log(`Thư mục lưu video: ${config.recordingsDir}`);
  watcher.start();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('\nĐang dừng, chờ hoàn tất các file đang ghi...');
    server.close();
    await watcher.shutdown();
    process.exit(0);
  });
}
