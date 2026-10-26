import React, { useState, useEffect, useRef } from "react";
import {
  Monitor, Maximize2, Minimize2, RotateCw,
  ZoomIn, ZoomOut, RefreshCw, RotateCcw
} from "lucide-react";
import { getStoredConfig } from "../api";

export default function ScreenTab() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Default to landscape mode for mobile phone viewing
  const [isRotatedLandscape, setIsRotatedLandscape] = useState(true);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Touch & pointer tracking refs
  const initialPinchDistRef = useRef(null);
  const initialScaleRef = useRef(1);
  const lastPanPointRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  const connectDesktopWs = () => {
    const { host, token } = getStoredConfig();
    let baseWs = "";
    if (host) {
      baseWs = host.replace(/^http/, "ws").replace(/\/+$/, "");
    } else {
      const loc = window.location;
      const proto = loc.protocol === "https:" ? "wss:" : "ws:";
      baseWs = `${proto}//${loc.host}`;
    }
    const wsUrl = `${baseWs}/api/desktop/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "blob";
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          frameCountRef.current += 1;
          const now = Date.now();
          if (now - lastFpsTimeRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          const url = URL.createObjectURL(event.data);
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (canvas) {
              if (canvas.width !== img.width || canvas.height !== img.height) {
                canvas.width = img.width;
                canvas.height = img.height;
              }
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0);
            }
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectDesktopWs, 2000);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (_) {
      setTimeout(connectDesktopWs, 2000);
    }
  };

  useEffect(() => {
    connectDesktopWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendAction = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Multi-touch gestures for pinch zoom & drag pan
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialScaleRef.current = scale;
      lastPanPointRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      lastPanPointRef.current = { x: t.clientX, y: t.clientY };
      setIsPanning(true);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      // Active pinch zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialPinchDistRef.current;
      const newScale = Math.max(1, Math.min(4, initialScaleRef.current * factor));
      setScale(newScale);
      if (newScale === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && lastPanPointRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - lastPanPointRef.current.x;
      const dy = t.clientY - lastPanPointRef.current.y;
      const panBound = 350 * scale;
      setPan((prev) => ({
        x: Math.max(-panBound, Math.min(panBound, prev.x + dx)),
        y: Math.max(-panBound, Math.min(panBound, prev.y + dy))
      }));
      lastPanPointRef.current = { x: t.clientX, y: t.clientY };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      initialPinchDistRef.current = null;
      lastPanPointRef.current = null;
      setIsPanning(false);
    }
  };

  // Mouse drag & wheel handlers for desktop browser
  const handleMouseDown = (e) => {
    lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
  };

  const handleMouseMove = (e) => {
    if (isPanning && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      const panBound = 350 * scale;
      setPan((prev) => ({
        x: Math.max(-panBound, Math.min(panBound, prev.x + dx)),
        y: Math.max(-panBound, Math.min(panBound, prev.y + dy))
      }));
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    lastPanPointRef.current = null;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950 rounded-3xl border border-indigo-500/30 overflow-hidden shadow-2xl relative select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "h-[calc(100vh-125px)]"
      }`}
    >
      {/* Top Header Bar */}
      <div className="px-3 py-2 bg-slate-900 border-b border-gravity-border flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white tracking-tight">Laptop Screen</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400"
            }`}
          />
          {isConnected && <span className="text-[10px] font-mono text-slate-400">{fps} FPS</span>}
          {scale > 1 && (
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
              {scale.toFixed(1)}x
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Landscape Mode Toggle */}
          <button
            onClick={() => setIsRotatedLandscape(!isRotatedLandscape)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              isRotatedLandscape
                ? "bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-500/30"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
            title="Toggle Landscape Widescreen Mode"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Landscape</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Screen Viewport */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden bg-black touch-none cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className={`transition-transform duration-75 flex items-center justify-center ${
            isRotatedLandscape
              ? "w-[92vh] h-[92vw] max-w-none max-h-none"
              : "w-full h-full max-w-full max-h-full"
          }`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${isRotatedLandscape ? 90 : 0}deg) scale(${scale})`,
            transformOrigin: "center center"
          }}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain shadow-2xl block pointer-events-none"
          />
        </div>

        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm text-center p-4 z-30">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">Connecting to Laptop Display...</h4>
            <p className="text-xs text-slate-400 max-w-xs">
              Attaching to Windows interactive desktop session.
            </p>
          </div>
        )}

        {/* Floating Zoom & Scroll Controls */}
        <div className="absolute right-3 bottom-4 flex flex-col gap-2 z-20">
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-600 border border-slate-700 text-white active:scale-95 shadow-xl transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-600 border border-slate-700 text-white active:scale-95 shadow-xl transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* 1x Reset Zoom */}
          {scale > 1 && (
            <button
              onClick={handleResetZoom}
              className="px-2 py-1.5 rounded-xl bg-indigo-600 text-[10px] font-bold text-white border border-indigo-400 active:scale-95 shadow-xl transition flex items-center justify-center gap-1"
              title="Reset Zoom to 1x"
            >
              <RotateCcw className="w-3 h-3" />
              <span>1x</span>
            </button>
          )}
        </div>

        {/* Zoom & Pan Hint Pill */}
        <div className="absolute left-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 font-medium pointer-events-none z-10 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span>Pinch or buttons to zoom • Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
