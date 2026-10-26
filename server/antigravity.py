"""
Antigravity IDE & Laptop Deep Remote Control API.
Provides full remote control over Antigravity agent brains, conversations,
tasks, artifacts, and Windows laptop hardware actions.
"""
import os
import re
import json
import glob
import time
import sqlite3
import subprocess
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from server.auth import get_current_token
from server.config import WORKSPACE_ROOT

router = APIRouter(prefix="/api/antigravity", tags=["Antigravity Control"])

# Default Antigravity IDE AppData Directory
ANTIGRAVITY_APP_DIR = Path(os.environ.get("USERPROFILE") or Path.home()) / ".gemini" / "antigravity-ide"

def get_brain_dir() -> Path:
    return ANTIGRAVITY_APP_DIR / "brain"

def get_latest_conversation_dir() -> Optional[Path]:
    brain_dir = get_brain_dir()
    if not brain_dir.exists():
        return None
    conv_dirs = [d for d in brain_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]
    if not conv_dirs:
        return None
    conv_dirs.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    return conv_dirs[0]

@router.get("/status")
async def get_antigravity_status(_token: str = Depends(get_current_token)):
    """Returns Antigravity IDE health, active conversation ID, and brain statistics."""
    brain_dir = get_brain_dir()
    is_installed = ANTIGRAVITY_APP_DIR.exists()
    
    latest_conv = get_latest_conversation_dir()
    latest_id = latest_conv.name if latest_conv else None
    
    total_convs = len([d for d in brain_dir.iterdir() if d.is_dir()]) if brain_dir.exists() else 0
    
    tasks = []
    if latest_conv:
        tasks_dir = latest_conv / ".system_generated" / "tasks"
        if tasks_dir.exists():
            for task_file in tasks_dir.glob("*.log"):
                tasks.append({
                    "task_id": task_file.stem,
                    "size_bytes": task_file.stat().st_size,
                    "modified": task_file.stat().st_mtime
                })
    
    return {
        "is_installed": is_installed,
        "antigravity_dir": str(ANTIGRAVITY_APP_DIR),
        "total_conversations": total_convs,
        "active_conversation_id": latest_id,
        "active_tasks_count": len(tasks),
        "active_tasks": tasks[-5:]
    }

@router.get("/conversations")
async def list_conversations(
    limit: int = Query(10, ge=1, le=50),
    _token: str = Depends(get_current_token)
):
    """Lists recent Antigravity conversations with metadata and last modified timestamps."""
    brain_dir = get_brain_dir()
    if not brain_dir.exists():
        return {"conversations": []}

    dirs = [d for d in brain_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]
    dirs.sort(key=lambda d: d.stat().st_mtime, reverse=True)

    result = []
    for d in dirs[:limit]:
        transcript_file = d / ".system_generated" / "logs" / "transcript.jsonl"
        artifacts = list(d.glob("*.md"))
        result.append({
            "id": d.name,
            "modified": d.stat().st_mtime,
            "has_transcript": transcript_file.exists(),
            "artifacts_count": len(artifacts)
        })

    return {"conversations": result}

@router.get("/transcript")
async def get_transcript(
    conversation_id: Optional[str] = Query(None, description="Optional conversation ID; defaults to latest"),
    limit: int = Query(30, ge=5, le=100),
    _token: str = Depends(get_current_token)
):
    """Parses conversation transcript.jsonl into a structured mobile timeline."""
    target_dir = (get_brain_dir() / conversation_id) if conversation_id else get_latest_conversation_dir()
    if not target_dir or not target_dir.exists():
        raise HTTPException(status_code=404, detail="Conversation not found")

    transcript_file = target_dir / ".system_generated" / "logs" / "transcript.jsonl"
    if not transcript_file.exists():
        return {
            "conversation_id": target_dir.name,
            "steps": [],
            "message": "Transcript file not found yet"
        }

    steps = []
    try:
        with open(transcript_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    step_type = obj.get("type", "")
                    content = obj.get("content", "")
                    tool_calls = obj.get("tool_calls", [])
                    step_idx = obj.get("step_index", len(steps))

                    summary_item = {
                        "index": step_idx,
                        "type": step_type,
                        "source": obj.get("source", ""),
                        "status": obj.get("status", ""),
                        "content_preview": content[:300] if content else "",
                        "tools": [tc.get("toolAction", tc.get("toolSummary", "Tool call")) for tc in tool_calls] if tool_calls else []
                    }
                    steps.append(summary_item)
                except Exception:
                    pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed reading transcript: {str(e)}")

    return {
        "conversation_id": target_dir.name,
        "total_steps": len(steps),
        "steps": steps[-limit:]
    }

@router.get("/artifacts")
async def list_artifacts(
    conversation_id: Optional[str] = Query(None),
    _token: str = Depends(get_current_token)
):
    """Lists all artifacts created in the conversation."""
    target_dir = (get_brain_dir() / conversation_id) if conversation_id else get_latest_conversation_dir()
    if not target_dir or not target_dir.exists():
        return {"artifacts": []}

    artifacts = []
    for md_file in target_dir.glob("*.md"):
        try:
            stat = md_file.stat()
            artifacts.append({
                "name": md_file.name,
                "path": str(md_file),
                "size_bytes": stat.st_size,
                "modified": stat.st_mtime
            })
        except Exception:
            pass
            
    artifacts.sort(key=lambda a: a["modified"], reverse=True)
    return {"artifacts": artifacts}

@router.get("/artifact-content")
async def get_artifact_content(
    name: str = Query(..., description="Artifact filename"),
    conversation_id: Optional[str] = Query(None),
    _token: str = Depends(get_current_token)
):
    """Reads the markdown content of an artifact for mobile reading."""
    target_dir = (get_brain_dir() / conversation_id) if conversation_id else get_latest_conversation_dir()
    if not target_dir:
        raise HTTPException(status_code=404, detail="Conversation not found")

    file_path = (target_dir / name).resolve()
    try:
        file_path.relative_to(target_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid artifact path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    return {"name": name, "content": content}

class RemoteActionRequest(BaseModel):
    action: str
    target: Optional[str] = None

@router.post("/action")
async def execute_remote_action(
    payload: RemoteActionRequest,
    _token: str = Depends(get_current_token)
):
    """Executes deep laptop remote control actions from smartphone."""
    act = payload.action

    if act == "lock_pc":
        subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
        return {"status": "success", "message": "Laptop workstation locked."}

    elif act == "volume_mute":
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]173)"])
        return {"status": "success", "message": "Toggled volume mute."}

    elif act == "volume_up":
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]175); $w.SendKeys([char]175)"])
        return {"status": "success", "message": "Volume increased."}

    elif act == "volume_down":
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]174); $w.SendKeys([char]174)"])
        return {"status": "success", "message": "Volume decreased."}

    elif act == "sleep_display":
        subprocess.run([
            "powershell.exe", "-NoProfile", "-Command",
            "(Add-Type '[DllImport(\"user32.dll\")]public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);' -Name a -Passthru)::SendMessage(-1,0x0112,0xF170,2)"
        ])
        return {"status": "success", "message": "Turned off laptop screen."}

    else:
        raise HTTPException(status_code=400, detail=f"Action '{act}' is not permitted in hardened security mode.")

class LaunchAntigravityRequest(BaseModel):
    folder: Optional[str] = None

class CloseAntigravityRequest(BaseModel):
    folder: Optional[str] = None
    close_all: bool = False

@router.post("/launch")
async def launch_antigravity_ide(
    payload: Optional[LaunchAntigravityRequest] = None,
    _token: str = Depends(get_current_token)
):
    """Launches or brings Antigravity IDE to the foreground on the laptop desktop."""
    from server.config import get_workspace_root
    from server.injector import find_antigravity_window, force_foreground

    target_folder = payload.folder if (payload and payload.folder) else str(get_workspace_root())

    hwnd, title = find_antigravity_window(target_folder)
    if hwnd:
        force_foreground(hwnd)
        return {"status": "success", "message": f"Focused Antigravity [{title}] on laptop desktop."}

    antigravity_cmd = Path(os.environ.get("USERPROFILE") or Path.home()) / "AppData" / "Local" / "Programs" / "Antigravity IDE" / "bin" / "antigravity-ide.cmd"
    if antigravity_cmd.exists():
        subprocess.Popen([str(antigravity_cmd), "-r", str(target_folder)], shell=True)
        return {"status": "success", "message": f"Opened Antigravity IDE for {target_folder}"}

    exe_candidates = [
        Path(os.environ.get("USERPROFILE") or Path.home()) / "AppData" / "Local" / "Programs" / "Antigravity IDE" / "Antigravity IDE.exe",
        Path(os.environ.get("USERPROFILE") or Path.home()) / "AppData" / "Local" / "Programs" / "Antigravity" / "Antigravity.exe",
    ]
    for exe in exe_candidates:
        if exe.exists():
            subprocess.Popen([str(exe), str(target_folder)], shell=True)
            return {"status": "success", "message": f"Launched {exe.name}"}

    return {"status": "error", "message": "Antigravity IDE executable not found on laptop."}

@router.post("/close")
async def close_antigravity_ide(
    payload: Optional[CloseAntigravityRequest] = None,
    _token: str = Depends(get_current_token)
):
    """Closes the Antigravity IDE window on the laptop desktop cleanly."""
    from server.injector import close_antigravity_window
    folder = payload.folder if (payload and payload.folder) else None
    close_all = payload.close_all if payload else False
    if not folder:
        from server.config import get_workspace_root
        folder = get_workspace_root().name

    return close_antigravity_window(folder_hint=folder, close_all=close_all)

class AntigravityPromptPayload(BaseModel):
    prompt: str
    folder: Optional[str] = None
    mode: Optional[str] = "agent"
    model: Optional[str] = "Gemini 3.8 Flash (High)"
    effort: Optional[str] = "High"

@router.get("/options")
async def get_agent_options(_token: str = Depends(get_current_token)):
    """Returns available agent modes, AI models, and thinking effort levels."""
    return {
        "models": [
            {"id": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash (High)", "provider": "Google"},
            {"id": "gemini-3.8-flash-med", "name": "Gemini 3.8 Flash (Medium)", "provider": "Google"},
            {"id": "claude-3.7-sonnet", "name": "Claude 3.7 Sonnet", "provider": "Anthropic"},
            {"id": "opus-5-medium", "name": "Opus 5 Medium", "provider": "Anthropic"},
            {"id": "gemini-3.8-pro", "name": "Gemini 3.8 Pro", "provider": "Google"},
            {"id": "claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "Anthropic"}
        ],
        "efforts": ["High", "Medium", "Low", "Max", "Auto"],
        "modes": [
            {"id": "agent", "name": "Agent (Autonomous Execution & Tools)", "icon": "sparkles"},
            {"id": "edit", "name": "Edit (Targeted Code Editing)", "icon": "file-code"},
            {"id": "ask", "name": "Ask (Interactive Discussion & Questions)", "icon": "message-square"}
        ]
    }

@router.post("/prompt")
async def dispatch_antigravity_prompt(
    payload: AntigravityPromptPayload,
    _token: str = Depends(get_current_token)
):
    """
    Dispatches prompt to Antigravity Agent on laptop desktop.
    Uses native Ctrl+L focus and clipboard injection.
    """
    from server.config import get_workspace_root
    from server.injector import inject_prompt_to_window
    ws_root = get_workspace_root()
    folder_name = payload.folder.strip() if payload.folder and payload.folder.strip() else ws_root.name
    folder_name = Path(folder_name).name
    prompt = payload.prompt.strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    res = inject_prompt_to_window(prompt, target="agent", folder_hint=folder_name)
    if res.get("status") == "success":
        return {
            "status": "success",
            "injected": True,
            "window": res.get("window"),
            "message": f"Prompt submitted to Antigravity Agent in {res.get('window')}!",
            "folder": folder_name,
            "model": payload.model,
            "effort": payload.effort
        }

    raise HTTPException(status_code=500, detail=res.get("message", "Failed to inject prompt"))

def parse_agent_messages(conv_dir: Path, limit: int = 40):
    full_path = conv_dir / ".system_generated" / "logs" / "transcript_full.jsonl"
    short_path = conv_dir / ".system_generated" / "logs" / "transcript.jsonl"
    target = full_path if full_path.exists() else short_path
    if not target.exists():
        return []

    messages = []
    current_agent_msg = None

    with open(target, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue

            step_type = obj.get("type", "")
            source = obj.get("source", "")
            content = obj.get("content", "")
            tool_calls = obj.get("tool_calls", [])

            if step_type == "USER_INPUT" and source == "USER_EXPLICIT":
                if current_agent_msg:
                    messages.append(current_agent_msg)
                    current_agent_msg = None

                clean_text = re.sub(r"<ADDITIONAL_METADATA>.*?</ADDITIONAL_METADATA>", "", content, flags=re.DOTALL)
                clean_text = re.sub(r"<USER_REQUEST>\s*", "", clean_text)
                clean_text = re.sub(r"\s*</USER_REQUEST>", "", clean_text).strip()
                if clean_text:
                    messages.append({
                        "id": f"user-{obj.get('step_index', len(messages))}",
                        "role": "user",
                        "status": "DONE",
                        "text": clean_text,
                        "timestamp": obj.get("created_at")
                    })

            elif source == "SYSTEM" and step_type in ("ERROR_MESSAGE", "ERROR"):
                err_text = content.strip() if content else "An unexpected agent system error occurred on the laptop."
                if current_agent_msg:
                    current_agent_msg["text"] = f"⚠️ {err_text}"
                    current_agent_msg["status"] = "ERROR"
                    current_agent_msg["is_error"] = True
                    messages.append(current_agent_msg)
                    current_agent_msg = None
                else:
                    messages.append({
                        "id": f"agent-err-{obj.get('step_index', len(messages))}",
                        "role": "agent",
                        "status": "ERROR",
                        "is_error": True,
                        "text": f"⚠️ {err_text}",
                        "tools": [],
                        "timestamp": obj.get("created_at")
                    })

            elif source == "MODEL":
                if not current_agent_msg:
                    current_agent_msg = {
                        "id": f"agent-{obj.get('step_index', len(messages))}",
                        "role": "agent",
                        "text": "",
                        "tools": [],
                        "status": "RUNNING",
                        "timestamp": obj.get("created_at")
                    }

                for tc in tool_calls:
                    t_name = tc.get("name")
                    if t_name and t_name not in current_agent_msg["tools"]:
                        current_agent_msg["tools"].append(t_name)

                if step_type == "PLANNER_RESPONSE":
                    if content:
                        current_agent_msg["text"] = content
                        current_agent_msg["status"] = "DONE"
                    elif obj.get("status") == "DONE" and not tool_calls:
                        # Check if preceded by an error
                        if messages and messages[-1].get("is_error"):
                            # Current empty turn was aborted by error
                            current_agent_msg["status"] = "ERROR"
                            current_agent_msg["is_error"] = True
                            current_agent_msg["text"] = messages[-1].get("text", "")
                        else:
                            current_agent_msg["status"] = "DONE"

    if current_agent_msg:
        messages.append(current_agent_msg)

    return messages[-limit:]

def resolve_conversation_for_folder(folder_hint: Optional[str] = None) -> Optional[Path]:
    """
    Finds the active conversation directory in brain/ strictly for the given workspace folder.
    First checks Antigravity's trajectory_metadata_blob in conversations/*.db for exact workspace URI.
    Falls back to checking transcript tool working directories.
    NEVER leaks or falls back to an unrelated folder's conversation!
    """
    brain_dir = get_brain_dir()
    if not brain_dir.exists():
        return None

    if not folder_hint or not folder_hint.strip():
        from server.config import get_workspace_root
        folder_hint = get_workspace_root().name

    f_clean = Path(folder_hint).name.lower().replace("-", "").replace("_", "")
    conv_dir = ANTIGRAVITY_APP_DIR / "conversations"

    matching_convs = []

    # Priority 1: Check Antigravity SQLite conversation database trajectory_metadata_blob
    if conv_dir.exists():
        for db_path in conv_dir.glob("*.db"):
            try:
                conn = sqlite3.connect(str(db_path))
                c = conn.cursor()
                c.execute("SELECT data FROM trajectory_metadata_blob WHERE id='main';")
                row = c.fetchone()
                conn.close()
                if row and row[0]:
                    raw = row[0].decode("utf-8", errors="ignore").lower().replace("-", "").replace("_", "")
                    # Match exact file:/// URI workspace in metadata
                    if f_clean in raw:
                        cid = db_path.stem
                        target_brain = brain_dir / cid
                        if target_brain.exists():
                            t_file = target_brain / ".system_generated" / "logs" / "transcript.jsonl"
                            tf_file = target_brain / ".system_generated" / "logs" / "transcript_full.jsonl"
                            wal_file = db_path.with_name(f"{db_path.name}-wal")
                            mtime = max(
                                t_file.stat().st_mtime if t_file.exists() else 0,
                                tf_file.stat().st_mtime if tf_file.exists() else 0,
                                db_path.stat().st_mtime,
                                wal_file.stat().st_mtime if wal_file.exists() else 0
                            )
                            matching_convs.append((target_brain, mtime))
            except Exception:
                pass

    if matching_convs:
        matching_convs.sort(key=lambda x: x[1], reverse=True)
        return matching_convs[0][0]

    # Priority 2: Fallback check in transcript files for explicit folder path references
    for d in brain_dir.iterdir():
        if not d.is_dir() or len(d.name) < 25:
            continue
        t_file = d / ".system_generated" / "logs" / "transcript.jsonl"
        if not t_file.exists():
            continue
        try:
            mtime = t_file.stat().st_mtime
            with open(t_file, "r", encoding="utf-8", errors="replace") as f:
                header = f.read(15000).lower().replace("-", "").replace("_", "")
                # Only match if explicit folder path like e:/foldername or e:\foldername appears
                if f":/{f_clean}" in header or f":\\\\{f_clean}" in header:
                    matching_convs.append((d, mtime))
        except Exception:
            pass

    if matching_convs:
        matching_convs.sort(key=lambda x: x[1], reverse=True)
        return matching_convs[0][0]

    # Strictly return None if no conversation matches this folder (NEVER leak another folder's chat)
    return None

@router.get("/conversation")
async def get_agent_conversation(
    conversation_id: Optional[str] = Query(None),
    limit: int = Query(35, ge=5, le=100),
    folder: Optional[str] = Query(None),
    _token: str = Depends(get_current_token)
):
    """Returns structured conversation turns (User prompts and formatted Agent answers)."""
    brain_dir = get_brain_dir()
    target_dir = None

    # Only treat conversation_id as valid if it looks like a real UUID (> 20 chars)
    if conversation_id and len(conversation_id.strip()) > 20:
        candidate = brain_dir / conversation_id.strip()
        if candidate.exists():
            target_dir = candidate

    if not target_dir:
        target_dir = resolve_conversation_for_folder(folder)

    if not target_dir or not target_dir.exists():
        return {"conversation_id": None, "folder": folder, "messages": []}

    msgs = parse_agent_messages(target_dir, limit=limit)
    return {
        "conversation_id": target_dir.name,
        "folder": folder,
        "total_messages": len(msgs),
        "messages": msgs
    }
