"""
Configuration settings for PocketGravity.
Supports dynamic project folder switching on E:\ drive and Tailscale WireGuard auto-detection.
"""
import os
import ipaddress
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
import psutil

BASE_DIR = Path(__file__).resolve().parent.parent

dotenv_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=dotenv_path)

AUTH_TOKEN = os.getenv("AUTH_TOKEN", "pocketgravity_secret_token_123")

# Strict mode: when true or when Tailscale is running, only Tailscale IP + localhost are allowed
TAILSCALE_STRICT = os.getenv("TAILSCALE_STRICT", "false").lower() in ("true", "1", "yes")

def get_tailscale_ip() -> Optional[str]:
    """Finds the active Tailscale WireGuard private IPv4 address (100.64.0.0/10) if running."""
    try:
        tailscale_subnet = ipaddress.ip_network("100.64.0.0/10")
        for iface, addrs in psutil.net_if_addrs().items():
            for a in addrs:
                if getattr(a, "family", None) and a.family.name == "AF_INET":
                    try:
                        ip_obj = ipaddress.ip_address(a.address)
                        if ip_obj in tailscale_subnet:
                            return a.address
                    except Exception:
                        pass
    except Exception:
        pass
    return None

def is_tailscale_ip(client_ip: str) -> bool:
    """Checks if an IP address belongs to the Tailscale Carrier-Grade NAT range or loopback."""
    if not client_ip:
        return False
    if client_ip in ("127.0.0.1", "::1", "localhost"):
        return True
    try:
        ip_obj = ipaddress.ip_address(client_ip)
        tailscale_subnet = ipaddress.ip_network("100.64.0.0/10")
        return ip_obj in tailscale_subnet
    except Exception:
        return False

# Current active workspace folder (dynamically switchable)
_current_folder = Path(os.getenv("WORKSPACE_ROOT", str(BASE_DIR))).resolve()

def get_workspace_root() -> Path:
    global _current_folder
    return _current_folder

def set_workspace_root(new_path: str) -> Path:
    global _current_folder
    target = Path(new_path).resolve()
    if target.exists() and target.is_dir():
        _current_folder = target
        return _current_folder
    raise ValueError(f"Directory does not exist: {new_path}")

# Default for legacy references
WORKSPACE_ROOT = get_workspace_root()

# Server Network Binding: 0.0.0.0 listens for Tailscale WireGuard and local loopback
HOST = os.getenv("HOST", "0.0.0.0")

PORT = int(os.getenv("PORT", "8000"))

EXCLUDED_NAMES = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    ".pip_cache",
    ".npm_cache",
    ".next",
    "dist",
    "build",
    ".idea",
    ".vscode"
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
