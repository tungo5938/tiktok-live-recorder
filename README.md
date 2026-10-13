# TikTok Live Auto Recorder

Nhập kênh TikTok → hệ thống tự theo dõi và **tự động record livestream** ngay khi kênh bắt đầu live. Hết live tự lưu file `.mp4`.

- Giao diện web: thêm / tạm dừng / xoá kênh, xem trạng thái LIVE & đang record, xem và tải video.
- Không re-encode (ffmpeg stream copy) → nhẹ CPU, giữ nguyên chất lượng.
- Ghi ra `.ts` trong lúc live (an toàn nếu mất điện / crash), hết live tự chuyển sang `.mp4`.
- Gọi thẳng API công khai của TikTok, **không cần API key trả phí**.
- Không có dependency npm, chỉ cần Node.js ≥ 18 và ffmpeg.

## Chạy

```bash
brew install ffmpeg        # macOS (Ubuntu: sudo apt install ffmpeg)
npm start
```

Mở http://localhost:3000, nhập `username`, `@username` hoặc link `https://www.tiktok.com/@username`.

Video lưu ở `recordings/<username>/<username>_<YYYYMMDD_HHMMSS>.mp4`.

### Docker

```bash
docker compose up -d
```

### Kiểm tra nhanh 1 kênh

```bash
node src/cli.js check <username>
```

## Cấu hình (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng web |
| `CHECK_INTERVAL_SEC` | `60` | Bao lâu kiểm tra live 1 lần |
| `QUALITY` | `origin` | `origin` / `uhd` / `hd` / `sd` / `ld` (không có thì lấy mức tốt nhất còn lại) |
| `TIKTOK_COOKIE` | | Cookie TikTok (`sessionid=...`) cho live giới hạn tuổi / khu vực |
| `RECORDINGS_DIR` | `./recordings` | Thư mục lưu video |
| `DATA_DIR` | `./data` | Lưu danh sách kênh |
| `FFMPEG_PATH` | `ffmpeg` | Đường dẫn ffmpeg |
| `REMUX_TO_MP4` | `true` | Đặt `false` để giữ file `.ts` |

## Cách hoạt động

1. Mỗi `CHECK_INTERVAL_SEC` giây, gọi `tiktok.com/api-live/user/room` cho từng kênh → biết kênh có live không (`status = 2`) và lấy link stream FLV/HLS.
2. Khi live: chạy `ffmpeg -c copy` kéo stream từ CDN TikTok về đĩa.
3. Stream kết thúc → ffmpeg thoát → remux sang `.mp4` → 5 giây sau kiểm tra lại (nếu stream chỉ bị rớt mà kênh vẫn live thì record tiếp sang file mới).
4. Bấm **Dừng record** thủ công: bỏ qua phiên live hiện tại, phiên live sau vẫn tự record. Muốn record lại ngay phiên đó thì bấm **Record tiếp**.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/channels` | Danh sách kênh + trạng thái |
| POST | `/api/channels` | `{ "username": "..." }` thêm kênh |
| PATCH | `/api/channels/:u` | `{ "enabled": false }` tạm dừng / bật |
| DELETE | `/api/channels/:u` | Bỏ theo dõi |
| POST | `/api/channels/:u/check` | Kiểm tra ngay |
| POST | `/api/channels/:u/stop` | Dừng record phiên hiện tại |
| POST | `/api/channels/:u/resume` | Record tiếp phiên live đã bấm dừng |
| GET | `/api/recordings` | Danh sách video |
| DELETE | `/api/recordings?path=user/file.mp4` | Xoá video |
| GET | `/files/:user/:file` | Xem / tải (`?download`) |

Tham khảo: [livevods.com](https://livevods.com/tiktok-live-recorder), [tiktool/tiktok-live-recorder](https://github.com/tiktool/tiktok-live-recorder).
