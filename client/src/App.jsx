import React, { useState, useEffect, useRef } from "react";
import SimpleHeader from "./components/SimpleHeader";
import SimpleBottomNav from "./components/SimpleBottomNav";
import CleanClaudeTab from "./components/CleanClaudeTab";
import CleanAgentTab from "./components/CleanAgentTab";
import ScreenTab from "./components/ScreenTab";
import LocalhostWebTab from "./components/LocalhostWebTab";
import FilesTab from "./components/FilesTab";
import FolderSelectorModal from "./components/FolderSelectorModal";
import QRModal from "./components/QRModal";
import { getCurrentFolder, getSystemStatus } from "./api";
import { sendAppNotification } from "./notifications";

export default function App() {
  const [activeTab, setActiveTab] = useState("agent"); // agent, claude, screen, web, files
  const [currentFolder, setCurrentFolder] = useState("");
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [battery, setBattery] = useState(null);
  const lastBatteryAlertTime = useRef(0);

  // Sync folder on mobile app startup:
  // If laptop already opened a folder in Antigravity IDE -> auto-sync to that same folder!
  // If no folder is open on laptop -> prompt user with folder selector at starting.
  useEffect(() => {
    getCurrentFolder()
      .then((data) => {
        const laptopFolder = data?.laptop_active_folder;
        if (laptopFolder && laptopFolder.has_active_window && laptopFolder.folder) {
          setCurrentFolder(laptopFolder.folder);
        } else {
          // If no folder is actively open on laptop, let user choose at the starting
          if (data && data.folder) setCurrentFolder(data.folder);
          setIsFolderModalOpen(true);
        }
      })
      .catch(() => {
        setIsFolderModalOpen(true);
      });
  }, []);

  const checkConnection = async () => {
    try {
      const data = await getSystemStatus();
      setIsConnected(true);
      if (data && data.battery) {
        setBattery(data.battery);

        // Low Battery Reminder: <= 10% and not currently plugged into AC power
        if (data.battery.percent <= 10 && !data.battery.power_plugged) {
          const now = Date.now();
          // Rate-limit alert to once every 3 minutes
          if (now - lastBatteryAlertTime.current > 180000) {
            lastBatteryAlertTime.current = now;
            sendAppNotification(
              "⚠️ Laptop Battery Critical (10%)",
              `Laptop is at ${Math.round(data.battery.percent)}% battery. Connect charger now to avoid shutdown!`,
              "battery"
            );
          }
        }
      }
    } catch (_) {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[100dvh] bg-gravity-bg flex flex-col text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden">
      <SimpleHeader
        currentFolder={currentFolder}
        onSwitchFolder={() => setIsFolderModalOpen(true)}
        isConnected={isConnected}
        onOpenQR={() => setIsQROpen(true)}
        battery={battery}
      />

      {/* Critical Battery Banner */}
      {battery && battery.percent <= 10 && !battery.power_plugged && (
        <div className="bg-rose-950/95 border-b border-rose-800 text-rose-200 px-3 py-1.5 text-xs flex items-center justify-between font-mono animate-pulse shadow-md shrink-0">
          <span className="flex items-center gap-1.5 font-bold">
            ⚠️ LAPTOP BATTERY CRITICAL ({Math.round(battery.percent)}%)
          </span>
          <span className="text-[11px] underline">Connect Charger!</span>
        </div>
      )}

      <main className={`flex-1 min-h-0 w-full mx-auto p-2 pb-16 flex flex-col overflow-hidden ${
        activeTab === "screen" ? "max-w-4xl px-1 sm:px-3" : "max-w-md"
      }`}>
        {activeTab === "agent" && <CleanAgentTab currentFolder={currentFolder} />}

        {activeTab === "claude" && <CleanClaudeTab currentFolder={currentFolder} />}

        {activeTab === "screen" && <ScreenTab />}

        {activeTab === "web" && <LocalhostWebTab />}

        {activeTab === "files" && <FilesTab />}
      </main>

      <SimpleBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <FolderSelectorModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        currentFolder={currentFolder}
        onFolderSelected={(newPath) => setCurrentFolder(newPath)}
      />

      <QRModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
      />
    </div>
  );
}
