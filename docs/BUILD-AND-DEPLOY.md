# Hướng dẫn Build APK & Deploy lên Quest 2

> Tài liệu chi tiết từng bước: từ code → build APK → cài lên Quest 2 → upload lên Meta Quest Store.
> Cập nhật: 2026-02-02

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu phần mềm](#2-yêu-cầu-phần-mềm)
3. [Chuẩn bị Quest 2](#3-chuẩn-bị-quest-2)
4. [Cấu trúc thư mục quan trọng](#4-cấu-trúc-thư-mục-quan-trọng)
5. [Quy trình Build APK](#5-quy-trình-build-apk)
6. [Cài đặt APK lên Quest 2 (ADB)](#6-cài-đặt-apk-lên-quest-2-adb)
7. [Deploy nhanh bằng script tự động](#7-deploy-nhanh-bằng-script-tự-động)
8. [Upload lên Meta Quest Store](#8-upload-lên-meta-quest-store)
9. [Nộp app để Meta review](#9-nộp-app-để-meta-review)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)
11. [Tham khảo nhanh](#11-tham-khảo-nhanh)

---

## 1. Tổng quan kiến trúc

App này **KHÔNG** phải Unity. Đây là **web app VR** (A-Frame + WebXR) được đóng gói thành APK bằng **TWA (Trusted Web Activity)**.

```
┌─────────────────────────────────────────────────┐
│                  Meta Quest 2                    │
│                                                  │
│  APK (TWA wrapper)                               │
│    └── Mở Quest Browser ẩn                       │
│          └── Load https://vr.proxyit.online      │
│                └── Web app VR (A-Frame)           │
│                      ├── Game logic (JS)          │
│                      ├── 3D rendering (Three.js)  │
│                      └── IAP (Digital Goods API)  │
└─────────────────────────────────────────────────┘
```

**Luồng hoạt động:**
1. User mở app trên Quest → APK launch TWA
2. TWA mở Quest Browser (ẩn, fullscreen VR) tới `https://vr.proxyit.online`
3. Server backend (Node.js/Express) tại `localhost:3001` được Nginx proxy qua domain trên
4. Web app chạy hoàn toàn trong browser với WebXR, A-Frame, IAP

**Quan trọng:** APK chỉ là "vỏ bọc" để mở web app. Toàn bộ game logic nằm trên server. Khi update game code, **không cần build lại APK** — chỉ cần deploy code mới lên server. APK chỉ cần build lại khi:
- Thay đổi domain/hostname
- Thay đổi Android manifest (permissions, billing config)
- Upload version mới lên Meta Store (bắt buộc tăng `versionCode`)

---

## 2. Yêu cầu phần mềm

### Trên máy tính (Windows)

| Phần mềm | Mục đích | Cách cài |
|-----------|----------|----------|
| **Node.js** (v18+) | Chạy server backend + build frontend | [nodejs.org](https://nodejs.org) |
| **Android Studio** | Cung cấp JDK + Android SDK | [developer.android.com/studio](https://developer.android.com/studio) |
| **Gradle 8.13** | Build APK (có sẵn gradlew trong project) | Tự động qua `gradlew.bat` |
| **ADB** (Android Debug Bridge) | Cài APK lên Quest qua USB | Có sẵn trong Android SDK |
| **ovr-platform-util.exe** | Upload APK lên Meta Store | Download từ Meta Developer Dashboard |
| **Nginx** (trên server) | Reverse proxy domain → localhost | Chỉ cần trên production server |

### Biến môi trường cần thiết

Mở PowerShell hoặc thêm vào System Environment Variables:

```powershell
# Java (từ Android Studio bundled JBR)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Android SDK
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

**Kiểm tra:**
```powershell
# Kiểm tra Java
& "$env:JAVA_HOME\bin\java.exe" -version
# Kết quả mong đợi: openjdk version "17.x.x" ...

# Kiểm tra ADB
& "$env:ANDROID_HOME\platform-tools\adb.exe" version
# Kết quả mong đợi: Android Debug Bridge version 1.0.xx

# Kiểm tra Gradle wrapper
.\quest-wrapper\gradlew.bat --version
# Kết quả mong đợi: Gradle 8.13
```

---

## 3. Chuẩn bị Quest 2

### 3.1 Bật Developer Mode

1. Cài app **Meta Horizon** trên điện thoại
2. Kết nối Quest 2 với app
3. Vào **Settings → System → Developer** (trên Quest hoặc trên app điện thoại)
4. Bật **Developer Mode** = ON
5. Khởi động lại Quest 2

> **Lưu ý:** Cần tài khoản Meta Developer (đăng ký miễn phí tại [developer.meta.com](https://developer.meta.com)) và tạo Organization trước khi thấy được tùy chọn Developer Mode.

### 3.2 Kết nối USB

1. Dùng cáp **USB-C** kết nối Quest 2 với PC
2. Đeo Quest 2 lên → sẽ thấy popup **"Allow USB debugging?"** → Chọn **Always allow** → OK
3. Trên PC, kiểm tra kết nối:

```powershell
adb devices
```

Kết quả mong đợi:
```
List of devices attached
1WMHH815123456    device
```

- Nếu thấy `unauthorized` → đeo Quest lên và chấp nhận popup
- Nếu không thấy device → kiểm tra cáp USB, thử cổng khác, hoặc cài Quest driver

### 3.3 Kết nối WiFi (không dây, tùy chọn)

Sau khi kết nối USB thành công, có thể chuyển sang WiFi:

```powershell
# Lấy IP Quest (Quest và PC phải cùng WiFi)
adb shell ip addr show wlan0
# Tìm dòng "inet 192.168.x.x"

# Bật ADB qua WiFi
adb tcpip 5555
adb connect 192.168.x.x:5555

# Rút cáp USB, kiểm tra
adb devices
# Kết quả: 192.168.x.x:5555    device
```

---

## 4. Cấu trúc thư mục quan trọng

```
game-vr/
├── client/                         # Frontend (web app VR)
│   ├── src/                        # Source code
│   │   ├── index.html              # Entry point chính
│   │   ├── js/                     # Game logic, components
│   │   └── manifest.json           # PWA manifest (chứa ovr_package_name)
│   ├── dist/                       # Output sau khi Vite build
│   └── package.json                # Dependencies frontend
│
├── server/                         # Backend (Express.js)
│   ├── index.js                    # Server chính (port 3001)
│   └── package.json                # Dependencies backend
│
├── quest-wrapper/                  # ★ THƯ MỤC BUILD APK ★
│   ├── app/
│   │   ├── build.gradle            # ★ Config chính: hostname, versionCode, dependencies
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # Permissions, billing, VR mode
│   │       ├── java/com/nvr/vrquest/
│   │       │   ├── LauncherActivity.java   # Mở TWA
│   │       │   ├── DelegationService.java  # Billing handler
│   │       │   └── Application.java
│   │       └── res/
│   │           ├── values/strings.xml      # Asset statements (domain verification)
│   │           ├── drawable/splash.png     # Splash screen
│   │           └── mipmap-hdpi/ic_launcher.png  # App icon
│   ├── build.gradle                # Root build (AGP 8.7.3)
│   ├── gradlew.bat                 # ★ Gradle wrapper (dùng cái này để build)
│   ├── settings.gradle
│   ├── gradle.properties           # AndroidX config
│   ├── ovr-platform-util.exe       # ★ Tool upload lên Meta Store
│   └── upload.ps1                  # Script upload
│
├── quest-deploy.ps1                # ★ SCRIPT TỰ ĐỘNG: build + install + restart
├── build-apk.ps1                   # Script build APK đơn giản
└── package.json                    # Root orchestrator
```

---

## 5. Quy trình Build APK

### Bước 1: Cài dependencies (chỉ lần đầu)

```powershell
cd game-vr

# Cài dependencies cho cả client và server
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### Bước 2: Build frontend (Vite)

```powershell
cd client
npx vite build
```

Output tạo ra trong `client/dist/`. Server Express sẽ serve thư mục này.

**Kiểm tra build thành công:**
```powershell
ls client/dist/
# Phải thấy: index.html, assets/, js/, ...
```

### Bước 3: Tăng versionCode (BẮT BUỘC mỗi lần upload Store)

Mở file `quest-wrapper/app/build.gradle`, tìm dòng:

```groovy
versionCode 21
```

Tăng lên `22` (hoặc số tiếp theo). **Meta Store từ chối APK trùng versionCode.**

> Script `quest-deploy.ps1` tự động tăng versionCode. Nếu build thủ công, phải tự tăng.

### Bước 4: Build APK bằng Gradle

```powershell
# Set environment (nếu chưa set permanent)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Xóa build cũ (tránh cache lỗi)
Remove-Item -Recurse -Force quest-wrapper\app\build -ErrorAction SilentlyContinue

# Build release APK
cd quest-wrapper
.\gradlew.bat --no-daemon assembleRelease
```

**Kết quả thành công:**
```
BUILD SUCCESSFUL in xxs
```

**File APK output:**
```
quest-wrapper/app/build/outputs/apk/release/app-release.apk
```

**Nếu build thất bại**, kiểm tra:
- `JAVA_HOME` trỏ đúng chưa? (phải có `bin\java.exe` bên trong)
- `gradle.properties` có `android.useAndroidX=true`?
- Internet ổn? (Gradle cần download dependencies lần đầu)

---

## 6. Cài đặt APK lên Quest 2 (ADB)

### Cài mới hoặc cập nhật

```powershell
adb install -r quest-wrapper\app\build\outputs\apk\release\app-release.apk
```

- Flag `-r` = replace (cài đè nếu đã có)
- Đợi khoảng 10-30 giây

**Kết quả thành công:**
```
Performing Streamed Install
Success
```

### Mở app trên Quest 2

**Cách 1 — Tự động bằng ADB:**
```powershell
# Tắt app cũ (nếu đang chạy)
adb shell am force-stop com.nvr.iaptest
adb shell am force-stop com.oculus.browser

# Mở app
adb shell monkey -p com.nvr.iaptest -c android.intent.category.LAUNCHER 1
```

**Cách 2 — Thủ công trên Quest:**
1. Đeo Quest 2 → vào Library
2. Chọn filter **Unknown Sources** (góc trên bên phải)
3. Tìm app **VR Quest** → mở

### Gỡ app (nếu cần)

```powershell
adb uninstall com.nvr.iaptest
```

---

## 7. Deploy nhanh bằng script tự động

Project có script `quest-deploy.ps1` tự động hóa toàn bộ quy trình.

### Full deploy (build frontend + build APK + install)

```powershell
.\quest-deploy.ps1
```

Script thực hiện:
1. Kiểm tra Quest kết nối qua ADB
2. Sync A-Frame components vào `public/`
3. Build frontend bằng Vite
4. Kiểm tra/khởi động server
5. Tăng `versionCode` tự động
6. Build APK bằng Gradle
7. Cài APK lên Quest qua ADB
8. Restart app trên Quest

### Quick deploy (chỉ update code, không build lại APK)

```powershell
.\quest-deploy.ps1 -SkipApk
```

Dùng khi: chỉ thay đổi code frontend/backend, không cần APK mới. Script sẽ build frontend, sync components, restart app. **Vì app là web-based, code mới sẽ tự load khi Quest Browser refresh.**

### Restart server

```powershell
.\quest-deploy.ps1 -RestartServer
```

Dùng khi: thay đổi code server (`server/index.js`). Script sẽ kill process server cũ và start mới.

---

## 8. Upload lên Meta Quest Store

### 8.1 Thông tin Meta App

| Field | Value |
|-------|-------|
| App ID | `34536747552582674` |
| App Secret | `1a691ec84398748160a621b25ccb8941` |
| Package Name | `com.nvr.iaptest` |
| Platform | ANDROID_6DOF |

### 8.2 Upload APK bằng ovr-platform-util

```powershell
cd quest-wrapper

.\ovr-platform-util.exe upload-quest-build `
    --app-id 34536747552582674 `
    --app-secret 1a691ec84398748160a621b25ccb8941 `
    --apk "app\build\outputs\apk\release\app-release.apk" `
    --channel ALPHA `
    --age-group TEENS_AND_ADULTS
```

**Giải thích các tham số:**

| Tham số | Ý nghĩa |
|---------|---------|
| `--app-id` | ID app trên Meta Developer Dashboard |
| `--app-secret` | Secret key của app (lấy từ Dashboard → API) |
| `--apk` | Đường dẫn tới file APK vừa build |
| `--channel` | Kênh phát hành: `ALPHA` (test nội bộ), `BETA`, `PRODUCTION` (public) |
| `--age-group` | `TEENS_AND_ADULTS` hoặc `MIXED_AGES` |

**Kết quả thành công:**
```
Upload successful!
Build ID: xxxxxxxx
```

### 8.3 Chuyển build từ ALPHA → Production

Khi đã test xong trên ALPHA và muốn submit lên Store:

1. Vào [Meta Developer Dashboard](https://developers.meta.com/horizon/manage/applications/34536747552582674)
2. **Release Channels** → **Production (Store)**
3. **Channel Actions** → **Change Current Build**
4. Chọn build vừa upload → Status: **Draft**
5. Submit

### 8.4 Test bằng ALPHA channel

1. Vào Dashboard → **Release Channels** → **ALPHA**
2. Thêm tài khoản test vào **Alpha Testers**
3. Trên Quest 2 (đăng nhập bằng tài khoản test), vào **Store** → tìm app → cài

---

## 9. Nộp app để Meta review

### 9.1 Chuẩn bị assets

| Asset | Kích thước | Yêu cầu |
|-------|------------|----------|
| App Icon | 512 x 512 PNG | **Phải có nền solid** (không transparent) |
| Landscape Cover | 2560 x 1440 PNG | Hình chính trên Store |
| Square Cover | 1440 x 1440 PNG | |
| Portrait Cover | 1008 x 1440 PNG | |
| Hero Cover | 3000 x 900 PNG | Có safe area — nội dung quan trọng đặt giữa |
| Screenshots | 2560 x 1440 PNG | Tối thiểu 3, tối đa 8 |

> Lưu assets trong thư mục `store-assets/` của project.

### 9.2 Điền thông tin trên Dashboard

Vào **Submissions** → điền 4 tab theo thứ tự:

#### Tab 1: App Metadata

**Name:**
- App Name: `VR Target Shooter` (tối đa 50 ký tự)
- Short Description: `Fast-paced VR target shooting game. Test your aim, earn coins, and unlock premium content!` (tối đa 150 ký tự, không ký tự đặc biệt ở đầu)

**Categorization:**
- Category: Games → Action
- Input methods: Controllers + Hand Tracking
- Languages: English

**Specs:**
- Supported headsets: Quest 2, Quest 3, Quest Pro
- Internet required: Yes
- Orientation: Landscape
- Space requirement: Standing/Sitting
- Keywords: `shooting`, `targets`, `arcade`, `action`, `vr` (từ đơn, không cụm từ)

**Details:**
- Website URL: (URL website hoặc privacy policy)
- **Privacy Policy URL**: BẮT BUỘC — phải publicly accessible (dùng Google Sites hoặc GitHub Pages)

**Assets:**
- Upload tất cả hình theo bảng trên
- Icon PHẢI có nền solid (không trong suốt) → nếu bị reject, vẽ solid rectangle rồi đặt icon lên

**Content Rating:**
- Set Country of Origin
- Set Developer Contact Email
- Click **Add Certificate** → **Request new**
- Hoàn thành bảng câu hỏi IARC (mở tab mới):
  - App type: Game
  - Violence: Mild fantasy (bắn target, không máu)
  - Digital purchases: Yes (có IAP)
  - User interaction: No
- Sau khi xong → certificate tự tạo với rating cho tất cả vùng

#### Tab 2: Pricing

- Listing Type: **Full release** (không thể thay đổi sau khi submit)
- Price: **Free** (có In-App Purchases)

#### Tab 3: Build

- Chọn build từ dropdown (phải có build trong **Production** channel, status **Draft**)
- Nếu dropdown trống → quay lại mục 8.3 để chuyển build sang Production
- "Does your app contain ads?" → No

#### Tab 4: Submission

- Contact Email: email để Meta liên hệ (không hiện công khai)
- Test credentials: No (hoặc Yes nếu có login)
- Notes for Reviewer: (tùy chọn, ghi chú cho team review)
- **App sharing preferences**: Click **View preferences** → **Confirm**
  - Mặc định bật: Casting, Livestreaming, Video recording

### 9.3 Submit

1. Click **Save Changes**
2. Click **Submit for Review**
3. Status chuyển thành **Submitted**

### 9.4 Sau khi submit

- Đợi Meta review (thường vài ngày)
- Nếu approved → chọn release ngay hoặc schedule
- Giá bị lock 30 ngày sau khi approved
- Giữa lúc approved và release, users có thể wishlist

---

## 10. Xử lý lỗi thường gặp

### Build errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `JAVA_HOME not set` | Chưa set biến môi trường | `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` |
| `SDK location not found` | Chưa set ANDROID_HOME | `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"` |
| `Could not resolve com.meta.androidbrowserhelper` | Không có internet hoặc Maven repo lỗi | Kiểm tra internet, retry |
| `Namespace not specified` | Thiếu namespace trong build.gradle | Đã có: `namespace 'com.nvr.iaptest'` |
| Gradle build timeout | RAM không đủ | Đóng bớt ứng dụng, thêm `org.gradle.jvmargs=-Xmx2g` vào `gradle.properties` |

### ADB errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `no devices/emulators found` | Quest chưa kết nối hoặc chưa authorize | Kiểm tra USB, đeo Quest chấp nhận popup |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Signing key khác | `adb uninstall com.nvr.iaptest` rồi install lại |
| `INSTALL_FAILED_OLDER_SDK` | minSdk cao hơn device | Kiểm tra `minSdkVersion` trong build.gradle |

### Meta Store upload errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `Duplicate version code` | versionCode trùng với lần upload trước | Tăng `versionCode` trong `build.gradle`, rebuild |
| `Horizon SDK not found` | APK thiếu androidbrowserhelper | Kiểm tra dependencies trong `build.gradle` |
| `Invalid app-secret` | Secret sai | Lấy lại từ Dashboard → API Settings |

### Store submission errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| Icon bị reject "solid background" | Icon có transparency | Dùng RGB mode, vẽ solid rect trước icon |
| Privacy Policy URL invalid | URL không public | Dùng Google Sites hoặc GitHub Pages |
| Keywords bị reject | Chứa cụm từ nhiều từ | Chỉ dùng từ đơn: `shooting`, `vr`, `arcade` |
| Build dropdown disabled | Build chưa có trong Production channel | Chuyển build từ ALPHA sang Production |
| Submit button disabled | Chưa điền hết các tab | Kiểm tra tất cả tab, confirm sharing preferences |

### App runtime errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| App mở nhưng trắng/loading mãi | Server chưa chạy hoặc domain chưa trỏ đúng | Kiểm tra `https://vr.proxyit.online` có accessible không |
| IAP không hoạt động | Chưa config IAP trên Dashboard | Tạo IAP add-ons trên Meta Developer Dashboard |
| "Not a Trusted Web Activity" | Domain verification thất bại | Kiểm tra `assetlinks.json` tại `https://vr.proxyit.online/.well-known/assetlinks.json` |

---

## 11. Tham khảo nhanh

### Commands hay dùng

```powershell
# === BUILD ===
.\quest-deploy.ps1                   # Full deploy (build + APK + install)
.\quest-deploy.ps1 -SkipApk         # Quick deploy (code only)
.\quest-deploy.ps1 -RestartServer   # Restart server

# === ADB ===
adb devices                          # Liệt kê devices
adb install -r <path-to-apk>        # Cài/update APK
adb uninstall com.nvr.iaptest       # Gỡ app
adb shell am force-stop com.nvr.iaptest  # Tắt app
adb shell monkey -p com.nvr.iaptest -c android.intent.category.LAUNCHER 1  # Mở app
adb logcat -s chromium               # Xem log browser trên Quest

# === STORE UPLOAD ===
.\quest-wrapper\ovr-platform-util.exe upload-quest-build `
    --app-id 34536747552582674 `
    --app-secret 1a691ec84398748160a621b25ccb8941 `
    --apk "quest-wrapper\app\build\outputs\apk\release\app-release.apk" `
    --channel ALPHA `
    --age-group TEENS_AND_ADULTS

# === SERVER ===
npm run dev                          # Dev mode (client + server)
npm run server                       # Server only
```

### Các file cần sửa khi thay đổi domain

Nếu đổi hostname từ `vr.proxyit.online` sang domain khác:

1. `quest-wrapper/app/build.gradle` → `hostName` và `fullScopeUrl`
2. `quest-wrapper/app/src/main/res/values/strings.xml` → `assetStatements`
3. `client/src/manifest.json` → `ovr_scope_url`
4. Tăng `versionCode`, rebuild APK, re-upload

### IAP Add-ons

| SKU | Loại | Giá | Meta ID |
|-----|------|-----|---------|
| `coin_pack_100` | Consumable | $0.99 | 1931951704084280 |
| `coin_pack_500` | Consumable | $3.99 | 1407190347865657 |
| `premium_unlock` | Durable | $4.99 | 1875017593156560 |

### Meta Developer Dashboard

```
https://developers.meta.com/horizon/manage/applications/34536747552582674/
```

---

## Quy trình tóm tắt

```
1. Code thay đổi
       ↓
2. npm run build (hoặc quest-deploy.ps1 làm tự động)
       ↓
3. .\quest-deploy.ps1         ← Cài lên Quest 2 qua USB
       ↓
4. Test trên Quest 2
       ↓
5. ovr-platform-util upload   ← Upload lên Meta Store (ALPHA)
       ↓
6. Test trên ALPHA channel
       ↓
7. Chuyển build → Production channel
       ↓
8. Điền metadata + assets + content rating
       ↓
9. Submit for Review
       ↓
10. Meta approve → Release
```
