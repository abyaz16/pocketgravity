# 🪐 PocketGravity: Complete System Logic & Algorithm Map

This document details the whole system architecture, every algorithm used, security defenses, and data flow pipelines powering **PocketGravity & Antigravity Remote Control**.

---

## 🗺️ 1. End-to-End System Topology Map

```
+--------------------------------------------------------------------------------------------------------+
|                                        MOBILE CLIENT (PWA)                                             |
|                                                                                                        |
|  [SimpleHeader]                                                                                        |
|    ├── Connection Status Beacon (Green/Red Heartbeat)                                                  |
|    ├── Folder Selector Modal (e:\pocketgravity <-> e:\Airbnb <-> Custom)                               |
|    └── QR Pairing Modal (Instant pairing over Tailscale/Wi-Fi)                                        |
|                                                                                                        |
|  [Active Navigation Tabs]                                                                              |
|    ├── CleanAgentTab:   Antigravity IDE live agent feed, tool execution badges, prompt injection       |
|    ├── CleanClaudeTab:  Claude Code live stream, tool usage chips, CLI execution tracker               |
|    ├── LocalhostWebTab: Reverse-proxied laptop web dev servers (Vite :5173, Next.js :3000)            |
|    └── FilesTab:        Mobile file explorer, safe code editor, file downloader, and git diff viewer  |
+--------------------------------------------------------------------------------------------------------+
                                                    |
                   Zero-Trust Network Boundary (Tailscale WireGuard / LAN)
                   Cryptographic Bearer Token: <AUTH_TOKEN from .env>
                                                    v
+--------------------------------------------------------------------------------------------------------+
|                                    FASTAPI BACKEND DAEMON (0.0.0.0:8000)                               |
|                                                                                                        |
|  [Network Security Layer]                                                                              |
|    ├── IP Brute-Force Rate Limiting (Sliding 10-minute window, automatic 1-hour IP ban)                |
|    ├── Tailscale CGNAT Validator (100.64.0.0/10 CIDR check)                                            |
|    └── Constant-Time Token Comparator (secrets.compare_digest)                                         |
|                                                                                                        |
|  [Static Asset Server]                                                                                 |
|    └── Serves pre-built Vite React PWA from `client/dist/` (zero Node.js runtime required at runtime)  |
+--------------------------------------------------------------------------------------------------------+
         |                       |                       |                      |
         v                       v                       v                      v
+------------------+    +------------------+    +------------------+   +------------------+
|  Antigravity IDE |    |   Claude Code    |    |  Workspace & PTY |   | Hardware Monitor |
|  Brain & Control |    |   Stream Engine  |    |  File Operations |   | & Remote Desktop |
+------------------+    +------------------+    +------------------+   +------------------+
         |                       |                       |                      |
         v                       v                       v                      v
- SQLite Metadata DB    - ~/.claude/projects/   - Safe Path Resolver   - psutil Telemetry
  (trajectory_metadata)   session JSONLs          (Relative-to-root)     (CPU, RAM, Batt)
- transcript.jsonl      - Session UUID sniffer  - Timestamped Backups  - Pillow Screen Grab
- Win32 UIA Injector      via psutil              (.bak_<timestamp>)     (Downscaled JPEG)
- Win11 Lock Breaker    - CLI process runner    - WebSocket Terminal   - Win32 Mouse & Key
  (Alt-key pulse)                                 (Tree kill via PID)    Event Injections
```

---

## ⚡ 2. Core Logic & Algorithms in Detail

### Algorithm 1: Antigravity SQLite Trajectory Workspace Isolation
* **Location:** [`server/antigravity.py`](file:///e:/pocketgravity/server/antigravity.py)
* **Problem Solved:** When users work across multiple projects (e.g. `pocketgravity` and `Airbnb`), earlier approaches leaked previous project conversations or fell back to the wrong chat.
* **Logic:**
  1. Inspects `~/.gemini/antigravity-ide/conversations/*.db`.
  2. For each conversation SQLite database, queries `SELECT data FROM trajectory_metadata_blob WHERE id='main';`.
  3. Extracts the workspace URI (e.g., `file:///e:/pocketgravity` or `file:///e:/Airbnb`).
  4. Matches against the currently selected folder name.
  5. Returns `None` and an empty message list if the selected workspace has no conversation yet—**never leaks another workspace's conversation**.

---

### Algorithm 2: Claude Code Project & Session Detection
* **Location:** [`server/claude.py`](file:///e:/pocketgravity/server/claude.py)
* **Logic:**
  1. Scans `~/.claude/projects/` directory.
  2. Cleans and normalizes folder names (e.g., `e--pocketgravity` -> `pocketgravity`).
  3. Uses `psutil` to inspect running processes for active `claude.exe` arguments containing `--resume=<uuid>`.
  4. If a running session matches the active folder, immediately binds to `<uuid>.jsonl`.
  5. Otherwise, resolves the latest modified `.jsonl` transcript file strictly within that project's folder.

---

### Algorithm 3: Windows 11 Foreground Lock Breaker & Win32 Injection
* **Location:** [`server/injector.py`](file:///e:/pocketgravity/server/injector.py)
* **Problem Solved:** Windows 10/11 prevents background daemons from stealing focus and typing into applications (`SetForegroundWindow` lock).
* **Logic:**
  1. Attaches the daemon worker thread to the active user desktop session:
     ```python
     hwinsta = user32.OpenWindowStationW('WinSta0', False, 0x37F)
     user32.SetProcessWindowStation(hwinsta)
     hdesk = user32.OpenInputDesktop(0, False, 0x1FF)
     user32.SetThreadDesktop(hdesk)
     ```
  2. Simulates an **Alt-key pulse** (`keybd_event(VK_MENU, ...)`), which bypasses Windows foreground restrictions.
  3. Calls `AttachThreadInput` to link daemon input queue with the Antigravity IDE window thread.
  4. Sends focus hotkey (`Ctrl+L` for Agent or opens terminal for Claude), copies prompt to clipboard using `pyperclip`, and simulates `Ctrl+V` followed by `Enter`.

---

### Algorithm 4: Strict Path Traversal Defense & Workspace Security
* **Location:** [`server/workspace.py`](file:///e:/pocketgravity/server/workspace.py)
* **Problem Solved:** Prevents directory escape attacks (e.g., `../../Windows/System32`).
* **Logic:**
  1. Takes user input `rel_path` and cleans leading slashes.
  2. Computes `target = (get_workspace_root() / clean_rel).resolve()`.
  3. Invokes `target.relative_to(get_workspace_root())`.
  4. If `ValueError` is caught, immediately aborts and returns `HTTP 403 Forbidden`.

---

### Algorithm 5: Safe Atomic File Save with Timestamped Rollback Backup
* **Location:** [`server/workspace.py`](file:///e:/pocketgravity/server/workspace.py)
* **Logic:**
  1. Resolves safe destination path.
  2. If the file already exists and `create_backup` is enabled, creates a snapshot:
     ```python
     timestamp = int(time.time())
     backup_path = file_path.with_name(f"{file_path.name}.bak_{timestamp}")
     shutil.copy2(file_path, backup_path)
     ```
  3. Atomically overwrites the file with UTF-8 encoding.
  4. Returns the created backup path to the mobile client for one-tap rollback.

---

### Algorithm 6: WebSocket Streaming Interactive Terminal & Process Tree Termination
* **Location:** [`server/terminal.py`](file:///e:/pocketgravity/server/terminal.py)
* **Logic:**
  1. Spawns asynchronous child shell (`powershell.exe` on Windows).
  2. Binds bidirectional pipes: incoming WebSocket frames are written to process `stdin`.
  3. Asynchronous loop reads `stdout` and `stderr` in chunks, sending UTF-8 encoded text over the WebSocket.
  4. On process kill request, terminates the entire process tree using `psutil.Process(pid).children(recursive=True)` to prevent orphan background processes.

---

### Algorithm 7: Reverse Proxy & Dynamic Localhost Port Sniffer
* **Location:** [`server/proxy.py`](file:///e:/pocketgravity/server/proxy.py)
* **Problem Solved:** Mobile browsers cannot directly reach `localhost:5173` on the laptop.
* **Logic:**
  1. Inspects active TCP listening sockets via `psutil.net_connections()`.
  2. Auto-detects running dev servers (e.g., Vite on 5173, Next.js on 3000, Flask on 5000).
  3. Forwards mobile HTTP requests from `/api/proxy/*` to the detected localhost dev port.
  4. Streams responses back to the mobile phone, rewriting headers and links seamlessly.

---

### Algorithm 8: Mobile Frontend Auto-Scroll & Race-Guard State Machine
* **Location:** [`client/src/components/CleanAgentTab.jsx`](file:///e:/pocketgravity/client/src/components/CleanAgentTab.jsx), [`CleanClaudeTab.jsx`](file:///e:/pocketgravity/client/src/components/CleanClaudeTab.jsx)
* **Problems Solved:**
  1. Reading earlier chat messages caused page to snap back to the bottom when new tokens arrived.
  2. Switching folders temporarily showed previous folder chat while fetching.
* **Logic:**
  1. **Scroll Guard:** Measures distance from bottom:
     ```javascript
     const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
     isUserScrolledUp.current = distanceFromBottom > 100;
     ```
     Auto-scroll only triggers if `!isUserScrolledUp.current`.
  2. **Race Guard:** On folder change, immediately clears `setMessages([])` and tags active requests with `activeFolderRef.current`. If an asynchronous response arrives for an old folder, it is discarded.

---

## 🧪 3. Executable Test Suite Summary

The test file [`test_pocketgravity_logic.py`](file:///e:/pocketgravity/test_pocketgravity_logic.py) validates all 10 systems:

| Test ID | System Tested | Result |
| :--- | :--- | :--- |
| **TEST 1** | Auth Token & Sliding-Window IP Brute-Force Defense | ✅ **PASSED** |
| **TEST 2** | Strict Path Traversal Defense (HTTP 403) | ✅ **PASSED** |
| **TEST 3** | Dynamic Workspace Folder Resolution | ✅ **PASSED** |
| **TEST 4** | Antigravity SQLite Trajectory Workspace Isolation | ✅ **PASSED** |
| **TEST 5** | Transcript JSONL Parser & Tool Execution Extraction | ✅ **PASSED** |
| **TEST 6** | Claude Code Project Folder & Session Isolation | ✅ **PASSED** |
| **TEST 7** | Safe File Write with Automated `.bak_<timestamp>` | ✅ **PASSED** |
| **TEST 8** | Hardware Telemetry Gauges (CPU, RAM, Disk, OS) | ✅ **PASSED** |
| **TEST 9** | Desktop Screenshot Capture & Downscaled JPEG Compression | ✅ **PASSED** |
| **TEST 10** | Workspace File Tree Generator & Cache Exclusion | ✅ **PASSED** |

### Running the Tests:
```powershell
python test_pocketgravity_logic.py
```
*(All 10 tests execute synchronously in ~0.30 seconds)*
