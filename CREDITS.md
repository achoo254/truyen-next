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

| Truyện | Lời kể | Tranh, cảnh động, giọng, nhạc |
| --- | --- | --- |
| `son-tinh-thuy-tinh` (Sơn Tinh, Thủy Tinh) | Viết 30/10/2026, **chờ người duyệt** | Chưa làm: chờ duyệt lời, rồi chờ máy nhà bật (pending) |

Truyện chưa có tranh và âm thanh thì app hiện nền trơn và phụ đề; không dùng hình, giọng hay nhạc nào khác thay vào.

## Lời kể

Các truyện là truyện dân gian Việt Nam thuộc phạm vi công cộng. Lời kể viết mới cho trẻ nhỏ, không chép câu chữ của
sách giáo khoa hay bản kể đã xuất bản nào. Lời kể thuộc hoandat, cùng giấy phép với nội dung AI ở trên.

Mèo Miu (người dẫn truyện ở cảnh mở và kết) là nhân vật của Miu World (`miu-world-next`). Bảng nhân vật của Miu vẽ
theo ảnh dựng của Miu trong Miu World (`--ref`), để hai app cùng một chú mèo.

## Biểu tượng và chữ

| Tài sản | Tác giả | Giấy phép |
| --- | --- | --- |
| `brand/icon.svg`, `brand/icon-maskable.svg` và mọi file sinh ra từ chúng trong `brand/generated/` | hoandat (hình vector tạm: quyển sách mở dưới vầng trăng, vẽ bằng hình SVG cơ bản) | Như mã nguồn (MIT). Sẽ thay bằng biểu tượng vẽ bằng AI trên máy nhà |
| Font Inter (gói `@fontsource/inter`, có subset tiếng Việt) | The Inter Project Authors | SIL Open Font License 1.1 |
