import React from "react";
import { Zap, Globe, FolderTree, Monitor } from "lucide-react";
import { AntigravityStar } from "./AntigravityIcon";

export default function SimpleBottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: "agent", label: "Agent", isAgy: true },
    { id: "claude", label: "Claude", icon: Zap },
    { id: "screen", label: "Screen", icon: Monitor },
    { id: "web", label: "Localhost", icon: Globe },
    { id: "files", label: "Explorer", icon: FolderTree },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gravity-bg/95 backdrop-blur-2xl border-t border-gravity-border px-2 py-1.5 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 min-h-[52px] group ${
                isActive
                  ? "bg-gradient-to-b from-indigo-500/15 to-purple-500/10 text-white font-bold border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-gravity-surface/50 active:scale-95"
              }`}
            >
              {/* Active Tab Glow Bar */}
              {isActive && (
                <span className="absolute -top-[1.5px] w-6 h-[2.5px] rounded-full bg-gradient-to-r from-indigo-500 via-purple-400 to-cyan-400 shadow-[0_0_8px_#818cf8]" />
              )}

              {/* Icon */}
              <div className="relative">
                {tab.isAgy ? (
                  <AntigravityStar
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isActive ? "scale-110" : "opacity-75 group-hover:opacity-100"
                    }`}
                    glow={isActive}
                  />
                ) : (
                  <Icon
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isActive ? "text-indigo-400 scale-110" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] mt-1 tracking-tight truncate transition-colors duration-200 ${
                  isActive ? "text-indigo-200 font-bold" : "font-medium"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
