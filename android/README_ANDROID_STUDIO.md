# 📱 PocketGravity Android App (Android Studio Guide)

This directory contains the ready-to-run Android Studio project for **PocketGravity**.

---

## 🚀 How to Open and Run in Android Studio

### Step 1: Open in Android Studio
1. Launch **Android Studio**.
2. Click **Open** (or `File` -> `Open`).
3. Browse and select the directory:
   ```
   E:\pocketgravity\android
   ```
4. Click **OK**. Android Studio will sync Gradle automatically.

---

### Step 2: Connect Your Phone (`moto-g57-power`)
1. On your phone, enable **Developer Options** and turn on **USB Debugging** (or use **Wireless Debugging** over Wi-Fi).
2. Connect your phone to your laptop.
3. Select `moto-g57-power` from the device dropdown in Android Studio toolbar.

---

### Step 3: Run the App
1. Click the green **Run (▶)** button (or press `Shift + F10`).
2. Android Studio will build and install the APK on your phone.
3. The app will launch and automatically connect to:
   ```
   http://100.85.60.37:8000/?token=pocketgravity_secret_token_123
   ```

---

## ⚙️ Architecture & Features

1. **Pre-Configured Tailscale Connection:**
   - Target host is already configured to your laptop's Tailscale IP: `http://100.85.60.37:8000`.
   - Token is injected into the initial request and stored securely in Android `SharedPreferences` + Web `localStorage`.

2. **Zero-Trust Network Clearance:**
   - [`network_security_config.xml`](file:///e:/pocketgravity/android/app/src/main/res/xml/network_security_config.xml) allows cleartext HTTP communication through the Tailscale WireGuard subnet (`100.64.0.0/10`) on Android 9+.

3. **Full Native Integration:**
   - **Hardware Acceleration:** Smooth 60fps animations.
   - **DOM & Database Storage:** Keeps agent/claude conversation cache on the phone.
   - **File Download Listener:** Tapping download on any file uses the native Android `DownloadManager` to save to your phone's `Downloads` folder.
   - **Pull to Refresh:** Swipe down from the top to reload.
   - **Offline / Disconnect Shield:** Displays a reconnect button and configuration modal if the laptop is sleeping or Tailscale is disconnected.

---

## 💻 Laptop Application

On your laptop, you can launch the native Windows desktop application at any time:
* Double-click [`E:\pocketgravity\PocketGravity-Desktop.bat`](file:///e:/pocketgravity/PocketGravity-Desktop.bat) or [`PocketGravity-Desktop.vbs`](file:///e:/pocketgravity/PocketGravity-Desktop.vbs).
* It starts the backend daemon in the background and opens a standalone native desktop window (no address bar or browser tabs).
