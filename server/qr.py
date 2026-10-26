"""
Instant Pairing QR Code generator & Network Auto-Detection.
Allows mobile devices to connect over both Local Wi-Fi (No VPN needed) and Tailscale WireGuard.
"""
import io
import socket
import psutil
from fastapi import APIRouter, Response, Query
import qrcode
from server.config import PORT, AUTH_TOKEN, get_tailscale_ip

router = APIRouter(prefix="/api/connect", tags=["Connect & QR"])

def get_wifi_ip() -> str | None:
    """Finds the local Wi-Fi or primary LAN IPv4 address (192.168.x.x, 10.x.x.x, 172.16.x.x)."""
    try:
        net_if_addrs = psutil.net_if_addrs()
        net_if_stats = psutil.net_if_stats()
        
        candidates = []
        for iface_name, addrs in net_if_addrs.items():
            stats = net_if_stats.get(iface_name)
            is_up = stats.isup if stats else False
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127.") and not addr.address.startswith("169.254."):
                    # Ignore tailscale subnet for pure Wi-Fi check
                    if addr.address.startswith("100."):
                        continue
                    priority = 10
                    lower_name = iface_name.lower()
                    if "wi-fi" in lower_name or "wlan" in lower_name or "wireless" in lower_name:
                        priority = 1
                    elif "ethernet" in lower_name:
                        priority = 2
                    candidates.append((priority, is_up, addr.address))
                    
        if candidates:
            candidates.sort(key=lambda c: (c[0], not c[1]))
            return candidates[0][2]
    except Exception:
        pass

    # Socket probe fallback
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if not ip.startswith("127.") and not ip.startswith("169.254."):
            return ip
    except Exception:
        pass

    return None

def detect_lan_ip() -> str:
    """Auto-detect the Tailscale WireGuard IP first, falling back to Local Wi-Fi."""
    ts_ip = get_tailscale_ip()
    if ts_ip:
        return ts_ip
    wifi_ip = get_wifi_ip()
    if wifi_ip:
        return wifi_ip
    return "127.0.0.1"

@router.get("/info")
async def get_connect_info():
    """Returns local network IPs and connection URLs for both Wi-Fi and Tailscale."""
    ts_ip = get_tailscale_ip()
    wifi_ip = get_wifi_ip() or "127.0.0.1"
    
    primary_ip = ts_ip if ts_ip else wifi_ip
    
    wifi_url = f"http://{wifi_ip}:{PORT}/?token={AUTH_TOKEN}"
    tailscale_url = f"http://{ts_ip}:{PORT}/?token={AUTH_TOKEN}" if ts_ip else None
    
    return {
        "ip": primary_ip,
        "wifi_ip": wifi_ip,
        "wifi_url": wifi_url,
        "tailscale_ip": ts_ip,
        "tailscale_url": tailscale_url,
        "port": PORT,
        "token": AUTH_TOKEN,
        "connect_url": f"http://{primary_ip}:{PORT}/?token={AUTH_TOKEN}",
        "all_ips": [
            addr.address
            for addrs in psutil.net_if_addrs().values()
            for addr in addrs
            if addr.family == socket.AF_INET and not addr.address.startswith("127.")
        ]
    }

@router.get("/qr")
async def get_connect_qr(mode: str = Query("auto")):
    """Generates a high-contrast PNG QR code image for instant smartphone camera scanning."""
    ts_ip = get_tailscale_ip()
    wifi_ip = get_wifi_ip() or "127.0.0.1"
    
    if mode == "wifi":
        target_ip = wifi_ip
    elif mode == "tailscale":
        target_ip = ts_ip if ts_ip else wifi_ip
    else:
        target_ip = ts_ip if ts_ip else wifi_ip
        
    connect_url = f"http://{target_ip}:{PORT}/?token={AUTH_TOKEN}"
    
    img = qrcode.make(connect_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "no-cache"}
    )
