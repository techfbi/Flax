import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type {
  ApiResponse,
  ChatHistoryData,
  ChatReplyData,
} from "@/types/apiTypes";

/*
  Noura chat widget.
  UX rules:
  1. User sends message -> immediately appears on right side, input clears.
  2. Noura "thinking" indicator appears immediately (3 fading dots, AI feel).
  3. When reply arrives, it types in character by character (streaming effect).
  4. No message waits in the input box while pending.
*/

/* Animated thinking dots — subtle pulsing, AI feel */
const ThinkingIndicator = () => (
  <div className="flex justify-start">
    <div
      className="rounded-2xl rounded-tl-sm px-4 py-3
      bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]"
    >
      <div className="flex items-center gap-1.5 h-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-moringa dark:bg-moringa-faded"
            style={{
              animation: "noura-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

/* Types text in character by character for AI streaming feel */
const StreamingMessage = ({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) => {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
        onDone();
      }
    }, 18); /* 18ms per char gives a fast natural feel */

    return () => clearInterval(interval);
  }, [text, onDone]);

  return (
    <div
      className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm
      bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]
      text-cocoa dark:text-dark-white leading-relaxed"
    >
      {displayed}
      <span
        className="inline-block w-px h-3.5 bg-moringa dark:bg-moringa-faded
        ml-0.5 align-middle animate-pulse"
      />
    </div>
  );
};

interface LocalMessage {
  role: "user" | "assistant" | "streaming";
  content: string;
  id: string;
}

export const NouraChat = () => {
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const historyLoaded = useRef(false);

  const { data: history } = useQuery({
    queryKey: ["chat-history"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<ChatHistoryData>>("/api/chat/history");
      return data.data.messages;
    },
    staleTime: 60 * 1000,
  });

  /* Seed local messages from history once on first load */
  useEffect(() => {
    if (history && !historyLoaded.current) {
      historyLoaded.current = true;
      setLocalMessages(
        history.map((m, i) => ({
          role: m.role,
          content: m.content,
          id: `history-${i}`,
        })),
      );
    }
  }, [history]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, isThinking, streamingText]);

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const { data } = await api.post<ApiResponse<ChatReplyData>>("/api/chat", {
        message: msg,
      });
      return data.data.reply;
    },
    onSuccess: (reply) => {
      setIsThinking(false);
      setStreamingText(reply);
    },
    onError: () => {
      setIsThinking(false);
      /* Remove the optimistic user message on failure */
      setLocalMessages((prev) => prev.slice(0, -1));
      toast.error("Could not send message. Try again.");
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isThinking || streamingText !== null) return;

    /* 1. Clear input immediately */
    setMessage("");
    inputRef.current?.focus();

    /* 2. Add user message to local state immediately */
    const userMsg: LocalMessage = {
      role: "user",
      content: trimmed,
      id: `user-${Date.now()}`,
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    /* 3. Show thinking indicator */
    setIsThinking(true);

    /* 4. Send to backend */
    sendMutation.mutate(trimmed);
  };

  const handleStreamDone = () => {
    if (streamingText === null) return;
    /* Commit streamed message to local messages */
    setLocalMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: streamingText,
        id: `noura-${Date.now()}`,
      },
    ]);
    setStreamingText(null);
    queryClient.invalidateQueries({ queryKey: ["chat-history"] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showDefault = localMessages.length === 0 && !isThinking;

  return (
    <div
      className="flex-1 min-h-0 bg-surface dark:bg-black-surface rounded-2xl
      flex flex-col overflow-hidden"
    >
      {/* Keyframes injected once */}
      <style>{`
        @keyframes noura-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 border-b
          border-cocoa/5 dark:border-dark-white/5 cursor-pointer
          hover:bg-cocoa/3 dark:hover:bg-dark-white/3 transition-colors shrink-0"
        onClick={() => (window.location.href = "/ask-noura")}
        role="button"
        aria-label="Open Noura full chat"
      >
        <div
          className="w-10 h-10 rounded-full bg-surface border-2
          border-cocoa/10 dark:border-dark-white/10
          flex items-center justify-center shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#E8623C">
            <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-cocoa dark:text-dark-white">
            Noura
          </p>
          <p className="text-xs text-cocoa-faded">Your nutrition assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0"
      >
        {/* Default greeting shown before any messages */}
        {showDefault && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm
              bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]
              text-cocoa dark:text-dark-white leading-relaxed"
            >
              Good day! I am Noura, your nutrition assistant. How can I help you
              today?
            </div>
          </div>
        )}

        {/* Chat history */}
        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`
              rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? "rounded-tr-sm bg-off-white dark:bg-dark-bg text-cocoa dark:text-dark-white"
                  : "rounded-tl-sm bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] text-cocoa dark:text-dark-white"
              }
            `}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && <ThinkingIndicator />}

        {/* Streaming Noura response */}
        {streamingText !== null && (
          <div className="flex justify-start">
            <StreamingMessage text={streamingText} onDone={handleStreamDone} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="p-4 border-t border-cocoa/5 dark:border-dark-white/5
        flex gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Noura..."
          disabled={isThinking || streamingText !== null}
          className="flex-1 bg-cocoa/5 dark:bg-dark-white/5
            rounded-xl px-4 py-2.5 text-sm outline-none
            text-cocoa dark:text-dark-white
            placeholder:text-cocoa-faded
            focus:ring-1 focus:ring-pawpaw dark:focus:ring-black-pawpaw
            disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isThinking || streamingText !== null || !message.trim()}
          aria-label="Send message"
          className="w-10 h-10 rounded-xl bg-pawpaw dark:bg-black-pawpaw
            text-surface flex items-center justify-center shrink-0
            hover:opacity-90 transition-opacity
            disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
