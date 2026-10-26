"""
PocketGravity Native Windows Desktop Application Launcher.
Starts the backend daemon in a non-blocking background thread and launches
a standalone, borderless desktop application window with zero browser clutter.
"""
import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Ensure Python Virtual Environment is used
VENV_PYTHON = BASE_DIR / ".venv" / "Scripts" / "python.exe"
PYTHON_BIN = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

from server.config import get_tailscale_ip, AUTH_TOKEN, PORT

# Dynamically resolve Tailscale IP (e.g. 100.85.60.37) or fallback to 127.0.0.1
TS_IP = get_tailscale_ip()
ACCESS_HOST = TS_IP if TS_IP else "127.0.0.1"
TOKEN = AUTH_TOKEN
APP_URL = f"http://{ACCESS_HOST}:{PORT}/?token={TOKEN}"

def is_server_running() -> bool:
    import urllib.request
    for test_host in [ACCESS_HOST, "127.0.0.1", "localhost"]:
        try:
            req = urllib.request.Request(f"http://{test_host}:{PORT}/api/system/status")
            req.add_header("Authorization", f"Bearer {TOKEN}")
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            continue
    return False

def start_backend_daemon():
    if is_server_running():
        print("[OK] PocketGravity Daemon is already active on port 8000.")
        return None

    print("[STARTING] Launching PocketGravity Daemon on 0.0.0.0:8000...")
    cmd = [
        PYTHON_BIN,
        "-m",
        "uvicorn",
        "server.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000"
    ]
    
    # Windows creation flag for fully detached background process (no console popups)
    DETACHED_PROCESS = 0x00000008
    CREATE_NO_WINDOW = 0x08000000
    
    proc = subprocess.Popen(
        cmd,
        cwd=str(BASE_DIR),
        creationflags=DETACHED_PROCESS | CREATE_NO_WINDOW,
        close_fds=True
    )
    
    # Wait up to 6 seconds for daemon to initialize
    for _ in range(12):
        time.sleep(0.5)
        if is_server_running():
            print("[CONNECTED] Backend Daemon is fully operational!")
            break
            
    return proc

def launch_native_window():
    """
    Launches a dedicated standalone desktop app window (Chrome/Edge App Mode).
    Runs as an independent desktop window with no browser navigation bar or tabs.
    """
    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
    ]
    chrome_paths = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]

    browser_bin = None
    for p in edge_paths + chrome_paths:
        if os.path.exists(p):
            browser_bin = p
            break

    profile_dir = BASE_DIR / ".desktop_profile"
    # Clean cache folders inside .desktop_profile so desktop app never runs stale bundles
    for cache_sub in ["Cache", "Code Cache", "GPUCache"]:
        c_path = profile_dir / "Default" / cache_sub
        if c_path.exists():
            try:
                import shutil
                shutil.rmtree(c_path, ignore_errors=True)
            except Exception:
                pass

    url_with_buster = f"{APP_URL}&_t={int(time.time())}"

    if browser_bin:
        print(f"[LAUNCH] Opening Native Desktop Window via: {os.path.basename(browser_bin)}")
        args = [
            browser_bin,
            f"--app={url_with_buster}",
            f"--user-data-dir={str(profile_dir)}",
            "--window-size=1280,840",
            "--app-id=PocketGravity",
            "--disable-http-cache",
            "--disk-cache-size=1"
        ]
        subprocess.Popen(args)
    else:
        print("[FALLBACK] Opening in default web browser...")
        webbrowser.open(url_with_buster)

def main():
    print("=" * 60)
    print("   PocketGravity 2.1 - Windows Desktop Application")
    print(f"   Access URL: {APP_URL}")
    print("=" * 60)
    start_backend_daemon()
    launch_native_window()
    print("Desktop Application launched successfully.")

if __name__ == "__main__":
    main()
