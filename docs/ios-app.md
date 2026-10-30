# App iPhone (`apps/mobile`)

Vỏ Capacitor 8 quanh bản build app của web (`vite build --mode native` → `apps/web/dist-native`). Bundle
`com.hoandat.truyen`, team `AM5C55N339`, chỉ iPhone (`TARGETED_DEVICE_FAMILY = 1`), iOS 15 trở lên. Phiên bản lấy từ
`apps/mobile/package.json` (`MARKETING_VERSION`), số build đặt lúc phát hành. Nội dung cho App Store:
[`docs/app-store/`](app-store/).

## App làm được gì hơn web

| Việc | Cách làm |
|---|---|
| Phát tiếp khi khoá máy hay chuyển app | `UIBackgroundModes audio`; `AppDelegate.swift` đặt phiên âm thanh `playback`, chế độ `spokenAudio`, không trộn với app khác. Truyện có bản âm thanh liền (`track`, [định dạng](story-format.md)) phát bằng một thẻ `<audio>` và lật trang theo thời gian của nó, không theo đồng hồ JavaScript |
| Màn hình khoá, tai nghe | Media Session API của WebKit (`apps/web/src/story/media-session.ts`): tên cảnh, tên truyện, tên app, tranh cảnh (chưa có tranh thì biểu tượng app); phát, dừng, cảnh trước/sau, tua. Không cần plugin native |
| Hẹn giờ ngủ khi khoá máy | Tự kiểm theo mỗi lần bản âm thanh báo thời gian (`use-sleep.ts`). iOS không cho chỉnh âm lượng thẻ `<audio>`: trang mờ dần mười giây rồi tiếng dừng hẳn |
| Nghe offline | Nút "Tải về để nghe không cần mạng" ở trang truyện (dung lượng hỏi trước bằng `HEAD`), thanh tiến độ, dừng tải; trang **Đã tải** (`/da-tai`, nút ở header) liệt kê dung lượng từng truyện, tổng, xoá. File ở `Library/NoCloud/downloads/<slug>/` (không sao lưu iCloud, hệ thống không tự xoá); tải vào `<slug>.part/` rồi mới đổi tên, nên truyện hoặc có đủ hoặc không có. Truyện đã tải luôn đọc từ máy (`story-location.ts`); không vào được site thì kệ hiện các truyện đã tải. Muốn bản mới của truyện: xoá rồi tải lại |
| Cổng phụ huynh | Trước mọi thứ đi ra ngoài app (link `hoandat.com` ở cuối trang, nút Chia sẻ): một câu nhân viết bằng chữ ("Chín nhân bảy bằng bao nhiêu?"), trả lời sai thì đổi câu (`native/parental-gate.tsx`). Áp cho cả app, không chỉ kệ Trẻ em. Link ra ngoài mở bằng Safari, app giữ nguyên trang |
| Không theo dõi | Bản app không có Cloudflare Web Analytics (chỉ có ở web do Cloudflare chèn); CSP của app (thẻ meta, `vite-native.ts`) lấy từ CSP của nginx, bỏ hai nguồn đó, thêm `https://truyen.hoandat.com` cho tranh, âm thanh |

Truyện và media đọc từ `https://truyen.hoandat.com/stories/…`. Lệnh `fetch()` tới site đi qua HTTP của app
(`CapacitorHttp`), tranh và âm thanh là media thường, nên **không cần đổi gì trên máy chủ** (site không gửi CORS và
không cần). Chia sẻ từ app gửi link `https://truyen.hoandat.com/truyen/<slug>?canh=n`.

Bản web không đổi: `IN_APP` (`apps/web/src/platform/app-build.ts`) là hằng số lúc build; phần chỉ của app (tải về,
Capacitor) nạp riêng và không được gọi trên web.

## Build và chạy

```sh
pnpm mobile:build                                  # build app web + cap sync ios
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select trỏ Command Line Tools
cd apps/mobile/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/truyen-dd build
xcrun simctl install booted /tmp/truyen-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.hoandat.truyen
```

Biểu tượng và màn khởi động (tạm, vẽ từ `brand/icon.svg`): `pnpm --filter @truyen/mobile icons`, rồi commit PNG.
`apps/mobile/mobile-project.test.ts` (trong `pnpm test`) giữ bundle id, phiên bản, phát nền, phiên âm thanh, không có
ngoại lệ ATS, biểu tượng 1024 px không kênh alpha.

### Thử có tiếng khi chưa có media thật

Chỉ cho máy dev, không bao giờ vào bản phát hành:

```sh
pnpm fixture:story .work/fixture son-tinh-thuy-tinh 8          # bản sao truyện với tiếng bíp, bản liền 77 giây
cd apps/web
TRUYEN_STORIES_DIR=../../.work/fixture/stories npx vite build --outDir ../../.work/fixture/site --emptyOutDir
npx vite preview --outDir ../../.work/fixture/site --port 5303 --strictPort &   # có Range, như nginx
TRUYEN_STORY_ORIGIN=http://localhost:5303 npx vite build --mode native
cd ../mobile && pnpm exec cap copy ios      # rồi build Debug như trên
```

Bản Debug cần được nạp `http://localhost`: thêm `NSAppTransportSecurity` → `NSAllowsLocalNetworking` vào
`Info.plist` **của file .app đã build** (`PlistBuddy`) rồi ký lại `codesign --force --sign - App.app`; không sửa
`Info.plist` trong repo. Muốn khỏi cần server: `TRUYEN_STORY_ORIGIN=bundled TRUYEN_STORIES_DIR=…` đóng gói truyện thử
vào app. Điều khiển app trong Simulator không có màn hình: `brew install ios-webkit-debug-proxy`, chạy với socket
`webinspectord_sim` của Simulator, rồi gửi `Runtime.evaluate` qua WebSocket tới trang `capacitor://localhost` (bản
Debug cho phép Web Inspector).

### Đã kiểm trên Simulator (30/10/2026, iPhone 17 Pro, iOS 27.0)

- Mở app, kệ đọc từ `https://truyen.hoandat.com` qua HTTP của app.
- Truyện thử phát bản liền, trang lật theo thời gian âm thanh; đưa app xuống nền (mở Cài đặt) 20 giây: âm thanh chạy
  tiếp (22,5 → 43,3 giây, `document.hidden = true`, lật tới cảnh 5), rồi phát hết truyện ở nền.
- Now Playing: log `mediaremoted` và `MediaRemoteUI` nhận tiêu đề "Cảnh 6/8 · …", tên truyện, "Truyện", ảnh 512 px,
  7 lệnh điều khiển (phát/dừng, cảnh sau…). Simulator không có giao diện (máy Mac chạy headless) nên chưa nhìn thấy
  màn hình khoá và chưa thử khoá máy thật (Cmd+L): cần iPhone thật.
- Tải truyện thử (1,7 MB, 11 file) vào `Library/NoCloud` (có cờ không sao lưu); tắt server rồi mở lại app: kệ hiện
  truyện đã tải, truyện phát từ `capacitor://localhost/_capacitor_file_/…`. Chưa thử chế độ máy bay thật (Simulator
  dùng mạng của Mac).
- Cổng phụ huynh hiện khi bấm link `hoandat.com`; trả lời đúng thì Safari mở `hoandat.com`, app ở nguyên trang.

## TestFlight

```sh
ASC_KEY_ID=<Key ID> ASC_ISSUER_ID=<Issuer ID> ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_<Key ID>.p8 \
  pnpm mobile:ios-release
```

`apps/mobile/scripts/ios-release.sh` (theo mẫu của Chat): build app web với site thật (bỏ `TRUYEN_STORY_ORIGIN`,
`TRUYEN_STORIES_DIR`, kiểm CSP có `https://truyen.hoandat.com`, không có `localhost` hay Cloudflare Insights),
`cap sync`, archive Release ký tự động, rồi `-exportArchive` tải thẳng lên App Store Connect. Số build mặc định là giờ
UTC `YYYYMMDD.HHMM`. App record: "Truyện – Cổ tích Việt Nam" (Apple ID 6828764675). Nộp duyệt, mời người thử bên
ngoài, sửa metadata trên App Store Connect: hỏi chủ dự án trước.
