# Ghi công nội dung

Nguồn gốc và giấy phép của nội dung đi kèm repo. Trang `/credits` của app hiển thị cùng nội dung. Nội dung này
**không** thuộc giấy phép MIT của mã nguồn (`LICENSE`).

## Nội dung AI

Mọi tranh, cảnh động, giọng kể và nhạc của các truyện (`stories/<slug>/media/`) sinh bằng model AI chạy trên máy
nhà của chủ sở hữu (skill `inet-artgen`), chỉ dùng model cho phép thương mại. Giấy phép:

> AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0)

Repo công khai, nên file nội dung nằm trong repo được, nhưng **không phải CC0**: không chép lại để bán hay đăng như
của mình.

| Loại | Model (giấy phép model) | Lệnh |
| --- | --- | --- |
| Bảng nhân vật, tranh từng cảnh | Qwen-Image-2512, FLUX.2 klein 4B (Apache-2.0) | `artgen.py -w qwen`, `-w klein-edit --ref` |
| Cảnh động | Wan 2.2 14B I2V + lightx2v, SeedVR2, FILM (Apache-2.0) | `artgen.py -w wan-i2v`, `-w video-upscale` |
| Giọng kể | VieNeu-TTS v3 Turbo, giọng có sẵn (Apache-2.0); không nhân bản giọng người thật | `voice.py` |
| Nhạc nền | ACE-Step 1.5 (MIT), không lời | `artgen.py -w ace-music` |

Cách làm và lệnh cụ thể: `README.md` mục "Làm tranh, giọng kể, nhạc".

### Trạng thái từng truyện

| Truyện | Kệ | Lời kể | Tranh, cảnh động, giọng, nhạc |
| --- | --- | --- | --- |
| `son-tinh-thuy-tinh` (Sơn Tinh, Thủy Tinh) | Trẻ em | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `thanh-giong` (Thánh Gióng) | Trẻ em | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `tam-cam` (Tấm Cám) | Trẻ em | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `cay-khe` (Cây khế) | Trẻ em | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `con-rong-chau-tien` (Con Rồng cháu Tiên) | Trẻ em | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `nguoi-con-gai-nam-xuong` (Chuyện người con gái Nam Xương) | Người lớn | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `chu-dong-tu` (Chử Đồng Tử và Tiên Dung) | Người lớn | Viết 30/10/2026 | pending, chờ máy nhà bật |
| `su-tich-ho-guom` (Sự tích Hồ Gươm) | Người lớn | Viết 30/10/2026 | pending, chờ máy nhà bật |

Truyện chưa có tranh và âm thanh thì app hiện nền trơn và phụ đề; không dùng hình, giọng hay nhạc nào khác thay vào.

## Lời kể

Các truyện là truyện dân gian, truyền thuyết và truyền kỳ Việt Nam thuộc phạm vi công cộng; nguồn của từng truyện ghi
ở trường `source` trong `story.json`:

- Kệ Trẻ em: truyện dân gian, kể lại nhẹ nhàng cho trẻ nhỏ (Tấm Cám và Cây khế bỏ các đoạn hại người, kết bằng nhận
  lỗi và tha thứ).
- Kệ Người lớn: Nam Xương nữ tử truyện (Truyền kỳ mạn lục, Nguyễn Dữ, thế kỷ XVI), Nhất Dạ Trạch truyện (Lĩnh Nam
  chích quái, thế kỷ XIV, XV), truyền thuyết hồ Hoàn Kiếm (thời Lê sơ); kể đầy đủ, theo sát cốt truyện gốc.

Lời kể viết mới, không chép câu chữ của sách giáo khoa, bản dịch hay bản kể đã xuất bản nào. Lời kể thuộc hoandat,
cùng giấy phép với nội dung AI ở trên.

Mèo Miu (người dẫn truyện ở cảnh mở và kết của kệ Trẻ em) là nhân vật của Miu World (`miu-world-next`). Bảng nhân vật của Miu vẽ
theo ảnh dựng của Miu trong Miu World (`--ref`), để hai app cùng một chú mèo.

## Biểu tượng và chữ

| Tài sản | Tác giả | Giấy phép |
| --- | --- | --- |
| `brand/icon.svg`, `brand/icon-maskable.svg` và mọi file sinh ra từ chúng trong `brand/generated/` | hoandat (hình vector **tạm**: quyển sách mở dưới vầng trăng khuyết vàng nghệ, viền mực trên nền đỏ son theo bảng màu tranh Đông Hồ, vẽ bằng hình SVG cơ bản) | Như mã nguồn (MIT). Sẽ thay bằng biểu tượng vẽ bằng AI trên máy nhà |
| `apps/web/src/art/dong-ho-print.svg` (tranh ở trang chủ: cá chép vượt sóng dưới mặt trời, giữa núi và nước) và `apps/web/public/og-image.png` (ảnh xem trước link, `pnpm brand:gen` dựng từ tranh này cùng tên app) | hoandat (vẽ tay bằng SVG theo lối tranh khắc gỗ Đông Hồ, không dùng AI) | Như mã nguồn (MIT) |
| Hoạ tiết giấy dó, viền hồi văn, sóng, mây cuộn (SVG trong `apps/web/src/ui/tokens.css`) | hoandat | Như mã nguồn (MIT) |
| Font Alegreya (tiêu đề, gói `@fontsource/alegreya`, có subset tiếng Việt) | The Alegreya Project Authors (Huerta Tipográfica) | SIL Open Font License 1.1 |
| Font Alegreya Sans (chữ đọc, gói `@fontsource/alegreya-sans`, có subset tiếng Việt) | The Alegreya Sans Project Authors (Huerta Tipográfica) | SIL Open Font License 1.1 |
