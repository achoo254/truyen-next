# Truyện

Truyện cổ tích Việt Nam kể cho trẻ em, xem từng cảnh: tranh, cảnh động, giọng kể, nhạc nền và phụ đề luôn hiện. Không
cần đăng nhập. Tên miền dự kiến `truyen.hoandat.com`, thuộc tầng app giải trí của hệ sinh thái hoandat.com.

Mọi tranh, cảnh động, giọng và nhạc **sinh sẵn** trên máy nhà rồi phục vụ tĩnh: không có lời gọi AI nào lúc người dùng
xem, app chạy cả khi máy nhà tắt. Nội dung AI không thuộc giấy phép MIT của mã nguồn: xem [`CREDITS.md`](CREDITS.md).

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `stories/<slug>/story.json` | Một truyện: lời kể, phụ đề, prompt và seed để sinh media, đường dẫn media đã có ([định dạng](docs/story-format.md)) |
| `stories/<slug>/media/` | Tranh (WebP), cảnh động (MP4 không tiếng), giọng kể và nhạc (M4A) do `pnpm story:build` tạo |
| `packages/story` | Schema, luật kiểm và thời gian đọc của truyện (dùng chung cho app và script, không phụ thuộc React hay Node) |
| `apps/web` | App web tĩnh (Vite + React): danh sách truyện, trình xem `/truyen/<slug>`, trang pháp lý |
| `scripts/` | `build-story.ts` (sinh media), `validate-stories.ts`, `check-tokens.ts`, `brand-gen.ts` |
| `brand.config.json`, `brand/` | Tên, màu, biểu tượng (gói `@achoo254/brand`) |

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
pnpm e2e            # Playwright: build + preview ở 5302, mở truyện thử và chuyển cảnh
```

Phục vụ production: `apps/web/dist` là file tĩnh; máy chủ web trả `index.html` cho mọi đường dẫn không phải file (ví dụ
`/truyen/<slug>`). Chưa deploy.

## Làm tranh, giọng kể, nhạc

Dùng các công cụ của skill `inet-artgen` (`artgen.py`, `voice.py`, `video-finish.py`; mặc định ở
`~/.claude/skills/inet-artgen`, đổi bằng `ARTGEN_DIR`), cần máy nhà bật và nằm trong tailnet, cùng `ffmpeg` và `cwebp`
trên máy chạy.

1. Người duyệt đọc lời kể trong `story.json`, rồi đặt `"status": "text-approved"` và
   `"review": { "approvedBy": "…", "approvedOn": "YYYY-MM-DD" }`.
2. Xem trước các lệnh sẽ chạy (không cần máy nhà, chạy được cả khi lời chưa duyệt):

   ```sh
   pnpm story:build son-tinh-thuy-tinh --dry-run
   ```

3. Chạy thật theo từng đợt để đỡ nạp lại model (ảnh, rồi video, rồi giọng, rồi nhạc):

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
4. Mở từng ảnh, xem từng cảnh động và nghe thử trước khi commit; ảnh hỏng thì đổi `seed` (hoặc prompt) của cảnh đó,
   xoá file trong `media/` và chạy lại bước đó.
