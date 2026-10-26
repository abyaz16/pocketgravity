import React, { useState, useEffect } from "react";
import { Folder, FolderOpen, ArrowRight, X, RefreshCw } from "lucide-react";
import { getAvailableFolders, openProjectFolder } from "../api";
import { AntigravityStar } from "./AntigravityIcon";

export default function FolderSelectorModal({ isOpen, onClose, currentFolder, onFolderSelected }) {
  const [folders, setFolders] = useState([]);
  const [customPath, setCustomPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [opening, setOpening] = useState(false);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const data = await getAvailableFolders();
      setFolders(data.folders || []);
    } catch (_) {}
    finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = async (path) => {
    setOpening(true);
    try {
      await openProjectFolder(path, true);
      if (onFolderSelected) onFolderSelected(path);
      onClose();
    } catch (err) {
      alert(`Could not open folder: ${err.message}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-gravity-card border border-gravity-border p-5 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-gravity-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <AntigravityStar className="w-4 h-4" glow />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Open Workspace</h3>
              <p className="text-[11px] text-slate-400">Opens in Antigravity IDE on laptop</p>
            </div>
          </div>
          {currentFolder && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-gravity-surface hover:bg-gravity-card text-slate-400 hover:text-white border border-gravity-border transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Custom Path Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customPath.trim()) handleSelect(customPath.trim());
          }}
          className="mt-3.5 flex gap-2"
        >
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="e.g. E:\pocketgravity or any folder"
            className="flex-1 px-3 py-2 rounded-xl bg-gravity-bg border border-gravity-border text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/70 font-mono shadow-inner"
          />
          <button
            type="submit"
            disabled={!customPath.trim() || opening}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-40 text-xs font-semibold text-white active:scale-95 transition shadow-sm border border-indigo-400/30"
          >
            Open
          </button>
        </form>

        {/* Available folders on E:\ list */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
            Available Folders on Drive
          </span>
          <button onClick={loadFolders} className="p-1 text-slate-400 hover:text-slate-200">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[340px]">
          {folders.map((f) => {
            const isCurrent = currentFolder === f.path;
            return (
              <div
                key={f.path}
                onClick={() => handleSelect(f.path)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer active:scale-95 transition border ${
                  isCurrent
                    ? "bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-indigo-500/50 text-indigo-200 shadow-sm"
                    : "bg-gravity-surface/70 border-gravity-border hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className={`w-4 h-4 shrink-0 ${isCurrent ? "text-indigo-400" : "text-amber-400"}`} />
                  <div className="truncate">
                    <div className="text-xs font-semibold truncate text-white">{f.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{f.path}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
