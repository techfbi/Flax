import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { useNouraChat } from "@/hooks/useChat";

/*
  Noura chat widget, shown in the homepage right column. Logic lives in
  useNouraChat so the full page version at /ask-noura behaves exactly
  the same way, this file only owns the compact card presentation.
*/

const ThinkingIndicator = () => (
  <div className="flex justify-start">
    <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]">
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

const StreamingMessage = ({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) => {
  const indexRef = useRef(0);

  return <TypingText text={text} onDone={onDone} indexRef={indexRef} />;
};

// Split out so the interval effect resets cleanly whenever a new
// streaming message starts, same behavior as the original inline version.
const TypingText = ({
  text,
  onDone,
  indexRef,
}: {
  text: string;
  onDone: () => void;
  indexRef: React.MutableRefObject<number>;
}) => {
  const [displayed, setDisplayed] = useState("");

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
    }, 18);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div
      className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm
      bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]
      text-cocoa dark:text-dark-white leading-relaxed"
    >
      {displayed}
      <span className="inline-block w-px h-3.5 bg-moringa dark:bg-moringa-faded ml-0.5 align-middle animate-pulse" />
    </div>
  );
};

export const NouraChat = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    message,
    setMessage,
    localMessages,
    isThinking,
    streamingText,
    scrollRef,
    handleScroll,
    handleSend,
    handleStreamDone,
    handleKeyDown,
    showDefault,
    isSending,
  } = useNouraChat();

  return (
    <div className="bg-surface-two dark:bg-black-surface rounded-2xl flex flex-col overflow-hidden lg:flex-1 lg:min-h-0 max-h-[500px] lg:max-h-none">
      <style>{`
        @keyframes noura-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        className="flex items-center gap-3 p-4 border-b
          border-cocoa/5 dark:border-dark-white/5 cursor-pointer
          hover:bg-cocoa/3 dark:hover:bg-dark-white/3 transition-colors shrink-0"
        onClick={() => navigate("/ask-noura")}
        role="button"
        aria-label="Open Noura full chat"
      >
        <div className="w-10 h-10 rounded-full bg-surface-two border-2 border-cocoa/10 dark:border-dark-white/10 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#E8623C">
            <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold font-heading text-xs lg:text-base text-cocoa dark:text-dark-white">
            Noura
          </p>
          <p className="text-xs text-cocoa-faded">Your nutrition assistant</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0"
        onScroll={handleScroll}
      >
        {showDefault && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] text-xs bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] text-cocoa dark:text-dark-white leading-relaxed">
              Good day! I am Noura, your nutrition assistant. How can I help you
              today?
            </div>
          </div>
        )}

        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`rounded-2xl px-4 py-3 max-w-[85%] text-xs lg:text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? "rounded-tr-sm bg-off-white dark:bg-dark-bg text-cocoa dark:text-dark-white"
                  : "rounded-tl-sm bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] text-cocoa dark:text-dark-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isThinking && <ThinkingIndicator />}

        {streamingText !== null && (
          <div className="flex justify-start">
            <StreamingMessage text={streamingText} onDone={handleStreamDone} />
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-cocoa/5 dark:border-dark-white/5 flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Noura..."
          disabled={isSending}
          className="flex-1 bg-cocoa/5 dark:bg-dark-white/5 rounded-xl px-4 py-1.5 text-base lg:text-sm outline-none text-cocoa dark:text-dark-white shink-1 placeholder:text-cocoa-faded focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          aria-label="Send message"
          className="w-10 h-10 rounded-xl bg-pawpaw dark:bg-black-pawpaw text-surface flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
