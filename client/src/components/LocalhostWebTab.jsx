import React, { useState, useEffect } from "react";
import { Globe, RefreshCw, ExternalLink, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { getActiveDevPorts, getLocalhostProxyUrl } from "../api";

export default function LocalhostWebTab() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [customPort, setCustomPort] = useState("");
  const [subpath, setSubpath] = useState("/");
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const scanPorts = async () => {
    setIsScanning(true);
    try {
      const data = await getActiveDevPorts();
      const detected = data.ports || [];
      setPorts(detected);

      // Auto-select active dev port or first detected port
      if (!selectedPort && detected.length > 0) {
        const best = data.active_port || detected[0].port;
        setSelectedPort(best.toString());
      }
    } catch (err) {
      setErrorMsg("Failed to scan dev server ports");
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanPorts();
    const interval = setInterval(scanPorts, 8000);
    return () => clearInterval(interval);
  }, []);

  // Sanitize subpath input: if user pasted full URL (e.g. http://localhost:5181/test)
  const cleanSubpath = (() => {
    let p = subpath.trim();
    if (p.includes("://")) {
      try {
        const urlObj = new URL(p);
        if (urlObj.port) {
          setSelectedPort(urlObj.port);
        }
        p = urlObj.pathname + urlObj.search;
      } catch (_) {
        p = p.replace(/^https?:\/\/[^/]+/i, "");
      }
    }
    return p.startsWith("/") ? p : `/${p}`;
  })();

  const activePortNum = parseInt(customPort || selectedPort || "5181", 10);
  const proxyUrl = getLocalhostProxyUrl(activePortNum, cleanSubpath);

  const handleRefresh = () => {
    setIframeKey(Date.now());
  };

  return (
    <div className="flex flex-col h-[calc(100vh-136px)] rounded-2xl bg-gravity-card border border-gravity-border overflow-hidden shadow-2xl">
      {/* Top Address & Port Selector Bar */}
      <div className="p-2.5 bg-gravity-surface/90 border-b border-gravity-border backdrop-blur-md space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <Globe className="w-4 h-4" />
          </div>

          {/* Active Listening Ports Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
            {ports.map((item) => (
              <button
                key={item.port}
                onClick={() => {
                  setSelectedPort(item.port.toString());
                  setCustomPort("");
                  handleRefresh();
                }}
                className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition active:scale-95 border ${
                  selectedPort === item.port.toString() && !customPort
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-md shadow-cyan-600/30"
                    : "bg-gravity-card border-gravity-border text-slate-300 hover:text-white"
                }`}
              >
                :{item.port} {item.process_name ? `(${item.process_name})` : ""}
              </button>
            ))}

            {ports.length === 0 && (
              <span className="text-[11px] text-slate-500 italic">No listening web ports detected</span>
            )}
          </div>

          <button
            onClick={scanPorts}
            disabled={isScanning}
            className="p-1.5 rounded-xl bg-gravity-card border border-gravity-border hover:border-cyan-500/30 text-slate-400 hover:text-white active:scale-95 transition"
            title="Scan for listening web ports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Address Bar, Reload, and Direct Launch */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex items-center bg-gravity-bg border border-gravity-border focus-within:border-cyan-500/60 rounded-xl px-2.5 py-1.5 transition">
            <span className="text-xs font-mono text-cyan-400 font-bold mr-1">:{activePortNum}</span>
            <input
              type="text"
              value={subpath}
              onChange={(e) => setSubpath(e.target.value)}
              placeholder="/ (e.g. /dashboard)"
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-gravity-card border border-gravity-border hover:border-cyan-500/30 text-slate-300 active:scale-95 transition"
            title="Reload Web Page"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <a
            href={proxyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-95 text-white text-xs font-semibold active:scale-95 transition shadow-sm border border-cyan-400/30 shrink-0"
            title="Open in Full Mobile Browser Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Full</span>
          </a>
        </div>
      </div>

      {/* Embedded Web Preview Iframe */}
      <div className="flex-1 bg-white relative">
        <iframe
          key={iframeKey}
          src={proxyUrl}
          title="Localhost Web Preview"
          className="w-full h-full border-none"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
