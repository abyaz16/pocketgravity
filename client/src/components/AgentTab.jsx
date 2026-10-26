import React, { useState, useEffect } from "react";
import {
  Sparkles, Play, RefreshCw, GitCompare, Laptop,
  CheckCircle2, AlertCircle, FileText, ChevronRight, Terminal
} from "lucide-react";
import {
  getAntigravityStatus,
  getAntigravityTranscript,
  getAntigravityArtifacts,
  getArtifactContent,
  launchAntigravityOnLaptop
} from "../api";

export default function AgentTab({ onDispatchCommand }) {
  const [promptText, setPromptText] = useState("");
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [launchMessage, setLaunchMessage] = useState(null);
  const [viewSubTab, setViewSubTab] = useState("prompt"); // "prompt", "timeline", "artifacts"

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

  const handleLaunchAntigravity = async () => {
    try {
      const res = await launchAntigravityOnLaptop();
      setLaunchMessage({ type: "success", text: "Antigravity IDE opened on laptop!" });
      setTimeout(() => setLaunchMessage(null), 3500);
    } catch (err) {
      setLaunchMessage({ type: "error", text: err.message });
      setTimeout(() => setLaunchMessage(null), 3500);
    }
  };

  const handleSendPrompt = () => {
    if (!promptText.trim()) return;
    if (onDispatchCommand) {
      onDispatchCommand(promptText.trim());
    }
    setPromptText("");
  };

  const slashCommands = [
    { label: "/goal", text: "/goal Execute complete autonomous implementation" },
    { label: "/plan", text: "/plan Review architecture and create step-by-step plan" },
    { label: "/grill-me", text: "/grill-me Ask interview questions about design tradeoffs" },
    { label: "/learn", text: "/learn Save this workflow rule for future tasks" },
    { label: "Git Status", text: "git status --short" },
    { label: "Git Diff", text: "git diff" }
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Top Launch Antigravity Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950/40 border border-indigo-500/40 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Antigravity AI Agent</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Laptop Brain Connected</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLaunchAntigravity}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 active:scale-95 transition"
            title="Open Antigravity IDE on laptop desktop"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Open in Laptop</span>
          </button>
        </div>

        {launchMessage && (
          <div
            className={`mt-2.5 p-2 rounded-xl text-xs font-medium ${
              launchMessage.type === "success"
                ? "bg-emerald-950/80 border border-emerald-700 text-emerald-300"
                : "bg-rose-950/80 border border-rose-700 text-rose-300"
            }`}
          >
            {launchMessage.text}
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setViewSubTab("prompt")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewSubTab === "prompt" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400"
          }`}
        >
          Prompt / Run
        </button>
        <button
          onClick={() => setViewSubTab("timeline")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewSubTab === "timeline" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400"
          }`}
        >
          Live Steps ({transcript?.steps?.length || 0})
        </button>
        <button
          onClick={() => setViewSubTab("artifacts")}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            viewSubTab === "artifacts" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400"
          }`}
        >
          Artifacts ({artifacts.length})
        </button>
      </div>

      {/* TAB 1: PROMPT INPUT */}
      {viewSubTab === "prompt" && (
        <div className="p-4 rounded-3xl bg-gravity-card border border-gravity-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Dispatch Prompt to Laptop
            </span>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Type your task prompt for Antigravity Agent (e.g. 'Build the login page', 'Fix button style', or '/goal ...')"
            rows={5}
            className="w-full p-3 rounded-2xl bg-gravity-terminal border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />

          {/* Quick slash action chips */}
          <div className="flex flex-wrap gap-1.5">
            {slashCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => setPromptText(cmd.text)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-indigo-300 font-mono active:scale-95 transition"
              >
                {cmd.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSendPrompt}
            disabled={!promptText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Run Prompt on Laptop</span>
          </button>
        </div>
      )}

      {/* TAB 2: LIVE STEPS TIMELINE */}
      {viewSubTab === "timeline" && (
        <div className="p-4 rounded-3xl bg-gravity-card border border-gravity-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Agent Activity Stream</h3>
            <button onClick={loadData} className="p-1 rounded bg-slate-800 text-slate-400">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {!transcript?.steps || transcript.steps.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">
              No recent steps recorded. Type a prompt above to start!
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {transcript.steps.map((st, i) => {
                const isUser = st.type === "USER_INPUT";
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                      isUser
                        ? "bg-indigo-950/40 border-indigo-800/50 text-indigo-200"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                      <span className="font-semibold text-slate-300">
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
                            className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-[10px] text-emerald-400 font-mono"
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

      {/* TAB 3: ARTIFACTS READER */}
      {viewSubTab === "artifacts" && (
        <div className="p-4 rounded-3xl bg-gravity-card border border-gravity-border space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Generated Artifacts</h3>
          {selectedArtifact ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-white truncate">{selectedArtifact.name}</span>
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Back
                </button>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl max-h-[380px] overflow-y-auto text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedArtifact.content}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">No artifacts created yet.</div>
              ) : (
                artifacts.map((art, i) => (
                  <div
                    key={i}
                    onClick={() => getArtifactContent(art.name).then(setSelectedArtifact)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer active:scale-95 transition"
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
