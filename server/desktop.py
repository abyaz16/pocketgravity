"""
PocketGravity Web-Native Remote Desktop Engine for Windows.
Enables full interactive GUI remote control directly in any phone web browser (Safari/Chrome)
with ZERO third-party app installs, ZERO cloud relays, and 100% free.
"""
import io
import time
import ctypes
from ctypes import wintypes
import asyncio
import json
from PIL import ImageGrab
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Response
from server.auth import verify_token, get_current_token

router = APIRouter(prefix="/api/desktop", tags=["Remote Desktop"])

# Win32 Constants
WINSTA_ALL = 0x37F
DESKTOP_ALL = 0x1FF

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000

KEYEVENTF_KEYDOWN = 0x0000
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

user32 = ctypes.windll.user32

def attach_to_desktop():
    """Ensure thread is attached to interactive WinSta0 and active user desktop."""
    try:
        hwinsta = user32.OpenWindowStationW('WinSta0', False, WINSTA_ALL)
        if hwinsta:
            user32.SetProcessWindowStation(hwinsta)
        hdesk = user32.OpenInputDesktop(0, False, DESKTOP_ALL)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
    except Exception:
        pass

class DesktopEngine:
    def __init__(self):
        attach_to_desktop()
        self.screen_width = user32.GetSystemMetrics(0)
        self.screen_height = user32.GetSystemMetrics(1)

    def refresh_metrics(self):
        self.screen_width = user32.GetSystemMetrics(0)
        self.screen_height = user32.GetSystemMetrics(1)

    def capture_frame(self, quality: int = 65, scale: float = 1.0) -> bytes:
        """Captures live desktop screen and returns compressed JPEG bytes."""
        attach_to_desktop()
        img = ImageGrab.grab()
        if scale != 1.0:
            new_w = int(img.width * scale)
            new_h = int(img.height * scale)
            img = img.resize((new_w, new_h))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()

    def move_mouse(self, norm_x: float, norm_y: float):
        """Move mouse using normalized 0.0-1.0 coordinates from mobile touch."""
        attach_to_desktop()
        self.refresh_metrics()
        target_x = int(norm_x * self.screen_width)
        target_y = int(norm_y * self.screen_height)
        user32.SetCursorPos(target_x, target_y)

    def click_mouse(self, button: str = "left", norm_x: float = None, norm_y: float = None):
        """Click or double-click mouse at specified coordinates."""
        attach_to_desktop()
        if norm_x is not None and norm_y is not None:
            self.move_mouse(norm_x, norm_y)

        if button == "left":
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        elif button == "right":
            user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
        elif button == "double":
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            time.sleep(0.05)
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)

    def scroll_mouse(self, delta: int):
        attach_to_desktop()
        user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, 0)

    def type_char(self, char: str):
        attach_to_desktop()
        for c in char:
            vk = ord(c)
            # Use SendInput or keybd_event unicode
            user32.keybd_event(0, vk, KEYEVENTF_UNICODE, 0)
            user32.keybd_event(0, vk, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0)

    def press_key(self, key_name: str):
        attach_to_desktop()
        key_map = {
            "enter": 0x0D,
            "return": 0x0D,
            "backspace": 0x08,
            "tab": 0x09,
            "esc": 0x1B,
            "escape": 0x1B,
            "space": 0x20,
            "left": 0x25,
            "up": 0x26,
            "right": 0x27,
            "down": 0x28,
            "win": 0x5B,
            "ctrl": 0x11,
            "alt": 0x12,
            "shift": 0x10,
        }
        vk = key_map.get(key_name.lower())
        if vk:
            user32.keybd_event(vk, 0, KEYEVENTF_KEYDOWN, 0)
            user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)

desktop_engine = DesktopEngine()

@router.get("/screenshot")
async def get_screenshot(quality: int = 70, _token: str = Depends(get_current_token)):
    """Returns real-time JPEG screenshot of laptop display."""
    jpeg_bytes = desktop_engine.capture_frame(quality=quality)
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )

@router.get("/metrics")
async def get_desktop_metrics(_token: str = Depends(get_current_token)):
    """Returns screen resolution."""
    desktop_engine.refresh_metrics()
    return {
        "width": desktop_engine.screen_width,
        "height": desktop_engine.screen_height
    }

@router.websocket("/ws")
async def websocket_desktop(websocket: WebSocket):
    """
    Bidirectional low-latency screen streaming and touch/mouse/keyboard injection over WebSocket.
    """
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token or not verify_token(token):
        await websocket.close(code=1008)
        return

    streaming = True

    async def stream_frames():
        while streaming:
            try:
                frame_bytes = desktop_engine.capture_frame(quality=60, scale=0.75)
                await websocket.send_bytes(frame_bytes)
                # Cap at ~15-20 FPS for silky smooth responsiveness over local network
                await asyncio.sleep(0.06)
            except Exception:
                break

    stream_task = asyncio.create_task(stream_frames())

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action = msg.get("action")
            
            if action == "move":
                desktop_engine.move_mouse(msg.get("x", 0), msg.get("y", 0))
            elif action == "click":
                desktop_engine.click_mouse(
                    button=msg.get("button", "left"),
                    norm_x=msg.get("x"),
                    norm_y=msg.get("y")
                )
            elif action == "scroll":
                desktop_engine.scroll_mouse(msg.get("delta", -120))
            elif action == "type":
                text = msg.get("text", "")
                desktop_engine.type_char(text)
            elif action == "key":
                key_name = msg.get("key", "")
                desktop_engine.press_key(key_name)
    except WebSocketDisconnect:
        streaming = False
        stream_task.cancel()
    except Exception:
        streaming = False
        stream_task.cancel()
