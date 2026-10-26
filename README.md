# PocketGravity 🪐

**PocketGravity** is a secure, self-hosted Remote Workspace Manager that lets you control, edit, monitor, and execute commands on your laptop directly from your smartphone over your private network (Tailscale or local Wi-Fi).

All files, virtual environments, caches, and node modules are strictly isolated on the **`E:\` drive** with zero footprint on `C:\`.

---

## 📱 Features

1. **Mobile-First Progressive Web App (PWA)**:
   - Designed specifically for smartphone viewports (375px–430px) with dark mode by default.
   - Installable on iOS Safari ("Add to Home Screen") and Android Chrome with standalone app experience.
2. **System Health & Hardware Telemetry**:
   - Real-time CPU usage %, core counts, frequency.
   - RAM utilization (Used / Total in GB).
   - Battery level %, charging status indicator.
   - Drive storage metrics (E:\ drive space).
   - Laptop uptime and OS node specifications.
3. **Workspace File Explorer & Mobile Code Editor**:
   - Fast directory tree excluding build caches (`.git`, `node_modules`, `__pycache__`, `.venv`).
   - Mobile-optimized code editor with line number gutter, zoom controls (`+` / `-`), auto-indent, and touch scrolling.
   - **Safe File Saving**: Automatically generates a backup (`.bak_<timestamp>`) before overwriting existing files.
   - **Download to Phone**: Directly download binary or code files to your mobile device with one tap.
   - Create files and directories from your phone.
4. **Live Streaming Terminal (WebSocket)**:
   - Real-time streaming `stdout` and `stderr` execution logs.
   - ANSI color formatting support.
   - One-tap quick action chips: `NPM Dev`, `Git Status`, `Git Diff`, `List Files`, `Python Test`.
   - Process manager: Displays active child process PID with an instant **"Stop / Kill"** button that safely terminates process trees.
   - Auto-reconnect with backoff when phone screen wakes up.
5. **Antigravity Task Dispatch & Git Diff Inspector**:
   - Write instruction prompts or shell tasks and dispatch them to the terminal runner.
   - Real-time Git Diff viewer highlighting uncommitted additions (`+`) and deletions (`-`).
6. **Robust Security & Path Traversal Safeguards**:
   - Strict Bearer token authentication required for all API endpoints and WebSocket links.
   - Strict `pathlib` traversal defense: all paths are resolved and validated against `WORKSPACE_ROOT`. Any directory escape attempts (e.g. `../../`) are rejected with `HTTP 403 Forbidden`.

---

## 📂 Project Architecture

```
E:\pocketgravity\
├── .env                  # Secret AUTH_TOKEN and WORKSPACE_ROOT settings
├── .env.example          # Environment template
├── requirements.txt      # Python dependencies (FastAPI, uvicorn, psutil, websockets)
├── run.bat               # Windows 1-click startup script (0.0.0.0:8000)
├── run.sh                # Linux / macOS startup script
├── README.md
├── server/               # Python Backend Daemon
│   ├── main.py           # FastAPI app, CORS, routes & SPA static mount
│   ├── config.py         # Workspace root and security limits
│   ├── auth.py           # Bearer token validation and WebSocket security
│   ├── workspace.py      # Tree, File read/write, Download, and Git Diff
│   ├── terminal.py       # Asynchronous process execution & WebSocket streamer
│   └── system.py         # Hardware telemetry via psutil
└── client/               # Mobile PWA Frontend (React + Vite + Tailwind CSS)
    ├── package.json
    ├── vite.config.js
    ├── index.html        # Mobile viewport & PWA meta tags
    ├── public/
    │   ├── manifest.json # PWA standalone manifest
    │   └── favicon.svg
    ├── dist/             # Production build served directly by FastAPI
    └── src/
        ├── App.jsx
        ├── api.js        # HTTP and WebSocket client with localStorage auth
        └── components/
            ├── Header.jsx          # Latency, battery & connection badge
            ├── BottomNav.jsx       # 4-tab mobile navigation bar
            ├── DashboardTab.jsx    # System resource gauges
            ├── FilesTab.jsx        # Tree explorer
            ├── FileTree.jsx        # Recursive collapsible file list
            ├── CodeEditor.jsx      # Mobile code editor with line numbers
            ├── TerminalTab.jsx     # Streaming console with quick chips
            ├── TerminalOutput.jsx  # Colored ANSI log viewer
            ├── PromptTab.jsx       # Task prompt & Git Diff inspector
            └── SettingsModal.jsx   # Tailscale IP & Token configuration
```

---

## 🚀 Quick Start

### 1. Start the Server Daemon
Simply double-click or run:
```powershell
E:\pocketgravity\run.bat
```
This automatically finds your local / Tailscale IP addresses and binds the server to:
```
http://0.0.0.0:8000
```

### 2. Connect from Your Phone

1. **Option A: Tailscale (Recommended for anywhere access)**:
   - Install Tailscale on your laptop and smartphone.
   - Find your laptop’s Tailscale IP (e.g., `100.101.102.103`) via the Tailscale app.
   - Open your mobile browser (Safari / Chrome) and navigate to:
     ```
     http://100.101.102.103:8000
     ```

2. **Option B: Local Wi-Fi**:
   - Connect phone and laptop to the same Wi-Fi.
   - Navigate to `http://<laptop-local-ip>:8000`.

3. **Authenticate**:
   - The default bearer token is:
     ```
     pocketgravity_secret_token_123
     ```
   - Tap the **Settings** gear icon in the top right to verify or update your token.
   - Tap **"Add to Home Screen"** in Safari / Chrome to install PocketGravity as a full-screen native-like app!

---

## ⚙️ Running in the Background (Headless)

### Windows Background Service (VBScript or Task Scheduler)
To run PocketGravity silently without a command prompt window:

Create a file `E:\pocketgravity\silent_run.vbs`:
```vbscript
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "E:\pocketgravity\run.bat", 0
Set WshShell = Nothing
```
Double-clicking `silent_run.vbs` will launch PocketGravity completely in the background.

To start automatically at Windows login:
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut to `silent_run.vbs` inside the Startup folder.

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/verify` | Validates Bearer authentication token |
| `GET` | `/api/system/status` | Returns CPU, RAM, battery, uptime, and disk telemetry |
| `GET` | `/api/workspace/tree` | Returns filtered workspace directory hierarchy |
| `GET` | `/api/workspace/file?path=...` | Reads UTF-8 file contents |
| `POST` | `/api/workspace/file` | Writes file content (creates `.bak` backup) |
| `GET` | `/api/workspace/download?path=...` | Downloads file attachment |
| `GET` | `/api/workspace/diff` | Returns Git status and diffs |
| `POST` | `/api/workspace/action` | Creates files/folders, renames, deletes |
| `WS` | `/ws/terminal?token=...` | Bidirectional real-time interactive terminal |

---

## 🔒 Security Notes
- All routes require the `AUTH_TOKEN` defined in `E:\pocketgravity\.env`.
- Directory paths are strictly resolved inside `WORKSPACE_ROOT`. Attempts to traverse outside using `..` are immediately blocked.
