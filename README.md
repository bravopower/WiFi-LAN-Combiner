# ⚡ WiFi-LAN Combiner — Internet Bonding & System-Wide TUN

<p align="center">
  <strong>Bond multiple internet connections (LAN + Wi-Fi) with real-time load balancing and whole-system TUN routing.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Language-English%20%7C%20فارسی-brightgreen" alt="Languages" />
</p>

---

## 🌐 Language / زبان

- [English](#-english-guide)
- [راهنمای فارسی](#-راهنمای-فارسی)

---

## 🇬🇧 English Guide

### Overview
**WiFi-LAN Combiner** is an open-source network bonding and bandwidth aggregation tool for Windows. It combines multiple internet connections (e.g., ADSL/VDSL/Fiber Ethernet + 4G/5G Wi-Fi hotspot) into a unified high-speed pipeline.

Unlike basic proxy wrappers, WiFi-LAN Combiner features **System-Wide TUN Mode** that intercepts and bonds traffic for **all** applications on your PC without needing manual proxy configuration.

### ✨ Key Features
- **True Bandwidth Aggregation:** Uses weighted round-robin distribution across physical network interfaces.
- **System-Wide TUN Mode:** Routes all Windows traffic (browsers, Steam, Epic Games, torrents, downloads) through the bonded pipe with 1 click.
- **Dedicated SOCKS5 Proxy:** Runs on `127.0.0.1:1080` for download managers like IDM.
- **Zero Heavy Dependencies:** Clean Node.js engine with zero npm dependencies.
- **Modern Glassmorphic Web Dashboard:** Real-time speedometers, bandwidth history graph, ping health checks, and live connection stream.
- **Failover & Auto-Calibration:** Automatically benchmarks line speeds and balances weights dynamically.

---

### 🚀 Quick Start (English)

#### 1. Prerequisites
- **Windows 10 / 11**
- **Node.js** (LTS recommended, download from [nodejs.org](https://nodejs.org))
- At least **two active network connections** (e.g., LAN cable to Home Modem + Wi-Fi to Mobile Hotspot).

#### 2. Running NetLimir
1. Clone or download this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/wifi-lan-combiner.git
   cd wifi-lan-combiner
   ```
2. Run **`Start-Combiner.bat`** (or double-click the desktop shortcut created by `Create-Desktop-Shortcut.bat`).
3. Click **Yes** on the Windows UAC prompt (Administrator privileges are required to create the TUN interface).
4. The dashboard will automatically open at **`http://127.0.0.1:8888`**.

#### 3. Modes of Operation
| Mode | How to use | Best for |
|---|---|---|
| **Whole-System TUN** | Turn **ON** the purple **"System-Wide TUN Mode"** switch in the dashboard. | Browsers, Steam, Games, torrents, all Windows apps. |
| **IDM Only (SOCKS5)** | Keep the default blue switch on. In IDM: `Downloads -> Options -> Proxy/Socks -> SOCKS5: 127.0.0.1:1080`. | Isolated downloading without altering system routes. |

---

## 🇮🇷 راهنمای فارسی

### معرفی نرم‌افزار
**WiFi-LAN Combiner** ابزاری برای ادغام و تجمیع همزمان پهنای باند دو یا چند اتصال اینترنت (مانند کابل شبکه مودم خانگی + وای‌فای گوشی/مودم همراه) در ویندوز است.

این نرم‌افزار مجهز به قابلیت **TUN Mode (تونل کل سیستم)** است که بدون نیاز به تنظیم پروکسی در هیچ برنامه‌ای، تمامی ترافیک ویندوز را به صورت خودکار از هر دو خط عبور می‌دهد.

### ✨ ویژگی‌های برجسته
- **ادغام واقعی سرعت دانلود:** ترکیب هوشمند اتصالات روی کارت‌های شبکه فیزیکی.
- **حالت تونل کل سیستم (TUN Mode):** هدایت خودکار تمام بازی‌ها، استیم، مرورگرها و دانلودها به سمت اینترنت ادغام‌شده.
- **پشتیبانی کامل از IDM:** سرور SOCKS5 روی پورت ۱۰۸۰ برای استفاده اختصاصی در دانلود منیجر.
- **بدون وابستگی اضافه:** پیاده‌سازی سبک با ماژول‌های داخلی Node.js بدون نیاز به پکیج‌های سنگین npm.
- **داشبورد گرافیکی زیبا:** نمایش نمودار زنده سرعت لحظه‌ای، حجم مصرفی، پینگ هر خط و لاگ زنده اتصالات.
- **سیستم Failover خودکار:** در صورت قطع شدن یک خط، ترافیک بدون افت کارکرد به کارت شبکه دیگر منتقل می‌شود.

---

### 🚀 نحوه اجرا و استفاده (فارسی)

#### ۱. پیش‌نیازها
- **ویندوز ۱۰ یا ۱۱**
- نصب بودن **Node.js** (نسخه رایگان LTS از [nodejs.org](https://nodejs.org))
- اتصال همزمان به دو اینترنت (مثلاً کابل LAN به مودم ADSL/فیبر + وای‌فای به هات‌اسپات گوشی).

#### ۲. اجرا
1. فایل **`Start-Combiner.bat`** را اجرا کنید (یا از طریق شرت‌کات ساخته شده با `Create-Desktop-Shortcut.bat`).
2. پیغام دسترسی Administrator (UAC ویندوز) را با زدن **Yes** تایید کنید (این دسترسی برای ساخت کارت شبکه مجازی TUN ضروری است).
3. داشبورد برنامه به صورت خودکار در آدرس **`http://127.0.0.1:8888`** باز می‌شود.

#### ۳. انتخاب حالت کاربری
- **حالت کل سیستم (TUN):** کلید بنفش‌رنگ **«حالت کل سیستم (TUN Mode)»** را در بالای داشبورد روشن کنید تا کل ویندوز از دو خط ادغام‌شده استفاده کند.
- **حالت انحصاری IDM:** فقط در IDM وارد منوی `Downloads -> Options -> Proxy / Socks` شوید و پروکسی را روی `SOCKS5: 127.0.0.1:1080` تنظیم کنید.

---

## 📁 Project Structure / ساختار پروژه

```
wifi-lan-combiner/
├── Start-Combiner.bat          # Main launcher (checks admin and opens UI)
├── Create-Desktop-Shortcut.bat # One-click desktop shortcut creator
├── LICENSE                     # MIT Open Source License
├── README.md                   # Bilingual Documentation (English & Persian)
├── bin/
│   ├── sing-box.exe            # High-performance TUN engine
│   └── wintun.dll              # Official Windows TUN driver
├── src/
│   ├── server.js               # Central HTTP API and static file server
│   ├── combiner.js             # SOCKS5 Load balancer with failover & ping
│   └── tun.js                  # Windows TUN lifecycle manager
└── web/
    ├── index.html              # Modern glassmorphism UI
    ├── style.css               # Dark cyberpunk theme styles
    └── app.js                  # Real-time dashboard controller
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
