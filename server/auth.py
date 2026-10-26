"""
Authentication utilities and dependency injection for PocketGravity.
Hardened with constant-time token comparison, brute-force rate-limiting, and IP banning.
"""
import time
import secrets
from typing import Dict, List
from fastapi import Header, HTTPException, Query, Request, status
from server.config import AUTH_TOKEN

# Sliding window for failed attempts: ip -> list of timestamps
_failed_attempts: Dict[str, List[float]] = {}
# Banned IPs: ip -> ban expiration timestamp
_banned_ips: Dict[str, float] = {}

MAX_FAILED_ATTEMPTS = 3
BAN_DURATION_SECONDS = 3600  # 1 hour
WINDOW_SECONDS = 600         # 10 minutes

def is_ip_banned(client_ip: str) -> bool:
    """Checks if the client IP is currently banned from authentication."""
    if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost", "testclient"):
        return False
    ban_exp = _banned_ips.get(client_ip)
    if ban_exp:
        if time.time() < ban_exp:
            return True
        else:
            del _banned_ips[client_ip]
    return False

def record_failed_attempt(client_ip: str):
    """Records a failed authentication attempt and bans IP if threshold exceeded."""
    if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost", "testclient"):
        return
    now = time.time()
    attempts = _failed_attempts.get(client_ip, [])
    # Filter attempts within the time window
    attempts = [t for t in attempts if now - t < WINDOW_SECONDS]
    attempts.append(now)
    _failed_attempts[client_ip] = attempts

    if len(attempts) >= MAX_FAILED_ATTEMPTS:
        _banned_ips[client_ip] = now + BAN_DURATION_SECONDS
        print(f"[SECURITY ALERT] Banned IP {client_ip} for {BAN_DURATION_SECONDS}s due to {len(attempts)} failed attempts.")

def record_successful_auth(client_ip: str):
    """Clears failed attempts upon valid authentication."""
    if client_ip in _failed_attempts:
        del _failed_attempts[client_ip]

def verify_token(token: str | None) -> bool:
    """Compare provided token against configured AUTH_TOKEN securely using constant-time check."""
    if not token or not AUTH_TOKEN:
        return False
    return secrets.compare_digest(token.strip(), AUTH_TOKEN.strip())

async def get_current_token(
    request: Request,
    authorization: str | None = Header(None),
    token: str | None = Query(None)
) -> str:
    """
    FastAPI dependency that extracts and validates the Bearer token
    from either Authorization header or ?token= query parameter.
    Enforces anti-brute-force IP lockout.
    """
    client_ip = request.client.host if request.client else "unknown"

    if is_ip_banned(client_ip):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access temporarily banned due to excessive invalid authentication attempts. Try again later."
        )

    candidate_token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            candidate_token = parts[1]
        elif len(parts) == 1:
            candidate_token = parts[0]

    if not candidate_token and token:
        candidate_token = token

    if not candidate_token or not verify_token(candidate_token):
        record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    record_successful_auth(client_ip)
    return candidate_token
