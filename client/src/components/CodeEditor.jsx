import React, { useState, useEffect } from "react";
import { Save, Download, X, ZoomIn, ZoomOut, Check, AlertCircle, FileCode } from "lucide-react";
import { saveFileContent, getDownloadUrl } from "../api";

export default function CodeEditor({ filePath, initialContent, onClose, isBinary }) {
  const [content, setContent] = useState(initialContent || "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [fontSize, setFontSize] = useState(13);

  useEffect(() => {
    setContent(initialContent || "");
    setIsDirty(false);
    setStatusMsg(null);
  }, [filePath, initialContent]);

  const handleChange = (e) => {
    setContent(e.target.value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (isBinary) return;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveFileContent(filePath, content, true);
      setIsDirty(false);
      setStatusMsg({
        type: "success",
        text: res.backup_path ? "Saved! (Backup created)" : "Saved successfully!"
      });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const lines = content.split("\n");
  const fileName = filePath.split("/").pop();

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] rounded-2xl bg-gravity-card border border-gravity-border overflow-hidden">
      {/* Editor Header */}
      <div className="px-3 py-2 bg-slate-900 border-b border-gravity-border flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-200 truncate">{fileName}</span>
              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{filePath}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Font zoom controls */}
          <button
            onClick={() => setFontSize(Math.max(10, fontSize - 1))}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFontSize(Math.min(20, fontSize + 1))}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Download to mobile */}
          <a
            href={getDownloadUrl(filePath)}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95"
            title="Download to Phone"
          >
            <Download className="w-3.5 h-3.5" />
          </a>

          {/* Save Button */}
          {!isBinary && (
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                isDirty
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save"}</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white active:scale-95 ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMsg && (
        <div
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 font-medium ${
            statusMsg.type === "success"
              ? "bg-emerald-950/80 text-emerald-300 border-b border-emerald-800/40"
              : "bg-rose-950/80 text-rose-300 border-b border-rose-800/40"
          }`}
        >
          {statusMsg.type === "success" ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Editor Body */}
      {isBinary ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <p className="text-sm font-medium mb-3">Binary File</p>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            This file cannot be rendered in text mode. You can download it directly to your mobile device.
          </p>
          <a
            href={getDownloadUrl(filePath)}
            download={fileName}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Download Binary to Phone</span>
          </a>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Line Numbers Gutter */}
          <div
            className="w-10 select-none py-2 bg-slate-950 text-right pr-2 text-slate-600 font-mono overflow-hidden border-r border-slate-900"
            style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Text Area */}
          <textarea
            value={content}
            onChange={handleChange}
            spellCheck="false"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 p-2 bg-gravity-terminal text-slate-200 font-mono resize-none focus:outline-none overflow-auto whitespace-pre leading-normal"
            style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
          />
        </div>
      )}

      {/* Editor Footer */}
      <div className="px-3 py-1 bg-slate-950 border-t border-gravity-border text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>Lines: {lines.length}</span>
        <span>UTF-8 • {isDirty ? "Modified" : "Saved"}</span>
      </div>
    </div>
  );
}
