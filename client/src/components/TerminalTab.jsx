import React, { useState, useEffect, useRef } from "react";
import { Send, Square, Trash2, ArrowDownCircle, Play, CornerDownLeft, Radio, Terminal as TermIcon } from "lucide-react";
import TerminalOutput from "./TerminalOutput";
import { getWsUrl } from "../api";

export default function TerminalTab({ onProcessStateChange }) {
  const [logs, setLogs] = useState([]);
  const [commandInput, setCommandInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activePid, setActivePid] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // "connecting", "connected", "disconnected"
  const [autoScroll, setAutoScroll] = useState(true);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connectWs = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus("connecting");
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      setLogs((prev) => [
        ...prev,
        { type: "system", text: "Connected to PocketGravity WebSocket Daemon" }
      ]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "stdout") {
          setLogs((prev) => [...prev, { type: "stdout", text: msg.data }]);
        } else if (msg.type === "stderr") {
          setLogs((prev) => [...prev, { type: "stderr", text: msg.data }]);
        } else if (msg.type === "status") {
          if (msg.status === "starting") {
            setLogs((prev) => [...prev, { type: "system", text: `$ ${msg.command}` }]);
          } else if (msg.status === "running") {
            setIsRunning(true);
            setActivePid(msg.pid);
            if (onProcessStateChange) onProcessStateChange(true);
          } else if (msg.status === "exited") {
            setIsRunning(false);
            setActivePid(null);
            if (onProcessStateChange) onProcessStateChange(false);
            setLogs((prev) => [
              ...prev,
              { type: "system", text: `[Process exited with code ${msg.exit_code}]` }
            ]);
          } else if (msg.status === "terminated") {
            setIsRunning(false);
            setActivePid(null);
            if (onProcessStateChange) onProcessStateChange(false);
            setLogs((prev) => [...prev, { type: "system", text: `[${msg.message}]` }]);
          }
        } else if (msg.type === "error") {
          setLogs((prev) => [...prev, { type: "error", text: msg.message }]);
        }
      } catch (_) {
        setLogs((prev) => [...prev, { type: "stdout", text: event.data }]);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      setIsRunning(false);
      setActivePid(null);
      if (onProcessStateChange) onProcessStateChange(false);
      // Auto reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = () => {
      setWsStatus("disconnected");
    };
  };

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendCommand = (cmd) => {
    const text = cmd || commandInput;
    if (!text.trim()) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setLogs((prev) => [...prev, { type: "error", text: "WebSocket disconnected. Reconnecting..." }]);
      connectWs();
      return;
    }

    wsRef.current.send(JSON.stringify({ action: "execute", command: text.trim() }));
    setCommandInput("");
  };

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "stop" }));
    }
  };

  const quickActions = [
    { label: "Git Status", cmd: "git status --short" },
    { label: "Git Diff", cmd: "git diff" },
    { label: "List Files", cmd: "dir" },
    { label: "NPM Dev", cmd: "npm run dev" },
    { label: "Python Test", cmd: "python -m unittest" }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] rounded-2xl bg-gravity-card border border-gravity-border overflow-hidden">
      {/* Terminal Top Bar */}
      <div className="px-3 py-2 bg-slate-900 border-b border-gravity-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TermIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">Terminal Shell</span>
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === "connected"
                ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                : wsStatus === "connecting"
                ? "bg-amber-400 animate-ping"
                : "bg-rose-400"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-[10px] text-emerald-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>PID {activePid}</span>
            </div>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg text-xs transition ${
              autoScroll ? "bg-indigo-900/40 text-indigo-300" : "bg-slate-800 text-slate-500"
            }`}
            title="Toggle Auto Scroll"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition"
            title="Clear Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {isRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium active:scale-95 shadow-sm shadow-rose-600/30 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <TerminalOutput
        logs={logs}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
      />

      {/* Quick Action Chips */}
      <div className="px-2 py-1.5 bg-slate-900 border-t border-gravity-border overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => sendCommand(action.cmd)}
            className="shrink-0 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono active:scale-95 transition"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input Bottom Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendCommand();
        }}
        className="p-2 bg-slate-950 border-t border-gravity-border flex items-center gap-2"
      >
        <span className="text-indigo-400 font-mono text-xs pl-1 font-bold">{">"}</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Type shell command..."
          spellCheck="false"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="p-2 rounded-xl bg-indigo-600 disabled:bg-slate-800 text-white disabled:text-slate-600 active:scale-95 transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
