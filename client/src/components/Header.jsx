import React from "react";
import { Laptop, Settings, QrCode, BatteryCharging, Battery, Radio } from "lucide-react";

export default function Header({ systemMetrics, isConnected, onOpenSettings, onOpenQR }) {
  const battery = systemMetrics?.battery;
  const cpuPercent = systemMetrics?.cpu?.percent ?? "--";

  return (
    <header className="sticky top-0 z-40 bg-gravity-bg/90 backdrop-blur-md border-b border-gravity-border px-4 py-2.5 flex items-center justify-between pt-safe">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Radio className="w-4 h-4 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-sm tracking-tight text-white">PocketGravity</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
              v2.0
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400"}`} />
            <span>{isConnected ? "Connected" : "Disconnected"}</span>
            <span className="text-slate-600">/</span>
            <span className="font-mono text-[10px]">{systemMetrics?.os?.node || "Laptop"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Instant QR Pairing Button */}
        <button
          onClick={onOpenQR}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white active:scale-95 transition text-xs font-semibold shadow-sm"
          title="Scan QR to Connect Phone"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect Phone</span>
        </button>

        {battery && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            {battery.power_plugged ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-mono font-medium">{battery.percent}%</span>
          </div>
        )}

        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 active:scale-95 transition text-slate-300 hover:text-white"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
