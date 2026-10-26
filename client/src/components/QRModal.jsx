import React, { useState, useEffect } from "react";
import { X, Copy, Check, Wifi, Globe, ShieldCheck } from "lucide-react";
import { getConnectInfo, getBaseApiUrl } from "../api";
import { AntigravityStar } from "./AntigravityIcon";

export default function QRModal({ isOpen, onClose }) {
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("wifi"); // "wifi" or "tailscale"
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getConnectInfo()
        .then(res => {
          setInfo(res);
          // If Tailscale IP exists, keep current mode; default to wifi if user turned off Tailscale
          if (!res?.tailscale_ip) {
            setMode("wifi");
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isWifi = mode === "wifi";
  const activeUrl = isWifi 
    ? (info?.wifi_url || `http://${info?.wifi_ip || "192.168.1.4"}:8000/?token=${info?.token || ""}`)
    : (info?.tailscale_url || info?.connect_url || window.location.href);

  const qrImageUrl = `${getBaseApiUrl()}/api/connect/qr?mode=${mode}&t=${Date.now()}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-gravity-card border border-gravity-border p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-gravity-surface hover:bg-gravity-card text-slate-400 hover:text-white border border-gravity-border transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/40 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
          <AntigravityStar className="w-6 h-6" glow />
        </div>

        <h3 className="text-base font-bold text-white tracking-tight mb-1">
          Scan to Connect Phone
        </h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Select your network mode and scan to pair your phone:
        </p>

        {/* Network Selector Toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-gravity-bg border border-gravity-border mb-4">
          <button
            onClick={() => setMode("wifi")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition ${
              isWifi
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Local Wi-Fi (No VPN)</span>
          </button>
          <button
            onClick={() => setMode("tailscale")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition ${
              !isWifi
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Tailscale VPN</span>
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-3 bg-white rounded-2xl inline-block shadow-xl mb-4 border border-slate-200">
          <img
            src={qrImageUrl}
            alt="Scan QR to connect"
            className="w-44 h-44 mx-auto"
          />
        </div>

        {/* Connection Link */}
        <div className="p-2.5 rounded-xl bg-gravity-bg border border-gravity-border flex items-center justify-between gap-2 text-left mb-3">
          <div className="truncate">
            <div className="text-[10px] text-slate-500 font-mono">
              {isWifi ? "Local Wi-Fi Access URL" : "Encrypted Tailscale Access URL"}
            </div>
            <div className="text-xs text-indigo-300 font-mono truncate">{activeUrl}</div>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 transition shadow-sm border border-indigo-400/30"
            title="Copy Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {isWifi ? "Direct Wi-Fi: " : "Tailscale Node: "}
            <strong className="text-white font-mono">
              {isWifi ? (info?.wifi_ip || "192.168.1.4") : (info?.tailscale_ip || "100.85.60.37")}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
