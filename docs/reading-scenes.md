# Bối cảnh đọc

Cuốn sách của trình đọc nằm trong một nơi chốn người đọc tự chọn (Tuỳ chọn → Bối cảnh đọc): bàn gỗ, giường, sân đình
đêm trăng, công viên… Lựa chọn lưu riêng cho từng kệ trong `localStorage` `truyen:prefs:v1` (bé và bố mẹ thích khác
nhau). Mặc định: Bàn gỗ bên cửa sổ; khi trình duyệt bật Save-Data thì Giấy trơn.

Nguồn dữ liệu duy nhất: [`packages/story/src/reading-scenes.ts`](../packages/story/src/reading-scenes.ts) (danh sách
cảnh, tên, prompt từng tâm trạng, khung hình, kích thước xuất, ngân sách dung lượng, cảnh nào đã vẽ). Tranh vẽ bằng
`pnpm scenes:build` trên máy nhà; trước khi có tranh, mỗi cảnh là bản phác bằng CSS (`.backdrop--<id>` trong
`apps/web/src/ui/app.css`, màu ở `tokens.css`) và bộ chọn ghi "Tranh đang vẽ".

## Luật bất biến

- Chữ không bao giờ nằm trên tranh nền. Trang sách luôn đục; thanh tiêu đề và thanh nút nằm trên tấm giấy riêng.
- Tranh chừa vùng giữa trơn (sách che): điện thoại 94% ngang × 84% dọc, desktop 64% × 80%. Đồ vật chỉ ở mép và góc.
- Không chữ, không ký tự giả trong tranh (prompt đã ghi; vẫn phải soi lại).
- Tắt đèn: cảnh có bản đêm thì dùng bản đêm; cảnh chỉ có ban ngày được phủ một lớp tối. Đổi bối cảnh không bao giờ đổi
  Tắt đèn.

## Các cảnh

| Mã | Tên | Tâm trạng | Bản phác CSS (đến khi có tranh) |
| --- | --- | --- | --- |
| `ban-go` | Bàn gỗ bên cửa sổ (mặc định) | ngày + đêm | vân gỗ; ngày: ánh cửa sổ, ấm trà; đêm: đèn dầu, quầng sáng thở nhẹ |
| `giuong-ngu` | Trên giường | đêm | chăn đỏ hoa sen, đèn ngủ trăng khuyết |
| `san-dinh-trang` | Sân đình đêm trăng sao | đêm | trời đêm có sao, trăng rằm |
| `goc-da` | Công viên dưới gốc đa | ngày | cỏ, tán đa ở mép trên |
| `vong-hien` | Võng dưới hiên tre | ngày | đan võng, quạt nan |
| `hien-mua` | Hiên nhà ngày mưa | ngày + đêm | vệt mưa, chum; đêm: đèn dầu |
| `ben-sen` | Thuyền bên đầm sen | ngày | gợn nước, hoa sen |
| `giay-tron` | Giấy trơn | không | giấy của site, không tải gì |

Prompt đầy đủ từng cảnh nằm trong `reading-scenes.ts` (trường `prompts`); trước mỗi prompt luôn có phần phong cách
chung `READING_SCENE_STYLE` (tranh khắc Đông Hồ, mảng màu phẳng, nét khắc đen, giấy điệp, nhìn chéo từ trên, không
chữ, chừa giữa trống cho cuốn sách).

## Tranh cần vẽ trên máy nhà

9 biến thể (7 cảnh, `ban-go` và `hien-mua` có cả ngày lẫn đêm) × 4 khung = **36 lần vẽ** bằng `qwen` (`artgen.py -w
qwen`), mỗi biến thể một seed cố định để bốn khung giống nhau. Mỗi lần vẽ xuất ra các kích thước dưới đây, mỗi kích
thước hai định dạng: **108 file** trong `apps/web/public/reading-scenes/<mã>-<day|night>-<rộng>x<cao>.<avif|webp>`.

| Khung | Tỉ lệ | Kích thước vẽ | Xuất | Ngân sách AVIF / WebP |
| --- | --- | --- | --- | --- |
| Điện thoại | 9:19,5 | 832×1808 | 1125×2436, 750×1624 | ≤ 90 KB / ≤ 140 KB |
| Tablet dọc | 3:4 | 1104×1472 | 1536×2048 | ≤ 150 KB / ≤ 230 KB |
| Tablet ngang | 4:3 | 1472×1104 | 2048×1536 | ≤ 150 KB / ≤ 230 KB |
| Desktop | 16:9 | 1664×928 | 2560×1440, 1920×1080 | ≤ 220 KB / ≤ 350 KB |

AVIF: `ffmpeg -c:v libaom-av1 -still-picture 1 -crf 34`; WebP: `cwebp -q 80`; phóng từ kích thước vẽ bằng Lanczos.
Trang chọn khung theo tỉ lệ màn hình (`scene-backdrop.tsx`): rất dọc → điện thoại, dọc → tablet dọc, đến 3:2 → tablet
ngang, rộng hơn → desktop; tải sau trang sách với `fetchpriority="low"`.

## Quy trình

```sh
pnpm scenes:build --dry-run            # in 36 lệnh vẽ và các lệnh xuất, không chạy gì
pnpm scenes:build ban-go               # vẽ một cảnh (cần máy nhà bật: artgen.py --health)
pnpm scenes:build                      # vẽ mọi cảnh còn thiếu file; --force vẽ lại
```

Sau khi vẽ một biến thể:

1. Soi từng khung ở cả hai chế độ đèn: vùng giữa đủ trơn (độ lệch chuẩn độ sáng thấp), không chữ hay ký tự giả, chỗ
   tiếp giáp với mép sách không có vật bị cắt dở.
2. Kiểm dung lượng theo bảng trên; vượt thì hạ `-crf`/`-q` của khung đó.
3. Thêm tâm trạng đã xong vào `drawn` của cảnh trong `reading-scenes.ts`, rồi commit cùng các file ảnh. Trang chỉ đòi
   ảnh của biến thể có trong `drawn`, nên không bao giờ hỏi một file chưa có.
