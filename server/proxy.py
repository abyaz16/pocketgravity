"""
Localhost Web Reverse Proxy & Port Scanner (IPv4 & IPv6).
Allows mobile phones to view and interact with websites running on laptop localhost
(e.g., port 5181, 5180, 5173, 3000, 8080), even if bound to ::1 or 127.0.0.1.
"""
import re
import socket
import psutil
import httpx
from fastapi import APIRouter, Request, Response, HTTPException
from server.config import PORT

router = APIRouter(prefix="/api/proxy", tags=["Localhost Proxy"])

COMMON_DEV_PORTS = {5181, 5180, 5173, 5174, 3000, 3001, 8080, 8081, 5000, 4200, 8888, 9000}

# Global tracker for currently active dev server port
ACTIVE_DEV_PORT = 5181

def get_active_dev_port() -> int:
    return ACTIVE_DEV_PORT

def set_active_dev_port(port: int):
    global ACTIVE_DEV_PORT
    if port > 0:
        ACTIVE_DEV_PORT = port

def is_port_listening(port: int) -> bool:
    """Fast socket check to verify if port is actively accepting connections."""
    for host in ["localhost", "127.0.0.1", "::1"]:
        try:
            family = socket.AF_INET6 if ":" in host else socket.AF_INET
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            pass
    return False

@router.get("/ports")
async def get_active_dev_ports():
    """Detects active listening network ports on the laptop (both IPv4 and IPv6)."""
    detected = []
    seen = set()

    try:
        connections = psutil.net_connections(kind="tcp")
        for conn in connections:
            if conn.status == "LISTEN" and conn.laddr:
                p = conn.laddr.port
                if p == PORT or p in seen:
                    continue
                seen.add(p)

                pname = "Service"
                if conn.pid:
                    try:
                        pname = psutil.Process(conn.pid).name()
                    except Exception:
                        pass

                is_common = p in COMMON_DEV_PORTS or (3000 <= p <= 9999)
                detected.append({
                    "port": p,
                    "pid": conn.pid,
                    "process_name": pname,
                    "is_dev": is_common
                })
    except Exception:
        pass

    # Sort ports: common dev ports first (5181, 5180, 5173, etc.), then by port number
    detected.sort(key=lambda x: (not x["is_dev"], x["port"]))

    # Update active dev port if currently unset or invalid
    active_candidates = [x["port"] for x in detected if x["is_dev"]]
    if active_candidates and ACTIVE_DEV_PORT not in [x["port"] for x in detected]:
        set_active_dev_port(active_candidates[0])

    return {
        "active_port": ACTIVE_DEV_PORT,
        "ports": detected[:15]
    }

async def forward_to_dev_server(target_port: int, path: str, request: Request) -> Response:
    """Helper to forward HTTP request to local dev server with IPv6 & IPv4 fallback."""
    query_str = f"?{request.url.query}" if request.url.query else ""
    candidate_urls = [
        f"http://localhost:{target_port}/{path.lstrip('/')}{query_str}",
        f"http://[::1]:{target_port}/{path.lstrip('/')}{query_str}",
        f"http://127.0.0.1:{target_port}/{path.lstrip('/')}{query_str}"
    ]

    excluded_headers = {"host", "content-length", "connection"}
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in excluded_headers
    }

    body = await request.body()
    last_err = None

    for target_url in candidate_urls:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body if body else None
                )

                resp_headers = {
                    key: value
                    for key, value in resp.headers.items()
                    if key.lower() not in {"transfer-encoding", "content-encoding", "content-length"}
                }

                content = resp.content
                content_type = resp.headers.get("content-type", "")

                # Inject <base href="..."> into HTML responses so relative links work inside iframe
                if "text/html" in content_type:
                    try:
                        text_html = content.decode("utf-8", errors="replace")
                        base_tag = f'<base href="/api/proxy/{target_port}/">'
                        if "<head>" in text_html:
                            text_html = text_html.replace("<head>", f"<head>\n    {base_tag}", 1)
                        elif "<HEAD>" in text_html:
                            text_html = text_html.replace("<HEAD>", f"<HEAD>\n    {base_tag}", 1)
                        content = text_html.encode("utf-8")
                    except Exception:
                        pass

                return Response(
                    content=content,
                    status_code=resp.status_code,
                    headers=resp_headers,
                    media_type=content_type
                )
        except Exception as e:
            last_err = e

    raise HTTPException(
        status_code=502,
        detail=f"Unable to connect to port {target_port} ({str(last_err)}). Is your dev server running?"
    )

@router.api_route("/{target_port}/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def reverse_proxy(target_port: int, full_path: str, request: Request):
    """
    Reverse proxies HTTP requests to http://localhost:{target_port}/{full_path}.
    Sets active dev port and handles HTML base injection.
    """
    set_active_dev_port(target_port)
    return await forward_to_dev_server(target_port, full_path, request)
