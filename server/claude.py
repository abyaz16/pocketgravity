"""
Claude Code Remote Execution Engine with Desktop Injection, Active Session Tracker,
and Conversation Stream Parser.
"""
import asyncio
import json
import os
import re
from pathlib import Path
from typing import Optional, List
import psutil
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from server.auth import verify_token, get_current_token
from server.config import get_workspace_root
from server.injector import inject_prompt_to_window

router = APIRouter(prefix="/api/claude", tags=["Claude Code"])

CLAUDE_EXE = Path(os.environ.get("USERPROFILE") or Path.home()) / ".local" / "bin" / "claude.exe"

class ClaudePromptRequest(BaseModel):
    prompt: str
    folder: Optional[str] = None
    dangerously_skip_permissions: bool = False
    inject_window: bool = True

def get_active_running_claude_session() -> Optional[str]:
    """Finds active session UUID from running claude.exe arguments if alive."""
    try:
        for p in psutil.process_iter(['name', 'cmdline']):
            if 'claude' in (p.info['name'] or '').lower():
                for arg in (p.info['cmdline'] or []):
                    if arg.startswith('--resume='):
                        return arg.split('=', 1)[1].strip()
    except Exception:
        pass
    return None

def get_latest_claude_jsonl(folder_name: str) -> Optional[Path]:
    """
    Finds the active Claude Code transcript file strictly for the specified workspace folder.
    Never returns sessions from other project folders (e.g. Airbnb when viewing pocketgravity).
    """
    projects_dir = Path(os.environ.get("USERPROFILE") or Path.home()) / ".claude" / "projects"
    if not projects_dir.exists():
        return None

    # Clean folder name for resilient matching (e.g. 'pocketgravity' -> 'pocketgravity')
    f_clean = folder_name.lower().replace("-", "").replace("_", "")
    matching_folders = []
    for d in projects_dir.iterdir():
        if not d.is_dir():
            continue
        d_clean = d.name.lower().replace("-", "").replace("_", "")
        # Checks if folder name matches the end or part of project dir name (e.g. 'e--pocketgravity')
        if f_clean in d_clean:
            matching_folders.append(d)

    if not matching_folders:
        return None

    # Pick best project folder (latest modified if multiple)
    target_folder = max(matching_folders, key=lambda f: f.stat().st_mtime)

    # Check if a running claude session belongs to this specific folder
    active_uuid = get_active_running_claude_session()
    if active_uuid:
        active_jsonl = target_folder / f"{active_uuid}.jsonl"
        if active_jsonl.exists():
            return active_jsonl

    # Otherwise return the latest modified transcript within this folder
    jsonls = list(target_folder.glob("*.jsonl"))
    if not jsonls:
        return None
    return max(jsonls, key=lambda f: f.stat().st_mtime)

def clean_user_text(raw_text: str) -> str:
    """Cleans up internal agent notification wrappers from user display text."""
    if not raw_text:
        return ""
    text = raw_text.strip()
    # If it's a subagent notification wrapper
    if "<task-notification>" in text or "<agent-message" in text:
        # Extract main message if available
        m = re.search(r'<agent-message[^>]*>(.*?)</agent-message>', text, flags=re.DOTALL)
        if m:
            text = m.group(1).strip()
        else:
            text = re.sub(r'<[^>]+>', ' ', text).strip()
    return text

def parse_claude_messages(jsonl_path: Path, limit: int = 40) -> List[dict]:
    if not jsonl_path or not jsonl_path.exists():
        return []

    messages = []
    current_assistant = None

    with open(jsonl_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue

            l_type = obj.get("type")
            if l_type == "user":
                if current_assistant and (current_assistant["text"].strip() or current_assistant["tools"]):
                    messages.append(current_assistant)
                    current_assistant = None

                content = obj.get("message", {}).get("content", "")
                user_text = ""
                if isinstance(content, str):
                    user_text = content
                elif isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "text":
                            user_text += b.get("text", "")
                        elif isinstance(b, str):
                            user_text += b

                clean_txt = clean_user_text(user_text)
                if clean_txt:
                    messages.append({
                        "id": f"u-{len(messages)}",
                        "role": "user",
                        "text": clean_txt,
                        "timestamp": obj.get("timestamp")
                    })

            elif l_type == "assistant":
                if not current_assistant:
                    current_assistant = {
                        "id": f"c-{len(messages)}",
                        "role": "claude",
                        "text": "",
                        "tools": [],
                        "timestamp": obj.get("timestamp")
                    }

                msg = obj.get("message", {})
                for b in msg.get("content", []):
                    if isinstance(b, dict):
                        b_type = b.get("type")
                        if b_type == "text":
                            current_assistant["text"] += b.get("text", "")
                        elif b_type == "tool_use":
                            t_name = b.get("name")
                            if t_name and t_name not in current_assistant["tools"]:
                                current_assistant["tools"].append(t_name)

            elif l_type in ("system", "error"):
                subtype = obj.get("subtype", "")
                level = obj.get("level", "")
                err_dict = obj.get("error")
                err_msg = ""
                if isinstance(err_dict, dict):
                    err_msg = err_dict.get("formatted") or err_dict.get("message") or str(err_dict)
                elif isinstance(err_dict, str):
                    err_msg = err_dict
                elif obj.get("content"):
                    c = obj.get("content")
                    if isinstance(c, str) and any(k in c.lower() for k in ("error", "failed", "unauthorized", "logged out", "subscription", "expired", "rate limit")):
                        err_msg = c

                if err_msg or subtype in ("api_error", "error", "auth_error") or level == "error":
                    final_err = err_msg or "Claude Code encountered an API or Authentication error on laptop."
                    if current_assistant:
                        current_assistant["text"] = (current_assistant["text"] + "\n\n" if current_assistant["text"] else "") + f"⚠️ {final_err}"
                        current_assistant["is_error"] = True
                        messages.append(current_assistant)
                        current_assistant = None
                    else:
                        messages.append({
                            "id": f"c-err-{len(messages)}",
                            "role": "claude",
                            "is_error": True,
                            "text": f"⚠️ {final_err}",
                            "tools": [],
                            "timestamp": obj.get("timestamp")
                        })

    if current_assistant and (current_assistant["text"].strip() or current_assistant["tools"]):
        messages.append(current_assistant)

    return messages[-limit:]

@router.get("/status")
async def get_claude_status(_token: str = Depends(get_current_token)):
    """Checks if Claude Code is installed and active."""
    active_uuid = get_active_running_claude_session()
    is_installed = CLAUDE_EXE.exists()
    return {
        "is_installed": is_installed,
        "is_active_process": active_uuid is not None,
        "active_session": active_uuid,
        "path": str(CLAUDE_EXE)
    }

@router.get("/conversation")
async def get_claude_conversation(
    limit: int = Query(40, ge=5, le=100),
    folder: Optional[str] = Query(None),
    _token: str = Depends(get_current_token)
):
    """Returns conversation history (user prompts and Claude answers) for active workspace."""
    ws_root = get_workspace_root()
    folder_name = folder.strip() if folder and folder.strip() else ws_root.name
    # Extract basename if path was provided
    folder_name = Path(folder_name).name
    jsonl_file = get_latest_claude_jsonl(folder_name)
    if not jsonl_file:
        return {"folder": folder_name, "messages": []}

    msgs = parse_claude_messages(jsonl_file, limit=limit)
    return {
        "folder": folder_name,
        "session_file": jsonl_file.name,
        "messages": msgs
    }

@router.post("/run")
@router.post("/prompt")
async def run_claude_prompt(
    payload: ClaudePromptRequest,
    _token: str = Depends(get_current_token)
):
    """
    Submits prompt into Antigravity IDE Claude Code tab on laptop desktop,
    or falls back to CLI runner if window is unavailable.
    """
    ws_root = get_workspace_root()
    folder_name = payload.folder.strip() if payload.folder and payload.folder.strip() else ws_root.name
    folder_name = Path(folder_name).name
    prompt = payload.prompt.strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    if payload.inject_window:
        res = inject_prompt_to_window(prompt, target="claude", folder_hint=folder_name)
        if res.get("status") == "success":
            return {
                "status": "success",
                "injected": True,
                "window": res.get("window"),
                "folder": folder_name,
                "message": f"Prompt submitted to Claude Code on laptop!",
                "prompt": prompt
            }

    # Fallback to CLI runner
    if not CLAUDE_EXE.exists():
        raise HTTPException(status_code=404, detail="Claude Code executable not found")

    args = [str(CLAUDE_EXE), "--print", prompt]
    if payload.dangerously_skip_permissions:
        args.append("--dangerously-skip-permissions")

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(ws_root),
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode("utf-8", errors="replace")
        err_str = stderr.decode("utf-8", errors="replace")

        if proc.returncode != 0:
            err_detail = err_str.strip() or out_str.strip() or f"Process exited with code {proc.returncode}"
            raise HTTPException(status_code=500, detail=f"Claude Code Error: {err_detail}")

        return {
            "status": "success",
            "injected": False,
            "exit_code": proc.returncode,
            "stdout": out_str,
            "stderr": err_str,
            "message": "Executed via CLI runner"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude execution failed: {str(e)}")

@router.websocket("/ws")
async def websocket_claude(websocket: WebSocket):
    """Interactive streaming WebSocket session for Claude Code."""
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token or not verify_token(token):
        await websocket.close(code=1008)
        return

    try:
        ws_root = get_workspace_root()
        await websocket.send_text(json.dumps({
            "type": "ready",
            "message": "Connected to Claude Code Engine",
            "workspace": str(ws_root)
        }))

        while True:
            msg_text = await websocket.receive_text()
            data = json.loads(msg_text)
            action = data.get("action")

            if action == "run":
                prompt = data.get("prompt", "").strip()
                if not prompt:
                    continue
                ws_root = get_workspace_root()
                res = inject_prompt_to_window(prompt, target="claude", folder_hint=ws_root.name)
                await websocket.send_text(json.dumps({
                    "type": "status",
                    "status": "starting",
                    "prompt": prompt,
                    "injected": res.get("status") == "success"
                }))
    except Exception:
        pass
