import React from "react";
import { Cpu, HardDrive, Zap, Clock, Laptop, RefreshCw } from "lucide-react";

export default function DashboardTab({ metrics, onRefresh, isLoading }) {
  if (!metrics) {
    return (
      <div className="p-6 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Fetching system telemetry...</p>
      </div>
    );
  }

  const { cpu, memory, battery, disk, os, workspace_root } = metrics;
  const wsDisk = disk?.workspace;

  return (
    <div className="space-y-4 pb-20">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-900/40 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium mb-1">
              <Laptop className="w-3.5 h-3.5" />
              <span>{os?.node || "Host Laptop"}</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{os?.system} {os?.release}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[280px]">
              Root: {workspace_root}
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-indigo-900/30 border border-indigo-800/40 text-indigo-300 active:scale-95 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 font-mono">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Uptime: <strong className="text-white">{os?.uptime_formatted}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Processor</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {cpu?.percent}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, cpu?.percent || 0)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex justify-between">
              <span>{cpu?.cores_logical} Cores</span>
              {cpu?.current_freq_mhz && <span>{cpu.current_freq_mhz} MHz</span>}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">RAM</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {memory?.percent}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${memory?.percent || 0}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {memory?.used_readable} / {memory?.total_readable}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Battery</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {battery ? `${battery.percent}%` : "AC Power"}
            </div>
            {battery && (
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${battery.power_plugged ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${battery.percent}%` }}
                />
              </div>
            )}
            <div className="text-[11px] text-slate-400 font-mono">
              {battery?.power_plugged ? "Plugged in" : "On Battery"}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Storage</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {wsDisk ? `${wsDisk.percent}%` : "--"}
            </div>
            {wsDisk && (
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${wsDisk.percent}%` }}
                />
              </div>
            )}
            <div className="text-[11px] text-slate-400 font-mono">
              {wsDisk ? `${wsDisk.free_readable} Free` : "E:\ Workspace"}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-gravity-card border border-gravity-border space-y-2 text-xs">
        <h3 className="font-semibold text-slate-200">System Information</h3>
        <div className="grid grid-cols-2 gap-2 text-slate-400 font-mono text-[11px]">
          <div>OS: <span className="text-slate-200">{os?.system}</span></div>
          <div>Arch: <span className="text-slate-200">{os?.machine}</span></div>
          <div>Node: <span className="text-slate-200">{os?.node}</span></div>
          <div>Available RAM: <span className="text-slate-200">{memory?.available_readable}</span></div>
        </div>
      </div>
    </div>
  );
}
