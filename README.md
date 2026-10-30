# Truyện

Truyện cổ Việt Nam xem từng cảnh: tranh, cảnh động, giọng kể, nhạc nền và phụ đề luôn hiện. Hai kệ trong cùng một
app: **Trẻ em** (Mèo Miu dẫn chuyện, kể nhẹ nhàng cho trẻ nhỏ) và **Người lớn** (truyền thuyết, truyền kỳ, sự tích kể
đầy đủ, theo sát truyện xưa). Không cần đăng nhập. Tên miền dự kiến `truyen.hoandat.com`, thuộc tầng app giải trí của hệ sinh thái hoandat.com.

Mọi tranh, cảnh động, giọng và nhạc **sinh sẵn** trên máy nhà rồi phục vụ tĩnh: không có lời gọi AI nào lúc người dùng
xem, app chạy cả khi máy nhà tắt. Nội dung AI không thuộc giấy phép MIT của mã nguồn: xem [`CREDITS.md`](CREDITS.md).

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `stories/<slug>/story.json` | Một truyện: kệ, lời kể, phụ đề, prompt và seed để sinh media, đường dẫn media đã có ([định dạng](docs/story-format.md)) |
| `stories/<slug>/media/` | Tranh (WebP), cảnh động (MP4 không tiếng), giọng kể và nhạc (M4A) do `pnpm story:build` tạo |
| `packages/story` | Schema, luật kiểm và thời gian đọc của truyện (dùng chung cho app và script, không phụ thuộc React hay Node) |
| `apps/web` | App web tĩnh (Vite + React): hai kệ truyện, trình xem `/truyen/<slug>`, trang pháp lý |
| `scripts/` | `build-story.ts` (sinh media), `validate-stories.ts`, `check-tokens.ts`, `brand-gen.ts` |
| `brand.config.json`, `brand/` | Tên, màu, biểu tượng (gói `@achoo254/brand`) |

## Kệ truyện

| Đường dẫn | Trang |
| --- | --- |
| `/` | Cả hai kệ, Trẻ em trước rồi Người lớn |
| `/tre-em` | Chỉ kệ Trẻ em. Lối vào từ Miu World trỏ vào đây |
| `/nguoi-lon` | Chỉ kệ Người lớn |
| `/truyen/<slug>` | Một truyện; ghi kệ của truyện, nút quay lại về đúng kệ đó |

| Truyện (`slug`) | Kệ | Cảnh | Đọc to (ước tính) | Giọng kể | Tranh, cảnh động, giọng, nhạc |
| --- | --- | --- | --- | --- | --- |
| Sơn Tinh, Thủy Tinh (`son-tinh-thuy-tinh`) | Trẻ em | 8 | khoảng 4 phút | Trúc Ly (Mèo Miu), Quỳnh Anh | pending, chờ máy nhà bật |
| Thánh Gióng (`thanh-giong`) | Trẻ em | 9 | khoảng 6 phút | Trúc Ly (Mèo Miu), Quỳnh Anh | pending, chờ máy nhà bật |
| Tấm Cám (`tam-cam`) | Trẻ em | 10 | khoảng 6 phút | Trúc Ly (Mèo Miu), Quỳnh Anh | pending, chờ máy nhà bật |
| Cây khế (`cay-khe`) | Trẻ em | 8 | khoảng 4 phút | Trúc Ly (Mèo Miu), Quỳnh Anh | pending, chờ máy nhà bật |
| Con Rồng cháu Tiên (`con-rong-chau-tien`) | Trẻ em | 7 | khoảng 4 phút | Trúc Ly (Mèo Miu), Quỳnh Anh | pending, chờ máy nhà bật |
| Chuyện người con gái Nam Xương (`nguoi-con-gai-nam-xuong`) | Người lớn | 12 | khoảng 9 phút | Thanh Bình | pending, chờ máy nhà bật |
| Chử Đồng Tử và Tiên Dung (`chu-dong-tu`) | Người lớn | 11 | khoảng 7 phút | Thanh Bình | pending, chờ máy nhà bật |
| Sự tích Hồ Gươm (`su-tich-ho-guom`) | Người lớn | 11 | khoảng 7 phút | Thanh Bình | pending, chờ máy nhà bật |

Nguồn của từng truyện ghi ở trường `source` trong `story.json`; luật của từng kệ ở [`docs/story-format.md`](docs/story-format.md).

Khung trang theo app tầng giải trí (Tử Vi, Clip): header (dấu, tên app, link, nút đổi ngôn ngữ), body, footer ("Một
app của hoandat.com", Quyền riêng tư, Điều khoản, Ghi công). Lựa chọn ngôn ngữ lưu ở cookie `hd_lang` dùng chung qua
`@achoo254/app-shell/preferences`. Một giao diện tối, không có nút sáng/tối.

## Chạy

Cần Node ≥ 22.12 và pnpm 11 (`packageManager` trong `package.json`). Các gói `@achoo254/*` cài từ tag git của
`achoo254/shared-next`, không qua npm.

```sh
pnpm install
pnpm dev            # http://localhost:5301
pnpm build          # apps/web/dist: site tĩnh gồm /stories/
```

Gate trước khi báo xong:

```sh
pnpm lint           # eslint, check-brand, check:tokens, check:stories
pnpm typecheck
pnpm test           # vitest --maxWorkers=2
pnpm build
pnpm e2e            # Playwright: build + preview ở 5302, hai kệ, mở truyện và chuyển cảnh
```

Phục vụ production: `apps/web/dist` là file tĩnh; máy chủ web trả `index.html` cho mọi đường dẫn không phải file (ví dụ
`/tre-em`, `/truyen/<slug>`). Chưa deploy.

## Làm tranh, giọng kể, nhạc

Dùng các công cụ của skill `inet-artgen` (`artgen.py`, `voice.py`, `video-finish.py`; mặc định ở
`~/.claude/skills/inet-artgen`, đổi bằng `ARTGEN_DIR`), cần máy nhà bật và nằm trong tailnet, cùng `ffmpeg` và `cwebp`
trên máy chạy.

Thứ tự: làm năm truyện kệ Trẻ em trước, rồi ba truyện kệ Người lớn. Tám truyện cần 273 file trong `media/` (37 bảng
nhân vật, 76 tranh, 76 cảnh động, 76 giọng kể, 8 nhạc) và 8 clip mạng xã hội ở `.work/`.

1. Xem trước các lệnh sẽ chạy (không cần máy nhà):

   ```sh
   pnpm story:build son-tinh-thuy-tinh --dry-run
   ```

2. Chạy thật theo từng đợt để đỡ nạp lại model (ảnh, rồi video, rồi giọng, rồi nhạc):

   ```sh
   pnpm story:build son-tinh-thuy-tinh --only characters
   pnpm story:build son-tinh-thuy-tinh --only images
   pnpm story:build son-tinh-thuy-tinh --only videos
   pnpm story:build son-tinh-thuy-tinh --only voices,music
   pnpm story:build son-tinh-thuy-tinh --only social     # clip 30–60 giây để đăng mạng xã hội, ở .work/<slug>/social.mp4
   ```

   Script kiểm `artgen.py --health` (và `voice.py --health` trước khi đọc giọng) trước khi làm gì: máy nhà tắt thì dừng
   với `PC offline, pending`. Mỗi bước xong thì ghi đường dẫn file vào `story.json`; bước đã có file thì bỏ qua (chạy
   lại sau khi dừng giữa chừng), `--force` để làm lại. File gốc (PNG, WAV, MP4 1080p) ở `.work/` (không commit).
3. Mở từng ảnh, xem từng cảnh động và nghe thử trước khi commit; ảnh hỏng thì đổi `seed` (hoặc prompt) của cảnh đó,
   xoá file trong `media/` và chạy lại bước đó.
