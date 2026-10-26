import React, { useEffect, useRef } from "react";

// Lightweight ANSI color parser into styled spans
function renderAnsiLine(text) {
  // Regex for ANSI escape sequences
  const ansiRegex = /\u001b\[([0-9;]+)m/g;
  let parts = [];
  let lastIndex = 0;
  let currentColor = "text-slate-300";
  let isBold = false;

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        color: currentColor,
        bold: isBold
      });
    }
    const code = match[1];
    if (code === "0" || code === "") {
      currentColor = "text-slate-300";
      isBold = false;
    } else if (code === "1") {
      isBold = true;
    } else if (code === "31" || code === "91") {
      currentColor = "text-rose-400";
    } else if (code === "32" || code === "92") {
      currentColor = "text-emerald-400";
    } else if (code === "33" || code === "93") {
      currentColor = "text-amber-400";
    } else if (code === "34" || code === "94") {
      currentColor = "text-sky-400";
    } else if (code === "35" || code === "95") {
      currentColor = "text-purple-400";
    } else if (code === "36" || code === "96") {
      currentColor = "text-cyan-400";
    }
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      color: currentColor,
      bold: isBold
    });
  }

  if (parts.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {parts.map((p, idx) => (
        <span key={idx} className={`${p.color} ${p.bold ? "font-bold" : ""}`}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

export default function TerminalOutput({ logs, autoScroll, onToggleAutoScroll }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  return (
    <div className="flex-1 p-3 bg-gravity-terminal font-mono text-xs overflow-y-auto leading-relaxed select-text">
      {logs.length === 0 ? (
        <div className="text-slate-600 italic py-8 text-center">
          Terminal ready. Type a command or pick a quick action below.
        </div>
      ) : (
        logs.map((log, index) => {
          if (log.type === "system") {
            return (
              <div key={index} className="text-indigo-400 font-semibold my-1 border-l-2 border-indigo-500 pl-2">
                {log.text}
              </div>
            );
          }
          if (log.type === "stderr") {
            return (
              <div key={index} className="text-rose-400 whitespace-pre-wrap break-all">
                {renderAnsiLine(log.text)}
              </div>
            );
          }
          if (log.type === "error") {
            return (
              <div key={index} className="text-rose-500 font-medium whitespace-pre-wrap break-all">
                [Error] {log.text}
              </div>
            );
          }
          return (
            <div key={index} className="text-slate-200 whitespace-pre-wrap break-all">
              {renderAnsiLine(log.text)}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
