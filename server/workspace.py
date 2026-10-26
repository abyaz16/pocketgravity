"""
Workspace file management endpoints with dynamic project folder switching
and Antigravity IDE auto-open integration.
"""
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from server.auth import get_current_token
from server.config import get_workspace_root, set_workspace_root, EXCLUDED_NAMES, MAX_FILE_SIZE_BYTES

router = APIRouter(prefix="/api/workspace", tags=["Workspace"])

ANTIGRAVITY_CMD = Path(os.environ.get("USERPROFILE") or Path.home()) / "AppData" / "Local" / "Programs" / "Antigravity IDE" / "bin" / "antigravity-ide.cmd"

def resolve_safe_path(rel_path: str) -> Path:
    ws_root = get_workspace_root()
    clean_rel = rel_path.strip().lstrip("/\\")
    target_path = (ws_root / clean_rel).resolve()
    try:
        target_path.relative_to(ws_root)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Path escapes current workspace folder."
        )
    return target_path

def build_tree(current_dir: Path, current_depth: int, max_depth: int) -> dict:
    ws_root = get_workspace_root()
    try:
        rel_path = str(current_dir.relative_to(ws_root)).replace("\\", "/")
        if rel_path == ".":
            rel_path = ""
    except Exception:
        rel_path = ""

    node = {
        "name": current_dir.name if rel_path else ws_root.name,
        "path": rel_path,
        "type": "directory",
        "children": []
    }

    if current_depth >= max_depth:
        return node

    try:
        entries = sorted(list(current_dir.iterdir()), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            if entry.name in EXCLUDED_NAMES or entry.name.startswith("."):
                continue
            
            try:
                entry_rel = str(entry.relative_to(ws_root)).replace("\\", "/")
            except Exception:
                entry_rel = entry.name

            if entry.is_dir():
                child_node = build_tree(entry, current_depth + 1, max_depth)
                node["children"].append(child_node)
            else:
                try:
                    stat = entry.stat()
                    node["children"].append({
                        "name": entry.name,
                        "path": entry_rel,
                        "type": "file",
                        "size": stat.st_size,
                        "modified": stat.st_mtime
                    })
                except Exception:
                    pass
    except (PermissionError, OSError):
        pass

    return node

class OpenFolderRequest(BaseModel):
    path: str
    launch_antigravity: bool = True

class SaveFileRequest(BaseModel):
    path: str
    content: str
    create_backup: bool = True

def detect_active_laptop_workspace() -> dict:
    """
    Detects if an Antigravity IDE window is currently open on the laptop,
    and resolves the exact project folder currently opened in that window.
    """
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        
        try:
            hwinsta = user32.OpenWindowStationW('WinSta0', False, 0x37F)
            if hwinsta:
                user32.SetProcessWindowStation(hwinsta)
            hdesk = user32.OpenInputDesktop(0, False, 0x1FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
        except Exception:
            pass

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
            return {
                "has_active_window": False,
                "folder": None,
                "name": None,
                "window_title": None
            }

        # Check foreground window first if it's an Antigravity window
        fg_hwnd = user32.GetForegroundWindow()
        selected_title = None
        for hwnd, title in found:
            if hwnd == fg_hwnd:
                selected_title = title
                break
        if not selected_title:
            selected_title = found[0][1]

        # Extract folder candidate from title, e.g. "sist - Antigravity IDE" -> "sist"
        candidate_name = selected_title.split(" - ")[0].strip()
        
        # Try finding corresponding path on E:\ or common drives
        resolved_path = None
        for base_drive in [Path("E:\\"), Path("D:\\"), Path("C:\\")]:
            if base_drive.exists():
                candidate_path = base_drive / candidate_name
                if candidate_path.exists() and candidate_path.is_dir():
                    resolved_path = candidate_path
                    break

        if not resolved_path:
            parent = get_workspace_root().parent
            candidate_path = parent / candidate_name
            if candidate_path.exists() and candidate_path.is_dir():
                resolved_path = candidate_path

        folder_str = str(resolved_path) if resolved_path else None
        return {
            "has_active_window": True,
            "folder": folder_str,
            "name": resolved_path.name if resolved_path else candidate_name,
            "window_title": selected_title
        }
    except Exception:
        return {
            "has_active_window": False,
            "folder": None,
            "name": None,
            "window_title": None
        }

@router.get("/current")
async def get_current_folder(_token: str = Depends(get_current_token)):
    """Returns the currently active project folder and laptop open folder state."""
    ws_root = get_workspace_root()
    laptop_state = detect_active_laptop_workspace()
    return {
        "folder": str(ws_root),
        "name": ws_root.name,
        "laptop_active_folder": laptop_state
    }

@router.get("/folders")
async def list_available_folders(_token: str = Depends(get_current_token)):
    """Lists top-level folders on E:\ drive for one-tap selection."""
    folders = []
    base_drive = Path("E:\\")

    if base_drive.exists():
        try:
            for item in base_drive.iterdir():
                if item.is_dir() and not item.name.startswith("$") and not item.name.startswith("."):
                    folders.append({
                        "name": item.name,
                        "path": str(item),
                        "modified": item.stat().st_mtime
                    })
        except Exception:
            pass

    folders.sort(key=lambda x: x["name"].lower())
    ws_root = get_workspace_root()

    return {
        "current_folder": str(ws_root),
        "current_name": ws_root.name,
        "folders": folders
    }

@router.post("/open-folder")
async def open_project_folder(
    payload: OpenFolderRequest,
    _token: str = Depends(get_current_token)
):
    """
    Sets the active project folder and opens it in Antigravity IDE on the laptop!
    """
    try:
        new_root = set_workspace_root(payload.path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    antigravity_launched = False
    if payload.launch_antigravity:
        try:
            if ANTIGRAVITY_CMD.exists():
                subprocess.Popen([str(ANTIGRAVITY_CMD), "-r", str(new_root)], shell=True)
                antigravity_launched = True
            else:
                exe = Path(os.environ.get("USERPROFILE") or Path.home()) / "AppData" / "Local" / "Programs" / "Antigravity IDE" / "Antigravity IDE.exe"
                if exe.exists():
                    subprocess.Popen([str(exe), str(new_root)], shell=True)
                    antigravity_launched = True
        except Exception:
            pass

    return {
        "status": "success",
        "current_folder": str(new_root),
        "name": new_root.name,
        "antigravity_opened": antigravity_launched,
        "message": f"Opened {new_root.name} in Antigravity on laptop"
    }

@router.get("/tree")
async def get_tree(
    subpath: str = Query("", description="Optional subdirectory relative to workspace root"),
    depth: int = Query(4, ge=1, le=10),
    _token: str = Depends(get_current_token)
):
    target_dir = resolve_safe_path(subpath)
    if not target_dir.exists() or not target_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Directory not found")
    
    ws_root = get_workspace_root()
    return {
        "workspace_root": str(ws_root),
        "folder_name": ws_root.name,
        "tree": build_tree(target_dir, current_depth=0, max_depth=depth)
    }

@router.get("/file")
async def get_file_content(
    path: str = Query(..., description="Relative file path"),
    _token: str = Depends(get_current_token)
):
    file_path = resolve_safe_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File does not exist")
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target path is a directory")
    
    file_size = file_path.stat().st_size
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds maximum viewable size")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "path": path.replace("\\", "/"),
            "content": content,
            "size": file_size,
            "modified": file_path.stat().st_mtime,
            "is_binary": False
        }
    except UnicodeDecodeError:
        return {
            "path": path.replace("\\", "/"),
            "content": "[Binary file. Use Download option to view on device.]",
            "size": file_size,
            "modified": file_path.stat().st_mtime,
            "is_binary": True
        }

@router.post("/file")
async def save_file_content(
    payload: SaveFileRequest,
    _token: str = Depends(get_current_token)
):
    file_path = resolve_safe_path(payload.path)
    backup_path_str = None
    file_path.parent.mkdir(parents=True, exist_ok=True)

    if file_path.exists() and payload.create_backup:
        try:
            timestamp = int(time.time())
            backup_file = file_path.with_name(f"{file_path.name}.bak_{timestamp}")
            shutil.copy2(file_path, backup_file)
            ws_root = get_workspace_root()
            backup_path_str = str(backup_file.relative_to(ws_root)).replace("\\", "/")
        except Exception:
            pass

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(payload.content)
    
    stat = file_path.stat()
    return {
        "status": "success",
        "message": "File saved successfully",
        "path": payload.path.replace("\\", "/"),
        "size": stat.st_size,
        "backup_path": backup_path_str
    }

@router.get("/download")
async def download_file(
    path: str = Query(..., description="Relative file path"),
    _token: str = Depends(get_current_token)
):
    file_path = resolve_safe_path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/octet-stream"
    )
