import React, { useState, useEffect, useRef } from "react";
import { Terminal, Send, Square, Trash2, Cpu, Zap, ArrowDownCircle, CheckCircle2 } from "lucide-react";
import TerminalOutput from "./TerminalOutput";
import { getClaudeWsUrl, getClaudeStatus } from "../api";

export default function ClaudeTab() {
  const [logs, setLogs] = useState([]);
  const [promptInput, setPromptInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [claudeInfo, setClaudeInfo] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [autoScroll, setAutoScroll] = useState(true);

  const wsRef = useRef(null);

  const connectWs = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus("connecting");
    const wsUrl = getClaudeWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      setLogs((prev) => [
        ...prev,
        { type: "system", text: "Connected to Claude Code CLI on Laptop" }
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
            setIsRunning(true);
            setLogs((prev) => [...prev, { type: "system", text: `Claude prompt: "${msg.prompt}"` }]);
          } else if (msg.status === "finished") {
            setIsRunning(false);
            setLogs((prev) => [
              ...prev,
              { type: "system", text: `[Claude finished with exit code ${msg.exit_code}]` }
            ]);
          } else if (msg.status === "stopped") {
            setIsRunning(false);
            setLogs((prev) => [...prev, { type: "system", text: "[Claude session stopped]" }]);
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
      setTimeout(connectWs, 2500);
    };

    ws.onerror = () => {
      setWsStatus("disconnected");
    };
  };

  useEffect(() => {
    getClaudeStatus().then(setClaudeInfo).catch(() => {});
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleSendPrompt = (text) => {
    const p = text || promptInput;
    if (!p.trim()) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setLogs((prev) => [...prev, { type: "error", text: "WebSocket disconnected. Reconnecting..." }]);
      connectWs();
      return;
    }

    wsRef.current.send(JSON.stringify({ action: "run", prompt: p.trim() }));
    setPromptInput("");
  };

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "stop" }));
    }
  };

  const quickPrompts = [
    { label: "Architecture", prompt: "Explain the project structure and main files" },
    { label: "Find Bugs", prompt: "Inspect workspace for potential bugs or errors" },
    { label: "Run Tests", prompt: "Run all automated tests in this project" },
    { label: "Doctor", prompt: "claude doctor" }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] rounded-3xl bg-gravity-card border border-gravity-border overflow-hidden shadow-2xl">
      {/* Top Header */}
      <div className="px-3 py-2 bg-slate-900 border-b border-gravity-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Claude Code CLI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {claudeInfo?.version || "Claude 2.1"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md active:scale-95 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <TerminalOutput
        logs={logs}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
      />

      {/* Quick Prompt Chips */}
      <div className="px-2 py-1.5 bg-slate-900 border-t border-gravity-border overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPrompts.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendPrompt(q.prompt)}
            className="shrink-0 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 font-mono active:scale-95 transition"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Prompt Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt();
        }}
        className="p-2 bg-slate-950 border-t border-gravity-border flex items-center gap-2"
      >
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Ask Claude Code to build, refactor, or test..."
          spellCheck="false"
          className="flex-1 bg-transparent px-2 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!promptInput.trim()}
          className="p-2 rounded-xl bg-amber-600 disabled:bg-slate-800 text-white disabled:text-slate-600 active:scale-95 transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
