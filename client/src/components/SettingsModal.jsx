import React, { useState } from "react";
import { X, ShieldCheck, Key, Globe, Check, AlertCircle } from "lucide-react";
import { getStoredConfig, saveStoredConfig, verifyAuth } from "../api";

export default function SettingsModal({ isOpen, onClose, onSaved }) {
  const current = getStoredConfig();
  const [host, setHost] = useState(current.host);
  const [token, setToken] = useState(current.token);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await verifyAuth(token, host);
      if (res.valid) {
        setTestResult({ ok: true, msg: `Verified! Root: ${res.workspace_root || "OK"}` });
      } else {
        setTestResult({ ok: false, msg: "Token rejected by server." });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveStoredConfig(host, token);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Connection Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tailscale / Host Address</span>
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g. http://100.101.102.103:8000 (empty for local)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Leave empty if opening the web app directly from the laptop IP.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Secret Bearer Token</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="AUTH_TOKEN"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                testResult.ok
                  ? "bg-emerald-950/80 border border-emerald-800 text-emerald-300"
                  : "bg-rose-950/80 border border-rose-800 text-rose-300"
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-[11px] truncate">{testResult.msg}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold active:scale-95 transition"
            >
              {testing ? "Testing..." : "Test Link"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
