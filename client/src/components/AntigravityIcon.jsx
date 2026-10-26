import React from "react";

export function AntigravityStar({ className = "w-4 h-4", glow = false }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? "drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]" : ""}`}
    >
      <defs>
        <linearGradient id="pg-star-grad" x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="pg-orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* Orbit Ring Behind Core */}
      <g transform="rotate(-28 50 50)">
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="14"
          stroke="url(#pg-orbit-grad)"
          strokeWidth="4"
          strokeDasharray="90 160"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>

      {/* Celestial Disc Core */}
      <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#312e81" strokeWidth="2.5" />

      {/* Antigravity 4-Point Star Core */}
      <path
        d="M50 28 C50 40 40 50 28 50 C40 50 50 60 50 72 C50 60 60 50 72 50 C60 50 50 40 50 28 Z"
        fill="url(#pg-star-grad)"
      />
      <circle cx="50" cy="50" r="3.5" fill="#ffffff" opacity="0.95" />

      {/* Orbit Ring In Front */}
      <g transform="rotate(-28 50 50)">
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="14"
          stroke="url(#pg-orbit-grad)"
          strokeWidth="4"
          strokeDasharray="135 115"
          strokeDashoffset="120"
          strokeLinecap="round"
        />
        {/* Mobile Satellite Node on Ring */}
        <g transform="translate(86, 50)">
          <circle cx="0" cy="0" r="8" fill="#38bdf8" opacity="0.35" />
          <rect
            x="-4.5"
            y="-7.5"
            width="9"
            height="15"
            rx="2.5"
            fill="#090d16"
            stroke="#38bdf8"
            strokeWidth="1.6"
          />
          <rect
            x="-2.5"
            y="-5"
            width="5"
            height="8.5"
            rx="1"
            fill="#38bdf8"
            opacity="0.95"
          />
          <circle cx="0" cy="5" r="0.8" fill="#ffffff" />
        </g>
      </g>
    </svg>
  );
}

export function AntigravityBadge({ status = "connected", text }) {
  const isConn = status === "connected" || status === true;
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] font-mono">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConn ? "bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" : "bg-amber-400"
        }`}
      />
      <span className={isConn ? "text-emerald-400" : "text-amber-400"}>
        {text || (isConn ? "Live" : "Standby")}
      </span>
    </div>
  );
}
