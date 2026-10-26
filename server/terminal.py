"""
Interactive streaming execution terminal using WebSockets and asynchronous child processes.
"""
import asyncio
import json
import os
import platform
import subprocess
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from server.auth import verify_token
from server.config import WORKSPACE_ROOT

router = APIRouter(tags=["Terminal"])

IS_WINDOWS = platform.system() == "Windows"

class TerminalSession:
    """Manages an active process execution and streams I/O to a WebSocket client."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.process: Optional[asyncio.subprocess.Process] = None
        self.read_tasks: list[asyncio.Task] = []
        self.is_running = False

    async def send_json(self, payload: dict):
        try:
            await self.websocket.send_text(json.dumps(payload))
        except Exception:
            pass

    async def _stream_pipe(self, stream: asyncio.StreamReader, stream_name: str):
        """Continuously read lines from stdout/stderr and push to WebSocket."""
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace")
                await self.send_json({
                    "type": stream_name,
                    "data": text
                })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            await self.send_json({"type": "error", "message": f"Stream read error: {str(e)}"})

    async def execute_command(self, command: str, cwd_rel: str = ""):
        """Spawn a child process and begin streaming output."""
        if self.is_running and self.process and self.process.returncode is None:
            await self.send_json({
                "type": "error",
                "message": "A process is already running. Stop it first."
            })
            return

        # Resolve working directory
        exec_cwd = WORKSPACE_ROOT
        if cwd_rel:
            try:
                candidate = (WORKSPACE_ROOT / cwd_rel.strip().lstrip("/\\")).resolve()
                candidate.relative_to(WORKSPACE_ROOT)
                if candidate.is_dir():
                    exec_cwd = candidate
            except Exception:
                exec_cwd = WORKSPACE_ROOT

        await self.send_json({
            "type": "status",
            "status": "starting",
            "command": command,
            "cwd": str(exec_cwd.relative_to(WORKSPACE_ROOT)) if exec_cwd != WORKSPACE_ROOT else "."
        })

        try:
            if IS_WINDOWS:
                # Use PowerShell or cmd on Windows
                self.process = await asyncio.create_subprocess_exec(
                    "powershell.exe",
                    "-NoProfile",
                    "-Command",
                    command,
                    cwd=str(exec_cwd),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    stdin=asyncio.subprocess.PIPE
                )
            else:
                self.process = await asyncio.create_subprocess_shell(
                    command,
                    cwd=str(exec_cwd),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    stdin=asyncio.subprocess.PIPE
                )

            self.is_running = True
            await self.send_json({
                "type": "status",
                "status": "running",
                "pid": self.process.pid
            })

            # Start reading stdout and stderr concurrently
            self.read_tasks = [
                asyncio.create_task(self._stream_pipe(self.process.stdout, "stdout")),
                asyncio.create_task(self._stream_pipe(self.process.stderr, "stderr")),
            ]

            # Wait for process exit in background task
            asyncio.create_task(self._wait_for_exit())

        except Exception as e:
            self.is_running = False
            await self.send_json({
                "type": "status",
                "status": "failed",
                "error": str(e)
            })

    async def _wait_for_exit(self):
        """Monitors child process until completion and emits exit code."""
        if not self.process:
            return
        try:
            return_code = await self.process.wait()
            # Wait briefly for remaining stdout/stderr lines to drain
            if self.read_tasks:
                await asyncio.gather(*self.read_tasks, return_exceptions=True)
            self.is_running = False
            await self.send_json({
                "type": "status",
                "status": "exited",
                "exit_code": return_code
            })
        except Exception:
            pass

    async def send_input(self, data: str):
        """Pass input bytes to the stdin of the running child process."""
        if self.process and self.process.stdin and not self.process.stdin.is_closing():
            try:
                self.process.stdin.write(data.encode("utf-8"))
                await self.process.stdin.drain()
            except Exception as e:
                await self.send_json({"type": "error", "message": f"Stdin error: {str(e)}"})

    async def stop_process(self):
        """Kill running child process and its sub-processes."""
        if not self.process or self.process.returncode is not None:
            await self.send_json({"type": "status", "status": "no_process_running"})
            return

        pid = self.process.pid
        try:
            if IS_WINDOWS:
                # taskkill /F /T kills entire process tree cleanly on Windows
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
            else:
                self.process.terminate()
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=2.0)
                except asyncio.TimeoutError:
                    self.process.kill()
        except Exception as e:
            await self.send_json({"type": "error", "message": f"Stop process error: {str(e)}"})

        for t in self.read_tasks:
            t.cancel()
        self.is_running = False
        await self.send_json({
            "type": "status",
            "status": "terminated",
            "message": f"Process {pid} terminated."
        })

@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """
    WebSocket endpoint for bidirectional terminal streaming.
    Authentication token can be provided via query param ?token=... or initial auth message.
    """
    await websocket.accept()

    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token or not verify_token(token):
        # Await auth message if not in query
        try:
            raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            data = json.loads(raw_msg)
            if data.get("action") == "auth" and verify_token(data.get("token")):
                token = data.get("token")
            else:
                await websocket.send_text(json.dumps({"type": "error", "message": "Authentication failed"}))
                await websocket.close(code=1008)
                return
        except Exception:
            await websocket.send_text(json.dumps({"type": "error", "message": "Authentication required"}))
            await websocket.close(code=1008)
            return

    await websocket.send_text(json.dumps({
        "type": "ready",
        "message": "Connected to PocketGravity Terminal Daemon",
        "system": platform.system(),
        "workspace": str(WORKSPACE_ROOT)
    }))

    session = TerminalSession(websocket)

    try:
        while True:
            msg_text = await websocket.receive_text()
            try:
                msg = json.loads(msg_text)
            except Exception:
                await session.send_json({"type": "error", "message": "Invalid JSON format"})
                continue

            action = msg.get("action")
            if action == "execute":
                cmd = msg.get("command", "").strip()
                cwd = msg.get("cwd", "")
                if cmd:
                    await session.execute_command(cmd, cwd)
            elif action == "input":
                await session.send_input(msg.get("data", ""))
            elif action == "stop" or action == "kill":
                await session.stop_process()
            elif action == "ping":
                await session.send_json({"type": "pong", "time": time.time()})
            else:
                await session.send_json({"type": "error", "message": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        await session.stop_process()
    except Exception:
        await session.stop_process()
