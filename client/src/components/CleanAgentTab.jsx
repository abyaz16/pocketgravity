import React, { useState, useEffect, useRef } from "react";
import { Send, RefreshCw, User, Wrench, CheckCircle2, AlertCircle, ChevronDown, Terminal, FileCode, Search, Cpu, ArrowDown } from "lucide-react";
import { getAgentConversation, dispatchAntigravityPrompt } from "../api";
import { AntigravityStar } from "./AntigravityIcon";
import { sendAppNotification, requestNotificationPermission } from "../notifications";

export default function CleanAgentTab({ currentFolder }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Model & Effort options
  const [selectedModel, setSelectedModel] = useState("Gemini 3.8 Flash (High)");
  const [selectedEffort, setSelectedEffort] = useState("High");
  const [selectedMode, setSelectedMode] = useState("agent");
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);
  const isTouchingRef = useRef(false);
  const isWaitingForReplyRef = useRef(false);
  const pendingUserPromptTimeRef = useRef(0);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user is more than 35px from bottom, mark as scrolled up
    const isUp = distanceFromBottom > 35;
    isUserScrolledUp.current = isUp;
    setShowScrollBottom(isUp);
  };

  const handleTouchStart = () => {
    isTouchingRef.current = true;
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isTouchingRef.current = false;
      handleScroll();
    }, 300);
  };

  const folderName = currentFolder ? currentFolder.split(/[/\\]/).pop() : "folder";
  const activeFolderRef = useRef(folderName);

  const loadConversation = async () => {
    const target = folderName;
    try {
      const data = await getAgentConversation(40, null, target);
      if (activeFolderRef.current !== target) return;
      if (data && data.messages) {
        setMessages((prev) => {
          if (prev.length === data.messages.length && prev.length > 0) {
            const pLast = prev[prev.length - 1];
            const dLast = data.messages[data.messages.length - 1];
            if (pLast.id === dLast.id && pLast.text === dLast.text && pLast.status === dLast.status && pLast.is_error === dLast.is_error) {
              return prev; // Same content, prevent unnecessary re-render
            }
          }
          return data.messages;
        });

        if (data.messages.length > 0) {
          const last = data.messages[data.messages.length - 1];
          if (last.role === "agent") {
            if (last.is_error || last.status === "ERROR") {
              setIsAgentWorking(false);
              if (isWaitingForReplyRef.current) {
                isWaitingForReplyRef.current = false;
                pendingUserPromptTimeRef.current = 0;
                sendAppNotification(
                  "⚠️ Antigravity Error",
                  last.text || "Agent encountered an error.",
                  "warning"
                );
              }
            } else if (last.text && last.text.trim()) {
              // Ensure this is the response for our current prompt and not an old turn
              const msgTime = last.timestamp ? new Date(last.timestamp).getTime() : 0;
              const isFresh = !pendingUserPromptTimeRef.current || (msgTime >= pendingUserPromptTimeRef.current - 5000);

              if (isFresh) {
                setIsAgentWorking(false);
                if (isWaitingForReplyRef.current) {
                  isWaitingForReplyRef.current = false;
                  pendingUserPromptTimeRef.current = 0;
                  const snippet = last.text.slice(0, 100).replace(/\n+/g, " ");
                  sendAppNotification(
                    "🪐 Antigravity Response Ready",
                    snippet || "Agent has completed your request.",
                    "success"
                  );
                  // Ensure mobile view scrolls to reveal the answer
                  setTimeout(() => {
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }
            } else if (last.status === "RUNNING") {
              setIsAgentWorking(true);
            }
          }
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    activeFolderRef.current = folderName;
    setMessages([]);
    setIsAgentWorking(false);
    setStatusMessage(null);
    pendingUserPromptTimeRef.current = 0;
    isWaitingForReplyRef.current = false;
    loadConversation();
    const interval = setInterval(loadConversation, 2500);
    return () => clearInterval(interval);
  }, [currentFolder]);

  useEffect(() => {
    if (!isUserScrolledUp.current && !isTouchingRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAgentWorking]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSubmitting) return;

    setIsSubmitting(true);
    setIsAgentWorking(true);
    setStatusMessage(null);
    isWaitingForReplyRef.current = true;
    pendingUserPromptTimeRef.current = Date.now();
    requestNotificationPermission();

    // Optimistically add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        status: "DONE",
        text: cleanPrompt,
        timestamp: new Date().toISOString()
      }
    ]);
    setPrompt("");
    isUserScrolledUp.current = false;
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const res = await dispatchAntigravityPrompt(cleanPrompt, selectedMode, selectedModel, selectedEffort, folderName);
      setStatusMessage({
        type: "success",
        text: res.message || `Dispatched to Antigravity Agent in ${folderName}!`
      });

      // Poll conversation updates frequently while agent works
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        await loadConversation();
        if (pollCount > 80 || !isWaitingForReplyRef.current) {
          clearInterval(pollInterval);
        }
      }, 1500);

      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to dispatch prompt to Antigravity"
      });
      setIsAgentWorking(false);
      isWaitingForReplyRef.current = false;
      pendingUserPromptTimeRef.current = 0;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for tool badges with Antigravity tool icons
  const renderToolBadge = (toolName, idx) => {
    let icon = <Wrench className="w-2.5 h-2.5 text-indigo-400" />;
    if (toolName.includes("command") || toolName.includes("powershell") || toolName.includes("bash")) {
      icon = <Terminal className="w-2.5 h-2.5 text-emerald-400" />;
    } else if (toolName.includes("file") || toolName.includes("replace") || toolName.includes("write")) {
      icon = <FileCode className="w-2.5 h-2.5 text-cyan-400" />;
    } else if (toolName.includes("search") || toolName.includes("view") || toolName.includes("grep")) {
      icon = <Search className="w-2.5 h-2.5 text-purple-400" />;
    }

    return (
      <span
        key={idx}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gravity-surface border border-gravity-border text-[10px] text-slate-300 font-mono"
      >
        {icon}
        <span className="truncate max-w-[140px]">{toolName}</span>
      </span>
    );
  };

  const quickPrompts = [
    "Check git status and pending changes",
    "Run tests and summarize results",
    "List modified files in this folder"
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-gravity-card border border-gravity-border overflow-hidden shadow-2xl relative">
      {/* Antigravity Header Bar */}
      <div className="p-2.5 bg-gravity-surface/90 border-b border-gravity-border backdrop-blur-md space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1.5">
          {/* Agent Title & Folder Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
              <AntigravityStar className="w-4 h-4" glow />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight">Antigravity Agent</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 font-mono">
                  {folderName}
                </span>
              </div>
            </div>
          </div>

          {/* Action Chips: Model, Refresh */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Model & Effort Selector */}
            <button
              onClick={() => setIsOptionsOpen(!isOptionsOpen)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gravity-card hover:bg-gravity-surface border border-gravity-border hover:border-indigo-500/40 text-[11px] font-semibold text-slate-200 transition active:scale-95 shadow-sm"
              title="Change AI Model & Effort"
            >
              <Cpu className="w-3 h-3 text-indigo-400" />
              <span className="truncate max-w-[85px]">{selectedModel.replace(" (High)", "").replace(" (Medium)", "")}</span>
              <span className="px-1 py-0.2 rounded bg-indigo-600/30 text-indigo-300 text-[9px] font-mono">
                {selectedEffort}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOptionsOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Refresh */}
            <button
              onClick={loadConversation}
              className="p-1.5 rounded-xl bg-gravity-card border border-gravity-border hover:border-indigo-500/30 text-slate-400 hover:text-white active:scale-95 transition"
              title="Refresh Agent Chat"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Antigravity Model & Effort Drawer */}
        {isOptionsOpen && (
          <div className="p-2.5 rounded-xl bg-gravity-bg/95 border border-indigo-500/30 space-y-2 mt-1 shadow-xl animate-in fade-in duration-150">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
                Antigravity AI Model
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "Gemini 3.8 Flash (High)",
                  "Gemini 3.8 Pro",
                  "Claude 3.7 Sonnet",
                  "Opus 5 Medium"
                ].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setSelectedModel(m); setIsOptionsOpen(false); }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-medium text-left truncate transition border ${
                      selectedModel === m
                        ? "bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-sm"
                        : "bg-gravity-surface/80 border-gravity-border text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 border-t border-gravity-border/60">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Thinking Effort:
              </span>
              <div className="flex gap-1">
                {["Low", "Medium", "High", "Max"].map((eff) => (
                  <button
                    key={eff}
                    onClick={() => setSelectedEffort(eff)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition border ${
                      selectedEffort === eff
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gravity-surface border-gravity-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {eff}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-2 border-b shrink-0 animate-in fade-in duration-150 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
              : "bg-rose-950/80 border-rose-800 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}

      {/* Agent Conversation Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 mobile-chat-scroll p-3 space-y-3.5 bg-gradient-to-b from-gravity-bg via-gravity-surface/20 to-gravity-bg"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl scale-150" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shadow-lg">
                <AntigravityStar className="w-6 h-6" glow />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Antigravity Agent Ready</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-[260px] leading-relaxed">
                Control the Antigravity pair programming agent in <span className="text-indigo-300 font-mono font-semibold">{folderName}</span> directly from your phone.
              </p>
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="flex flex-col gap-1.5 w-full max-w-[280px] pt-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Suggested:</span>
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(qp)}
                  className="text-left px-2.5 py-1.5 rounded-xl bg-gravity-surface hover:bg-gravity-card border border-gravity-border text-[11px] text-slate-300 hover:text-white transition active:scale-95 truncate shadow-sm"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id || idx}
                className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/25 via-purple-500/25 to-cyan-500/25 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <AntigravityStar className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-md transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs border border-indigo-400/30"
                      : m.is_error || m.status === "ERROR"
                      ? "bg-rose-950/40 border border-rose-500/50 text-rose-200 rounded-tl-xs shadow-md"
                      : "bg-gravity-card border border-gravity-border text-slate-200 rounded-tl-xs shadow-cardGlow"
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-mono mb-1.5">
                    <span className="font-semibold text-white/90">
                      {isUser ? "You" : "Antigravity Agent"}
                    </span>
                    {m.status && (
                      <span
                        className={`uppercase text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          m.status === "ERROR" || m.is_error
                            ? "bg-rose-950/80 text-rose-300 border-rose-800"
                            : "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                        }`}
                      >
                        {m.status}
                      </span>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans">
                    {m.text || (m.status === "RUNNING" ? (
                      <span className="italic text-indigo-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        Antigravity is reasoning and formulating actions...
                      </span>
                    ) : (
                      <span className="italic text-slate-500">(Tool execution completed)</span>
                    ))}
                  </div>

                  {/* Antigravity Tool Execution Badges */}
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gravity-border/70 flex flex-wrap gap-1">
                      {m.tools.map((t, ti) => renderToolBadge(t, ti))}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Shimmering Agent Active Indicator */}
        {isAgentWorking && (
          <div className="flex gap-2 justify-start items-center animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <AntigravityStar className="w-3.5 h-3.5 animate-pulse" glow />
            </div>
            <div className="rounded-xl px-3 py-2 bg-gravity-card border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-medium">Antigravity is actively executing actions on laptop...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Floating Jump to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => {
            isUserScrolledUp.current = false;
            setShowScrollBottom(false);
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-16 right-4 p-2 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-xl border border-indigo-400/50 active:scale-90 transition-all z-30 flex items-center justify-center animate-in fade-in"
          title="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Antigravity Prompt Form */}
      <form onSubmit={handleSend} className="p-2.5 bg-gravity-surface/90 border-t border-gravity-border backdrop-blur-md flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Ask Antigravity in ${folderName}...`}
            disabled={isSubmitting}
            className="w-full bg-gravity-bg border border-gravity-border focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition font-sans shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={!prompt.trim() || isSubmitting}
          className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 disabled:opacity-40 text-white disabled:text-slate-500 active:scale-95 transition shadow-glow shrink-0 border border-indigo-400/30"
          title="Send to Antigravity Agent"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
