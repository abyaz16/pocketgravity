import React, { useState } from "react";
import { Folder, QrCode, Play, X, ChevronDown, CheckCircle2, AlertCircle, Monitor, Battery, BatteryCharging, BatteryWarning, BatteryLow } from "lucide-react";
import { launchAntigravityOnLaptop, closeAntigravityOnLaptop } from "../api";
import { AntigravityStar } from "./AntigravityIcon";

export default function SimpleHeader({ currentFolder, onSwitchFolder, isConnected, onOpenQR, battery }) {
  const [feedback, setFeedback] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const folderName = currentFolder ? currentFolder.split(/[/\\]/).pop() : "No Folder";

  const handleLaunchIDE = async () => {
    setIsBusy(true);
    try {
      const res = await launchAntigravityOnLaptop(currentFolder);
      setFeedback({ type: "success", text: res.message || "Antigravity focused on laptop!" });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to launch Antigravity" });
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCloseIDE = async () => {
    if (!window.confirm(`Close Antigravity IDE window for ${folderName} on laptop?`)) return;
    setIsBusy(true);
    try {
      const res = await closeAntigravityOnLaptop(currentFolder);
      setFeedback({ type: "success", text: res.message || "Antigravity window closed." });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to close Antigravity" });
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gravity-bg/90 backdrop-blur-xl border-b border-gravity-border px-3 py-2 pt-safe transition-all shadow-md">
      {/* Top Branding & Connection Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Antigravity Logo & Workspace Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.25)]">
              <AntigravityStar className="w-4 h-4" glow />
            </div>
            <div className="hidden min-[380px]:flex flex-col">
              <span className="text-xs font-black tracking-tight agy-gradient-text">POCKETGRAVITY</span>
              <span className="text-[8px] font-mono tracking-widest text-slate-400 uppercase -mt-0.5">Remote IDE</span>
            </div>
          </div>

          {/* Folder Switcher Capsule */}
          <button
            onClick={onSwitchFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gravity-surface hover:bg-gravity-card border border-gravity-border hover:border-indigo-500/50 text-left active:scale-95 transition-all truncate group shadow-sm"
            title="Switch Workspace Folder"
          >
            <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:text-indigo-300" />
            <span className="text-xs font-semibold text-slate-100 truncate max-w-[95px] sm:max-w-[140px]">
              {folderName}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-indigo-400 transition" />
          </button>
        </div>

        {/* Action Controls & Beacon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Laptop Battery Indicator */}
          {battery && battery.percent !== undefined && (
            <div
              className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono transition-colors ${
                battery.power_plugged
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : battery.percent <= 10
                  ? "bg-rose-950/80 border-rose-800 text-rose-300 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                  : battery.percent <= 20
                  ? "bg-amber-950/50 border-amber-800/70 text-amber-300"
                  : "bg-gravity-surface border-gravity-border text-slate-300"
              }`}
              title={`Laptop Battery: ${battery.percent}% (${battery.power_plugged ? "Charging" : "On Battery"})`}
            >
              {battery.power_plugged ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : battery.percent <= 10 ? (
                <BatteryWarning className="w-3.5 h-3.5 text-rose-400" />
              ) : battery.percent <= 20 ? (
                <BatteryLow className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span className="font-semibold">{Math.round(battery.percent)}%</span>
            </div>
          )}

          {/* Connection status beacon */}
          <div
            className={`hidden min-[360px]:flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono ${
              isConnected
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                : "bg-amber-950/40 border-amber-800/60 text-amber-300"
            }`}
            title={isConnected ? "Tailscale Zero-Trust Connected" : "Connecting..."}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="hidden sm:inline">{isConnected ? "Live" : "Syncing"}</span>
          </div>

          {/* Focus IDE button */}
          <button
            onClick={handleLaunchIDE}
            disabled={isBusy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 disabled:opacity-40 text-white text-[11px] font-semibold active:scale-95 transition shadow-[0_0_12px_rgba(99,102,241,0.3)] border border-indigo-400/30"
            title="Focus or open Antigravity IDE on laptop"
          >
            <Monitor className="w-3 h-3" />
            <span className="font-medium">Focus</span>
          </button>

          {/* Close IDE button */}
          <button
            onClick={handleCloseIDE}
            disabled={isBusy}
            className="p-1.5 rounded-xl bg-gravity-surface hover:bg-rose-950/50 border border-gravity-border hover:border-rose-500/40 text-slate-400 hover:text-rose-300 active:scale-95 transition"
            title="Close Antigravity IDE window on laptop"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* QR Button */}
          <button
            onClick={onOpenQR}
            className="p-1.5 rounded-xl bg-gravity-surface hover:bg-gravity-card border border-gravity-border hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 active:scale-95 transition shadow-sm"
            title="Show Phone Connection QR"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`mt-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-950/90 border border-emerald-800 text-emerald-300"
              : "bg-rose-950/90 border border-rose-800 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className="truncate">{feedback.text}</span>
        </div>
      )}
    </header>
  );
}
