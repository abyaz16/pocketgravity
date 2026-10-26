"""
System metrics and health endpoints using psutil.
"""
import os
import platform
import time
import psutil
from fastapi import APIRouter, Depends
from server.auth import get_current_token
from server.config import WORKSPACE_ROOT

router = APIRouter(prefix="/api/system", tags=["System"])

def format_bytes(size: float) -> str:
    """Format bytes into human readable MB/GB."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

def format_uptime(seconds: float) -> str:
    """Format uptime seconds into a human-readable string."""
    mins, sec = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    days, hours = divmod(hours, 24)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if mins > 0:
        parts.append(f"{mins}m")
    if not parts or sec > 0:
        parts.append(f"{sec}s")
    return " ".join(parts)

def collect_metrics() -> dict:
    """Collect real-time CPU, RAM, Battery, Disk, and OS metrics."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_cores_logical = psutil.cpu_count(logical=True)
    cpu_cores_physical = psutil.cpu_count(logical=False)
    cpu_freq = psutil.cpu_freq()

    # Memory
    vm = psutil.virtual_memory()

    # Battery
    battery_info = None
    try:
        battery = psutil.sensors_battery()
        if battery is not None:
            battery_info = {
                "percent": round(battery.percent, 1),
                "power_plugged": battery.power_plugged,
                "secsleft": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else None
            }
    except Exception:
        battery_info = None

    # Disk usage for workspace root and relevant drives
    disk_metrics = {}
    try:
        ws_usage = psutil.disk_usage(str(WORKSPACE_ROOT))
        disk_metrics["workspace"] = {
            "path": str(WORKSPACE_ROOT),
            "total_bytes": ws_usage.total,
            "used_bytes": ws_usage.used,
            "free_bytes": ws_usage.free,
            "percent": ws_usage.percent,
            "total_readable": format_bytes(ws_usage.total),
            "free_readable": format_bytes(ws_usage.free),
        }
    except Exception:
        pass

    # Uptime
    boot_time = psutil.boot_time()
    uptime_seconds = max(0, time.time() - boot_time)

    return {
        "status": "ok",
        "timestamp": time.time(),
        "cpu": {
            "percent": cpu_percent,
            "cores_logical": cpu_cores_logical,
            "cores_physical": cpu_cores_physical,
            "current_freq_mhz": round(cpu_freq.current, 1) if cpu_freq else None,
        },
        "memory": {
            "total_bytes": vm.total,
            "available_bytes": vm.available,
            "used_bytes": vm.used,
            "percent": vm.percent,
            "total_readable": format_bytes(vm.total),
            "used_readable": format_bytes(vm.used),
            "available_readable": format_bytes(vm.available),
        },
        "battery": battery_info,
        "disk": disk_metrics,
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "node": platform.node(),
            "machine": platform.machine(),
            "uptime_seconds": uptime_seconds,
            "uptime_formatted": format_uptime(uptime_seconds),
        },
        "workspace_root": str(WORKSPACE_ROOT)
    }

@router.get("/status")
@router.post("/status")
async def get_system_status(_token: str = Depends(get_current_token)):
    """Return laptop hardware and OS status."""
    return collect_metrics()
