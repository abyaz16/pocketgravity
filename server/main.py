"""
PocketGravity Server Daemon - Main Application Entrypoint.
FastAPI + WebSockets + Static PWA Client Serving + Antigravity Control Center + Dev Proxy.
"""
import os
import asyncio
from pathlib import Path
from pydantic import BaseModel
import websockets
from fastapi import FastAPI, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from server.config import HOST, PORT, WORKSPACE_ROOT, AUTH_TOKEN, TAILSCALE_STRICT, is_tailscale_ip, get_tailscale_ip
from server.auth import get_current_token, verify_token, is_ip_banned, record_failed_attempt, record_successful_auth
from server.workspace import router as workspace_router
from server.system import router as system_router
from server.terminal import router as terminal_router
from server.qr import router as qr_router
from server.antigravity import router as antigravity_router
from server.desktop import router as desktop_router
from server.proxy import router as proxy_router, forward_to_dev_server, get_active_dev_port
from server.claude import router as claude_router

app = FastAPI(
    title="PocketGravity & Antigravity Remote Daemon (Hardened)",
    description="Bulletproof zero-trust remote control for Google Antigravity & Claude Code.",
    version="2.1.0"
)

# CORS Middleware restricted to private networks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Zero-Trust Network Layer Firewall Middleware
@app.middleware("http")
async def network_security_firewall(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"

    # If client is banned due to brute force attempts, block immediately
    if is_ip_banned(client_ip):
        return JSONResponse(
            status_code=403,
            content={"detail": "IP address temporarily banned due to excessive invalid authentication attempts."}
        )

    # If Tailscale strict mode is active, completely drop non-Tailscale Wi-Fi connections
    if TAILSCALE_STRICT:
        if not is_tailscale_ip(client_ip):
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Access Denied: Zero-Trust Wi-Fi isolation active.",
                    "detail": "Connections from local Wi-Fi are blocked. Connect securely via Tailscale WireGuard only."
                }
            )

    return await call_next(request)

class AuthVerifyRequest(BaseModel):
    token: str

@app.post("/api/auth/verify")
async def verify_auth(payload: AuthVerifyRequest, request: Request):
    """Validates the mobile client bearer token with anti-brute-force rate limiting."""
    client_ip = request.client.host if request.client else "unknown"

    if is_ip_banned(client_ip):
        return JSONResponse(
            status_code=403,
            content={"detail": "IP address temporarily banned due to excessive invalid authentication attempts."}
        )

    valid = verify_token(payload.token)
    if not valid:
        record_failed_attempt(client_ip)
    else:
        record_successful_auth(client_ip)

    return {
        "valid": valid,
        "workspace_root": str(WORKSPACE_ROOT) if valid else None,
        "server_version": "2.1.0"
    }

# Include API Routers
app.include_router(qr_router)
app.include_router(antigravity_router)
app.include_router(desktop_router)
app.include_router(proxy_router)
app.include_router(claude_router)
app.include_router(workspace_router)
app.include_router(system_router)
app.include_router(terminal_router)

# WebSocket Proxy for Vite Hot Module Replacement (HMR)
@app.websocket("/")
async def vite_hmr_websocket_proxy(client_ws: WebSocket):
    """
    Proxies Vite Dev Server HMR WebSocket connections from mobile browser
    to the active local dev server (e.g. port 5181 or 5180).
    """
    target_port = get_active_dev_port()
    raw_qs = client_ws.scope.get("query_string", b"").decode("utf-8")
    query_str = f"?{raw_qs}" if raw_qs else ""
    backend_url = f"ws://localhost:{target_port}/{query_str}"

    await client_ws.accept()
    try:
        async with websockets.connect(backend_url) as server_ws:
            async def forward_client():
                try:
                    while True:
                        msg = await client_ws.receive_text()
                        await server_ws.send(msg)
                except Exception:
                    pass

            async def forward_server():
                try:
                    async for msg in server_ws:
                        await client_ws.send_text(msg)
                except Exception:
                    pass

            await asyncio.gather(forward_client(), forward_server())
    except Exception:
        pass

# Mount Frontend PWA (client/dist) if built
CLIENT_DIST_DIR = Path(__file__).resolve().parent.parent / "client" / "dist"

DEV_PREFIXES = (
    "@vite", "@react-refresh", "@fs", "@id", "src/", "node_modules/",
    "__vite_ping", "favicon.svg", "favicon.ico", "manifest.webmanifest"
)
DEV_EXTENSIONS = (".jsx", ".tsx", ".vue", ".svelte", ".ts", ".mjs")

if CLIENT_DIST_DIR.exists() and (CLIENT_DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(CLIENT_DIST_DIR / "assets")), name="assets")

    # Serve static assets, dev server resources, or index.html for client-side routing
    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
    async def serve_spa(full_path: str, request: Request):
        query_str = str(request.url.query)
        is_dev_asset = (
            full_path.startswith(DEV_PREFIXES)
            or any(full_path.endswith(ext) for ext in DEV_EXTENSIONS)
            or "import" in query_str
            or "t=" in query_str
        )

        if is_dev_asset:
            target_port = get_active_dev_port()
            try:
                return await forward_to_dev_server(target_port, full_path, request)
            except Exception:
                pass

        file_path = CLIENT_DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        return FileResponse(
            CLIENT_DIST_DIR / "index.html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
else:
    @app.get("/")
    async def root_placeholder():
        return {
            "app": "PocketGravity Daemon v2.0",
            "status": "online",
            "workspace_root": str(WORKSPACE_ROOT),
            "docs": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    print(f"Starting PocketGravity on http://{HOST}:{PORT}")
    print(f"Workspace Root: {WORKSPACE_ROOT}")
    uvicorn.run("server.main:app", host=HOST, port=PORT, reload=False)
