import React, { useState, useEffect } from "react";
import {
  Sparkles, Lock, Volume2, VolumeX, Volume1, Moon,
  FolderOpen, Globe, RefreshCw, FileText, CheckCircle2,
  Terminal, Play, ChevronRight, Activity, Cpu
} from "lucide-react";
import {
  getAntigravityStatus,
  getAntigravityTranscript,
  getAntigravityArtifacts,
  getArtifactContent,
  executeRemoteAction
} from "../api";

export default function AntigravityTab({ onDispatchCommand }) {
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [viewMode, setViewMode] = useState("remote"); // "remote", "timeline", "artifacts"

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [st, tr, art] = await Promise.all([
        getAntigravityStatus().catch(() => null),
        getAntigravityTranscript(null, 25).catch(() => null),
        getAntigravityArtifacts().catch(() => ({ artifacts: [] }))
      ]);
      setStatus(st);
      setTranscript(tr);
      setArtifacts(art?.artifacts || []);
    } catch (_) {}
    finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoteAction = async (action, target = null) => {
    try {
      const res = await executeRemoteAction(action, target);
      setActionFeedback({ type: "success", text: res.message || "Action executed!" });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback({ type: "error", text: err.message });
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleOpenArtifact = async (name) => {
    try {
      const res = await getArtifactContent(name);
      setSelectedArtifact(res);
    } catch (err) {
      alert(`Could not open artifact: ${err.message}`);
    }
  };

  const slashCommands = [
    { label: "/goal", desc: "Long-running thorough autonomous goal", cmd: "echo '[Goal Mode Activated]'" },
    { label: "/plan", desc: "Interactive step-by-step planning", cmd: "git status" },
    { label: "/grill-me", desc: "Design & requirements interview", cmd: "echo '[Interview Ready]'" },
    { label: "/learn", desc: "Persist lessons for future tasks", cmd: "echo '[Memory Persisted]'" }
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Top Antigravity Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950/40 border border-indigo-800/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Antigravity Control Center</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Agent Brain Active</span>
              </div>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900/60 border border-indigo-700/40 text-indigo-300 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Full remote access to your laptop, Antigravity conversation brain, background tasks, and agent artifacts.
        </p>

        {actionFeedback && (
          <div className="mt-3 p-2 rounded-xl bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-300 font-medium">
            {actionFeedback.text}
          </div>
        )}
      </div>

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setViewMode("remote")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewMode === "remote" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400"
          }`}
        >
          Remote Controls
        </button>
        <button
          onClick={() => setViewMode("timeline")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewMode === "timeline" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400"
          }`}
        >
          Live Agent Steps
        </button>
        <button
          onClick={() => setViewMode("artifacts")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewMode === "artifacts" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400"
          }`}
        >
          Artifacts ({artifacts.length})
        </button>
      </div>

      {/* VIEW 1: LAPTOP REMOTE CONTROLS */}
      {viewMode === "remote" && (
        <div className="space-y-4">
          {/* Quick Hardware Actions */}
          <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Laptop Hardware Actions</h3>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleRemoteAction("lock_pc")}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 active:scale-95 transition text-left"
              >
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Lock Laptop</div>
                  <div className="text-[10px] text-slate-500">Lock Workstation</div>
                </div>
              </button>

              <button
                onClick={() => handleRemoteAction("sleep_display")}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 active:scale-95 transition text-left"
              >
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Screen Off</div>
                  <div className="text-[10px] text-slate-500">Powers down display</div>
                </div>
              </button>

              <button
                onClick={() => handleRemoteAction("open_folder")}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 active:scale-95 transition text-left"
              >
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">File Explorer</div>
                  <div className="text-[10px] text-slate-500">Open on laptop</div>
                </div>
              </button>

              <button
                onClick={() => handleRemoteAction("open_url", "https://antigravity.google")}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 active:scale-95 transition text-left"
              >
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Open Browser</div>
                  <div className="text-[10px] text-slate-500">Antigravity Docs</div>
                </div>
              </button>
            </div>

            {/* Volume Control Bar */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Laptop Audio:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleRemoteAction("volume_mute")}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 active:scale-95"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Mute</span>
                </button>
                <button
                  onClick={() => handleRemoteAction("volume_down")}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 active:scale-95"
                >
                  <Volume1 className="w-3.5 h-3.5" />
                  <span>Vol -</span>
                </button>
                <button
                  onClick={() => handleRemoteAction("volume_up")}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 active:scale-95"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Vol +</span>
                </button>
              </div>
            </div>
          </div>

          {/* Antigravity Slash Command Trigger */}
          <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Antigravity Command Trigger</h3>
            <div className="grid grid-cols-2 gap-2">
              {slashCommands.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onDispatchCommand && onDispatchCommand(item.cmd)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left active:scale-95 transition"
                >
                  <div className="text-xs font-bold font-mono text-indigo-400">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE AGENT STEPS TIMELINE */}
      {viewMode === "timeline" && (
        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Agent Steps</h3>
            <span className="text-[10px] font-mono text-slate-500">
              Steps: {transcript?.steps?.length || 0}
            </span>
          </div>

          {!transcript?.steps || transcript.steps.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">
              No recent steps found in the conversation transcript.
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {transcript.steps.map((st, i) => {
                const isUser = st.type === "USER_INPUT";
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      isUser
                        ? "bg-indigo-950/40 border-indigo-800/50 text-indigo-200"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                      <span className="font-semibold text-slate-400">
                        {isUser ? "👤 User Prompt" : `🤖 Step #${st.index}`}
                      </span>
                      {st.status && <span className="uppercase">{st.status}</span>}
                    </div>

                    {st.content_preview && (
                      <div className="whitespace-pre-wrap font-mono text-[11px] break-words">
                        {st.content_preview}
                      </div>
                    )}

                    {st.tools && st.tools.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
                        {st.tools.map((tool, ti) => (
                          <span
                            key={ti}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400 font-mono"
                          >
                            ⚡ {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: ARTIFACTS READER */}
      {viewMode === "artifacts" && (
        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Agent Generated Artifacts</h3>

          {selectedArtifact ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-white truncate">{selectedArtifact.name}</span>
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Back to List
                </button>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl max-h-[380px] overflow-y-auto text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedArtifact.content}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">No artifacts in this conversation yet.</div>
              ) : (
                artifacts.map((art, i) => (
                  <div
                    key={i}
                    onClick={() => handleOpenArtifact(art.name)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer active:scale-95 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">{art.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {(art.size_bytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
