import React, { useState, useEffect } from "react";
import { Sparkles, Play, RefreshCw, GitCompare, CheckCircle2, AlertCircle } from "lucide-react";
import { getWorkspaceDiff } from "../api";

export default function PromptTab({ onDispatchCommand }) {
  const [promptText, setPromptText] = useState("");
  const [diffData, setDiffData] = useState(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [activeTab, setActiveTab] = useState("prompt"); // "prompt" or "diff"

  const fetchDiff = async () => {
    setIsLoadingDiff(true);
    try {
      const data = await getWorkspaceDiff();
      setDiffData(data);
    } catch (_) {
    } finally {
      setIsLoadingDiff(false);
    }
  };

  useEffect(() => {
    fetchDiff();
  }, []);

  const handleExecutePromptAsCommand = () => {
    if (!promptText.trim()) return;
    if (onDispatchCommand) {
      onDispatchCommand(promptText.trim());
    }
  };

  const renderDiffLines = (text) => {
    if (!text) {
      return <div className="text-xs text-slate-500 py-6 text-center">Working directory is clean. No uncommitted diffs.</div>;
    }
    const lines = text.split("\n");
    return (
      <div className="font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => {
          let color = "text-slate-300";
          let bg = "bg-transparent";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            color = "text-emerald-400";
            bg = "bg-emerald-950/30";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            color = "text-rose-400";
            bg = "bg-rose-950/30";
          } else if (line.startsWith("@@")) {
            color = "text-sky-400 font-bold";
            bg = "bg-sky-950/20";
          }
          return (
            <div key={i} className={`${color} ${bg} px-2 py-0.5 rounded-sm whitespace-pre-wrap break-all`}>
              {line || " "}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-20">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab("prompt")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === "prompt" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
          }`}
        >
          Instruction Prompt
        </button>
        <button
          onClick={() => { setActiveTab("diff"); fetchDiff(); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === "diff" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
          }`}
        >
          Git Diff Inspector
        </button>
      </div>

      {activeTab === "prompt" ? (
        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Antigravity Task Dispatch</span>
            </div>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Write task instruction or quick command to dispatch to laptop runner..."
            rows={6}
            className="w-full p-3 rounded-xl bg-gravity-terminal border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />

          <div className="flex flex-wrap gap-1.5">
            {[
              "git status",
              "git log -n 3 --oneline",
              "npm test",
              "python -m pytest"
            ].map((snippet) => (
              <button
                key={snippet}
                onClick={() => setPromptText(snippet)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 font-mono active:scale-95"
              >
                {snippet}
              </button>
            ))}
          </div>

          <button
            onClick={handleExecutePromptAsCommand}
            disabled={!promptText.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Send to Runner / Terminal</span>
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <GitCompare className="w-4 h-4 text-emerald-400" />
              <span>Uncommitted Modifications</span>
            </div>
            <button
              onClick={fetchDiff}
              disabled={isLoadingDiff}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiff ? "animate-spin" : ""}`} />
            </button>
          </div>

          {diffData?.status && (
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre">
              {diffData.status}
            </div>
          )}

          <div className="max-h-[360px] overflow-y-auto p-2 rounded-xl bg-gravity-terminal border border-slate-800">
            {renderDiffLines(diffData?.diff)}
          </div>
        </div>
      )}
    </div>
  );
}
