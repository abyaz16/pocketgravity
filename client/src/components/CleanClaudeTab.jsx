import React, { useState, useEffect, useRef } from "react";
import { Zap, Send, RefreshCw, User, Terminal, CheckCircle2, AlertCircle, ArrowDown } from "lucide-react";
import { getClaudeConversation, runClaudePrompt } from "../api";
import { sendAppNotification, requestNotificationPermission } from "../notifications";

export default function CleanClaudeTab({ currentFolder }) {
  const [messages, setMessages] = useState([]);
  const [promptInput, setPromptInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);
  const isTouchingRef = useRef(false);
  const isWaitingForReplyRef = useRef(false);
  const pendingPromptTimeRef = useRef(0);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
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
      const data = await getClaudeConversation(40, target);
      if (activeFolderRef.current !== target) return;
      if (data && data.messages) {
        setMessages((prev) => {
          if (prev.length === data.messages.length && prev.length > 0) {
            const pLast = prev[prev.length - 1];
            const dLast = data.messages[data.messages.length - 1];
            if (pLast.id === dLast.id && pLast.text === dLast.text && pLast.is_error === dLast.is_error) {
              return prev; // Same content, prevent unnecessary re-render
            }
          }
          return data.messages;
        });

        // Check if last message is claude response or error
        if (data.messages.length > 0) {
          const last = data.messages[data.messages.length - 1];
          if (last.role === "claude") {
            if (last.is_error || (last.text && last.text.startsWith("⚠️"))) {
              setIsThinking(false);
              if (isWaitingForReplyRef.current) {
                isWaitingForReplyRef.current = false;
                pendingPromptTimeRef.current = 0;
                sendAppNotification(
                  "⚠️ Claude Code Error",
                  last.text || "Claude encountered an error on laptop.",
                  "warning"
                );
              }
            } else if (last.text && last.text.trim()) {
              const msgTime = typeof last.timestamp === "number" ? last.timestamp : (last.timestamp ? new Date(last.timestamp).getTime() : 0);
              const isFresh = !pendingPromptTimeRef.current || (msgTime >= pendingPromptTimeRef.current - 5000);

              if (isFresh) {
                setIsThinking(false);
                if (isWaitingForReplyRef.current) {
                  isWaitingForReplyRef.current = false;
                  pendingPromptTimeRef.current = 0;
                  const snippet = last.text.slice(0, 100).replace(/\n+/g, " ");
                  sendAppNotification(
                    "⚡ Claude Code Response Ready",
                    snippet || "Claude has finished responding.",
                    "success"
                  );
                  setTimeout(() => {
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }
            }
          }
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    activeFolderRef.current = folderName;
    setMessages([]);
    setIsThinking(false);
    setStatusMessage(null);
    pendingPromptTimeRef.current = 0;
    isWaitingForReplyRef.current = false;
    loadConversation();
    const interval = setInterval(loadConversation, 2500);
    return () => clearInterval(interval);
  }, [currentFolder]);

  useEffect(() => {
    if (!isUserScrolledUp.current && !isTouchingRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const cleanPrompt = promptInput.trim();
    if (!cleanPrompt || isSubmitting) return;

    setIsSubmitting(true);
    setIsThinking(true);
    setStatusMessage(null);
    isWaitingForReplyRef.current = true;
    pendingPromptTimeRef.current = Date.now();
    requestNotificationPermission();

    // Optimistically add user prompt to chat
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        text: cleanPrompt,
        timestamp: Date.now()
      }
    ]);
    setPromptInput("");
    isUserScrolledUp.current = false;
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const res = await runClaudePrompt(cleanPrompt, folderName);
      setStatusMessage({
        type: "success",
        text: res.message || "Submitted to Claude Code on laptop!"
      });

      // Poll faster while Claude is generating answer
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
        text: err.message || "Failed to submit prompt to Claude Code"
      });
      setIsThinking(false);
      isWaitingForReplyRef.current = false;
      pendingPromptTimeRef.current = 0;

      // Add visible error message into chat so user knows exactly what failed
      setMessages((prev) => [
        ...prev,
        {
          id: `local-err-${Date.now()}`,
          role: "claude",
          is_error: true,
          text: `⚠️ Claude Error: ${err.message || "Check if Claude logged out or subscription ended on laptop."}`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickPrompts = [
    "/help",
    "git status",
    "review recent commits"
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-gravity-card border border-gravity-border overflow-hidden shadow-2xl relative">
      {/* Top Header */}
      <div className="p-2.5 bg-gravity-surface/90 border-b border-gravity-border backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Zap className="w-4 h-4 fill-amber-400/30" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-tight">Claude Code</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-950/70 border border-amber-500/30 text-amber-300 font-mono">
                {folderName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={loadConversation}
            className="p-1.5 rounded-xl bg-gravity-card border border-gravity-border hover:border-amber-500/30 text-slate-400 hover:text-white active:scale-95 transition"
            title="Refresh Conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
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

      {/* Messages Feed */}
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
              <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl scale-150" />
              <div className="relative w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
                <Zap className="w-6 h-6 fill-amber-400/20" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Claude Code Ready</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-[260px] leading-relaxed">
                Send instructions directly to the Claude CLI running in <span className="text-amber-300 font-mono font-semibold">{folderName}</span>.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5 justify-center max-w-[260px] pt-1">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptInput(qp)}
                  className="px-2.5 py-1 rounded-lg bg-gravity-surface hover:bg-gravity-card border border-gravity-border text-[11px] text-slate-300 hover:text-amber-300 font-mono transition active:scale-95 shadow-sm"
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
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-sm">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-md transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-tr-xs border border-amber-400/30"
                      : m.is_error || (m.text && m.text.startsWith("⚠️"))
                      ? "bg-rose-950/40 border border-rose-500/50 text-rose-200 rounded-tl-xs shadow-md"
                      : "bg-gravity-card border border-gravity-border text-slate-200 rounded-tl-xs shadow-cardGlow"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-mono mb-1.5">
                    <span className="font-semibold text-white/90">
                      {isUser ? "You" : "Claude Code"}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {typeof m.timestamp === "number"
                        ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans">
                    {m.text}
                  </div>
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-lg bg-amber-950/80 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isThinking && (
          <div className="flex gap-2 justify-start items-center animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="rounded-xl px-3 py-2 bg-gravity-card border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-medium">Claude Code is executing command on laptop...</span>
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
          className="absolute bottom-16 right-4 p-2 rounded-full bg-amber-600/90 hover:bg-amber-500 text-white shadow-xl border border-amber-400/50 active:scale-90 transition-all z-30 flex items-center justify-center animate-in fade-in"
          title="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Prompt Form */}
      <form onSubmit={handleSend} className="p-2.5 bg-gravity-surface/90 border-t border-gravity-border backdrop-blur-md flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder={`Instruct Claude in ${folderName}...`}
            disabled={isSubmitting}
            className="w-full bg-gravity-bg border border-gravity-border focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition font-sans shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={!promptInput.trim() || isSubmitting}
          className="p-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:opacity-95 disabled:opacity-40 text-white disabled:text-slate-500 active:scale-95 transition shadow-sm shrink-0 border border-amber-400/30"
          title="Send to Claude Code"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
