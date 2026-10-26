import React from "react";
import { Sparkles, Zap, Globe, FolderTree, Monitor } from "lucide-react";

export default function BottomNav({ activeTab, onTabChange, isProcessRunning }) {
  const tabs = [
    { id: "agent", label: "Agent", icon: Sparkles },
    { id: "claude", label: "Claude", icon: Zap },
    { id: "web", label: "Web", icon: Globe },
    { id: "files", label: "Explorer", icon: FolderTree },
    { id: "desktop", label: "Desktop", icon: Monitor },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gravity-bg/95 backdrop-blur-lg border-t border-gravity-border px-2 py-1 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer min-h-[48px] ${
                isActive
                  ? "text-indigo-400 bg-indigo-950/60 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 active:scale-95"
              }`}
            >
              <div className="relative pointer-events-none">
                <Icon className={`w-5 h-5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                {tab.id === "claude" && isProcessRunning && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-gravity-bg animate-pulse" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight pointer-events-none font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
