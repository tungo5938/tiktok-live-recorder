# Hướng dẫn sử dụng TikTok Live Auto Recorder

Tool theo dõi các kênh TikTok và **tự động record livestream** ngay khi kênh bắt đầu live. Hết live, video được lưu thành file `.mp4` trên máy.

---

## 1. Cài đặt

Cần 2 thứ: **Node.js** (bản 18 trở lên) và **ffmpeg**.

### macOS

```bash
# Chưa có Homebrew thì cài trước: https://brew.sh
brew install node ffmpeg git
```

### Windows

1. Cài Node.js bản **LTS** tại https://nodejs.org
2. Mở **PowerShell** và chạy:
   ```bash
   winget install Gyan.FFmpeg
   winget install Git.Git
   ```
3. **Đóng PowerShell, mở cửa sổ mới** để máy nhận ffmpeg.

### Kiểm tra đã cài đủ

```bash
node -v
ffmpeg -version
```

Cả hai lệnh đều in ra phiên bản là được.

---

## 2. Tải code về

```bash
git clone https://github.com/tungo5938/tiktok-live-recorder.git
cd tiktok-live-recorder
```

> Repo đang để **private**. Máy mới cần đăng nhập GitHub trước (`gh auth login`, hoặc nhập tài khoản khi `git clone` hỏi).
> Không dùng git được thì tải file ZIP: trên trang repo bấm **Code → Download ZIP**, rồi giải nén.

Không cần chạy `npm install`, vì tool không dùng thư viện ngoài.

---

## 3. Chạy tool

```bash
npm start
```

Thấy dòng sau là tool đã chạy:

```
TikTok Live Recorder: http://localhost:3000
```

Mở trình duyệt vào **http://localhost:3000**.

> **Cửa sổ terminal phải để mở** thì tool mới chạy. Tắt terminal, gập máy hay máy ngủ là tool ngừng theo dõi.

### Tắt tool

Bấm **Ctrl + C** trong cửa sổ terminal đang chạy. Nếu đang record, tool sẽ đợi lưu xong file rồi mới thoát.

---

## 4. Sử dụng

### Thêm kênh

Nhập vào ô trên cùng một trong các dạng sau rồi bấm **Theo dõi**:

- `libra.v13`
- `@libra.v13`
- `https://www.tiktok.com/@libra.v13`
- `https://www.tiktok.com/@libra.v13/live`

Từ đó, mỗi khi kênh live, tool tự record. Bạn không cần làm gì thêm.

### Trạng thái kênh

| Nhãn | Ý nghĩa |
|---|---|
| `offline` | Kênh không live, tool vẫn đang theo dõi |
| `LIVE` | Kênh đang live |
| `● ĐANG RECORD` | Đang ghi video (hiện thời lượng, dung lượng, số người xem) |
| `LIVE · đã dừng record` | Bạn đã bấm "Dừng record", tool bỏ qua phiên live này |
| `tạm dừng` | Bạn đã tạm dừng theo dõi kênh |

### Các nút

| Nút | Tác dụng |
|---|---|
| **Kiểm tra** | Kiểm tra ngay kênh có đang live không (bình thường tool tự kiểm tra mỗi 60 giây) |
| **Dừng record** | Dừng ghi và **bỏ qua phần còn lại của phiên live này**. Lần live sau vẫn tự record |
| **Record tiếp** | Ghi lại phiên live vừa bấm dừng |
| **Tạm dừng / Bật lại** | Ngừng hoặc tiếp tục theo dõi kênh |
| **Xoá** | Bỏ theo dõi kênh (video đã lưu vẫn giữ nguyên) |

### Xem và tải video

Mục **Video đã record** liệt kê toàn bộ video. Bấm **Xem** để phát ngay trên web, **Tải về** để tải file, **Xoá** để xoá.

Video nằm trong thư mục:

```
tiktok-live-recorder/recordings/<username>/<username>_<NămThángNgày_GiờPhútGiây>.mp4
```

Một phiên live có thể ra **nhiều file** nếu stream bị rớt mạng hoặc bạn bấm dừng rồi record tiếp.

---

## 5. Tuỳ chỉnh

Thêm biến vào trước `npm start`. Ví dụ, kiểm tra mỗi 20 giây:

```bash
CHECK_INTERVAL_SEC=20 npm start
```

Trên Windows (PowerShell):

```bash
$env:CHECK_INTERVAL_SEC=20; npm start
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `CHECK_INTERVAL_SEC` | `60` | Bao lâu kiểm tra live một lần. Số nhỏ thì bắt live sớm hơn, nhưng đừng để dưới 15 |
| `PORT` | `3000` | Cổng web, đổi khi cổng 3000 đã bị dùng |
| `QUALITY` | `origin` | Chất lượng: `origin` / `uhd` / `hd` / `sd` / `ld`. Không có mức này thì lấy mức tốt nhất còn lại |
| `RECORDINGS_DIR` | `./recordings` | Thư mục lưu video (ví dụ ổ cứng ngoài) |
| `TIKTOK_COOKIE` | | Cần cho live giới hạn tuổi / khu vực (xem mục 7) |
| `REMUX_TO_MP4` | `true` | Đặt `false` để giữ nguyên file `.ts` |

---

## 6. Tài nguyên máy cần dùng

Tool chạy hoàn toàn trên máy bạn:

- **Mạng:** khoảng 1,5 Mbps cho mỗi kênh đang live ở chất lượng HD
- **Ổ cứng:** khoảng **600 MB / 1 giờ live / 1 kênh** (HD)
- **CPU:** rất nhẹ, vì không encode lại video

---

## 7. Lỗi thường gặp

**`Could not read package.json`**
Bạn đang đứng sai thư mục. Chạy `cd tiktok-live-recorder` trước rồi mới `npm start`.

**`Cổng 3000 đang bị dùng`**
Tool đã chạy sẵn ở cửa sổ khác. Mở luôn http://localhost:3000, hoặc chạy ở cổng khác: `PORT=3001 npm start`.

**`Không tìm thấy ffmpeg`**
Chưa cài ffmpeg, hoặc (trên Windows) chưa mở lại terminal sau khi cài.

**Kênh hiện LIVE nhưng không record**
- Có nhãn `đã dừng record`: bấm **Record tiếp**.
- Có dòng lỗi đỏ "không lấy được link stream": live bị giới hạn tuổi hoặc khu vực, cần cookie:
  1. Đăng nhập tiktok.com trên Chrome
  2. Bấm F12 → **Application** → **Cookies** → `https://www.tiktok.com` → copy giá trị `sessionid`
  3. Chạy: `TIKTOK_COOKIE="sessionid=GIÁ_TRỊ_VỪA_COPY" npm start`

  Cookie này là thông tin đăng nhập TikTok của bạn, không gửi cho ai.

**Không có phần đầu của phiên live**
TikTok không cho tua lại live, nên tool chỉ ghi được từ lúc phát hiện live. Muốn đủ phần đầu: thêm kênh từ trước, để tool chạy liên tục và giảm `CHECK_INTERVAL_SEC` xuống khoảng 20.

---

## 8. Cập nhật code mới

```bash
cd tiktok-live-recorder
git pull
npm start
```

Danh sách kênh (`data/`) và video (`recordings/`) không bị ảnh hưởng khi cập nhật.

---

## 9. Chạy 24/7 trên server (tuỳ chọn)

Nếu có VPS cài Docker:

```bash
docker compose up -d
```

Web ở cổng 3000, video lưu trong thư mục `recordings/` cạnh file `docker-compose.yml`.
