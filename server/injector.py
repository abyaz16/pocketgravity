"""
Antigravity IDE Prompt Injector & Window Automation Engine.
Enables instant remote prompt submission into Antigravity IDE's active Claude Code
and Agent tabs from mobile phone over Wi-Fi/Tailscale without mouse coordinate guessing.
"""
import ctypes
from ctypes import wintypes
import time
import os
import pyperclip
from typing import Optional, Tuple

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

WINSTA_ALL = 0x37F
DESKTOP_ALL = 0x1FF

def attach_to_desktop():
    """Ensures execution thread is attached to interactive WinSta0 user desktop."""
    try:
        hwinsta = user32.OpenWindowStationW('WinSta0', False, WINSTA_ALL)
        if hwinsta:
            user32.SetProcessWindowStation(hwinsta)
        hdesk = user32.OpenInputDesktop(0, False, DESKTOP_ALL)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
    except Exception:
        pass

def find_antigravity_window(folder_hint: Optional[str] = None) -> Tuple[Optional[int], Optional[str]]:
    """
    Finds the Antigravity IDE window handle (HWND) and title.
    Prioritizes the window matching folder_hint (e.g. 'Airbnb', 'pocketgravity').
    Falls back to any open Antigravity IDE window.
    """
    attach_to_desktop()
    found = []

    def enum_proc(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                if "Antigravity" in title or "Code" in title:
                    found.append((hwnd, title))
        return True

    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(EnumWindowsProc(enum_proc), 0)

    if folder_hint:
        hint_clean = os.path.basename(str(folder_hint)).lower().replace("-", "").replace("_", "")
        for hwnd, title in found:
            title_clean = title.lower().replace("-", "").replace("_", "")
            if hint_clean in title_clean:
                return hwnd, title

    if found:
        return found[0]
    return None, None

def force_foreground(hwnd: int) -> bool:
    """
    Reliably brings the target window to the active foreground on Windows 10/11.
    Attaches current thread to both the active foreground window thread and the target
    window thread, pulses the Alt key to bypass Windows foreground locks, and maximizes
    the IDE window.
    """
    attach_to_desktop()
    try:
        cur_thread = kernel32.GetCurrentThreadId()
        fg_hwnd = user32.GetForegroundWindow()
        fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
        target_thread = user32.GetWindowThreadProcessId(hwnd, None)

        # Attach to current foreground window thread to inherit foreground activation rights
        if fg_thread and fg_thread != cur_thread:
            user32.AttachThreadInput(cur_thread, fg_thread, True)
        if target_thread and target_thread != cur_thread:
            user32.AttachThreadInput(cur_thread, target_thread, True)

        # Alt-key pulse to unlock foreground lock on Windows 10/11
        user32.keybd_event(0x12, 0, 0x0000, 0)  # VK_MENU (Alt) DOWN
        user32.keybd_event(0x12, 0, 0x0002, 0)  # VK_MENU (Alt) UP
        time.sleep(0.05)

        # Maximize IDE window to ensure all panes are fully visible and laid out
        user32.ShowWindow(hwnd, 3)  # SW_MAXIMIZE
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
        user32.SetActiveWindow(hwnd)
        user32.SwitchToThisWindow(hwnd, True)

        if fg_thread and fg_thread != cur_thread:
            user32.AttachThreadInput(cur_thread, fg_thread, False)
        if target_thread and target_thread != cur_thread:
            user32.AttachThreadInput(cur_thread, target_thread, False)

        time.sleep(0.35)
        return True
    except Exception:
        return False

def focus_target_input(hwnd: int, target: str):
    """
    Focuses the target chat input box using Antigravity IDE native shortcuts:
    - 'agent': Ctrl+L (Focuses Antigravity Agent Chat input, with robust webview mounting delay)
    - 'claude': Ctrl+Shift+P -> 'Claude Code: Focus input' -> Enter
    """
    if target == "agent":
        # Dismiss any lingering autocomplete or palette popup
        user32.keybd_event(0x1B, 0, 0x0000, 0)  # ESC DOWN
        time.sleep(0.04)
        user32.keybd_event(0x1B, 0, 0x0002, 0)  # ESC UP
        time.sleep(0.10)

        # First Ctrl+L: Opens or shifts focus to Antigravity Chat pane
        user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl down
        user32.keybd_event(0x4C, 0, 0x0000, 0)  # 'L' down
        time.sleep(0.06)
        user32.keybd_event(0x4C, 0, 0x0002, 0)  # 'L' up
        user32.keybd_event(0x11, 0, 0x0002, 0)  # Ctrl up
        # Wait 350ms to allow Electron / VS Code webview pane to mount and initialize input
        time.sleep(0.35)

        # Second Ctrl+L: Directly guarantees focus inside the chat input box
        user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl down
        user32.keybd_event(0x4C, 0, 0x0000, 0)  # 'L' down
        time.sleep(0.06)
        user32.keybd_event(0x4C, 0, 0x0002, 0)  # 'L' up
        user32.keybd_event(0x11, 0, 0x0002, 0)  # Ctrl up
        time.sleep(0.25)
    else:  # claude
        # Send Ctrl+Shift+P to open Command Palette
        user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl
        user32.keybd_event(0x10, 0, 0x0000, 0)  # Shift
        user32.keybd_event(0x50, 0, 0x0000, 0)  # P
        time.sleep(0.06)
        user32.keybd_event(0x50, 0, 0x0002, 0)
        user32.keybd_event(0x10, 0, 0x0002, 0)
        user32.keybd_event(0x11, 0, 0x0002, 0)
        time.sleep(0.30)

        # Clear existing text in command palette and paste >Claude Code: Focus input
        user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl
        user32.keybd_event(0x41, 0, 0x0000, 0)  # A
        time.sleep(0.04)
        user32.keybd_event(0x41, 0, 0x0002, 0)
        user32.keybd_event(0x11, 0, 0x0002, 0)
        time.sleep(0.05)

        pyperclip.copy(">Claude Code: Focus input")
        user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl
        user32.keybd_event(0x56, 0, 0x0000, 0)  # V
        time.sleep(0.06)
        user32.keybd_event(0x56, 0, 0x0002, 0)
        user32.keybd_event(0x11, 0, 0x0002, 0)
        time.sleep(0.30)

        # Press Enter to execute command
        user32.keybd_event(0x0D, 0, 0x0000, 0)
        time.sleep(0.06)
        user32.keybd_event(0x0D, 0, 0x0002, 0)
        # Give Claude Code webview panel time to mount and focus if opening for first time
        time.sleep(0.85)

def inject_prompt_to_window(prompt: str, target: str = "claude", folder_hint: Optional[str] = None) -> dict:
    """
    Directly injects the prompt into Antigravity IDE on the laptop desktop:
    1. Locates the correct IDE window for the workspace.
    2. Brings it to the active foreground and maximizes it.
    3. Focuses the chat input (Agent via dual Ctrl+L, Claude via Command Palette).
    4. Clears previous text and pastes the prompt via clipboard.
    5. Sends Enter to trigger execution.
    """
    attach_to_desktop()
    prompt = prompt.strip()
    if not prompt:
        return {"status": "error", "message": "Empty prompt"}

    hwnd, title = find_antigravity_window(folder_hint)
    if not hwnd:
        return {"status": "error", "message": "Antigravity IDE window not found on laptop."}

    # Bring window to front and maximize
    force_foreground(hwnd)

    # Focus chat input
    focus_target_input(hwnd, target)

    # Copy prompt to Windows clipboard
    pyperclip.copy(prompt)
    time.sleep(0.12)

    # Select existing text and replace before pasting
    user32.keybd_event(0x11, 0, 0x0000, 0)  # Ctrl
    user32.keybd_event(0x41, 0, 0x0000, 0)  # A
    time.sleep(0.04)
    user32.keybd_event(0x41, 0, 0x0002, 0)
    user32.keybd_event(0x11, 0, 0x0002, 0)
    time.sleep(0.06)

    # Send Ctrl+V (Paste)
    user32.keybd_event(0x11, 0, 0x0000, 0)  # VK_CONTROL DOWN
    user32.keybd_event(0x56, 0, 0x0000, 0)  # 'V' DOWN
    time.sleep(0.08)
    user32.keybd_event(0x56, 0, 0x0002, 0)  # 'V' UP
    user32.keybd_event(0x11, 0, 0x0002, 0)  # VK_CONTROL UP
    time.sleep(0.20)

    # Send ENTER
    user32.keybd_event(0x0D, 0, 0x0000, 0)  # VK_RETURN DOWN
    time.sleep(0.08)
    user32.keybd_event(0x0D, 0, 0x0002, 0)  # VK_RETURN UP

    return {
        "status": "success",
        "target": target,
        "window": title,
        "prompt": prompt,
        "message": f"Prompt successfully submitted to {target.title()} in {title} on laptop!"
    }

def close_antigravity_window(folder_hint: Optional[str] = None, close_all: bool = False) -> dict:
    """
    Closes the Antigravity IDE window on the laptop cleanly using WM_CLOSE (0x0010).
    """
    attach_to_desktop()
    found = []

    def enum_proc(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                if "Antigravity" in title:
                    found.append((hwnd, title))
        return True

    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(EnumWindowsProc(enum_proc), 0)

    if not found:
        return {"status": "warning", "message": "No Antigravity IDE window currently open on laptop."}

    closed_titles = []
    if close_all:
        for hwnd, title in found:
            user32.PostMessageW(hwnd, 0x0010, 0, 0)
            closed_titles.append(title)
    else:
        target_hwnd = None
        target_title = None
        if folder_hint:
            hint_clean = os.path.basename(str(folder_hint)).lower()
            for hwnd, title in found:
                if hint_clean in title.lower():
                    target_hwnd = hwnd
                    target_title = title
                    break
        if not target_hwnd:
            target_hwnd, target_title = found[0]

        user32.PostMessageW(target_hwnd, 0x0010, 0, 0)
        closed_titles.append(target_title)

    return {
        "status": "success",
        "message": f"Closed {', '.join(closed_titles)} on laptop.",
        "closed": closed_titles
    }
