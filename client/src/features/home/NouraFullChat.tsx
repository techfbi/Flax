import { useRef, useState, useEffect } from "react";
import { Send, Trash2 } from "lucide-react";
import { useNouraChatContext } from "@/context/NouraChatContext";
import { useAuthStore } from "@/store/authStore";
import { AnimatePresence, motion } from "framer-motion";
import { NouraMarkdown } from "@/components/ui/NouraMarkdown";

/*
  Full screen Noura chat body. No background behind the messages, they
  sit on the page gradient, only the composer has one. Before the
  first message the composer sits centered with the welcome text, like
  Claude's own empty state, once a message is sent it moves down to
  its sticky bottom position and stays there.

  Auto scroll runs on every character the typing animation reveals,
  not just once when streaming starts, so the animation stays in view
  until it finishes, unless the user scrolls up to read.
*/
export const NouraFullChat = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { user } = useAuthStore();

  const firstName = user?.display_name?.split(" ")[0] ?? "there";

  const {
    message,
    setMessage,
    localMessages,
    isThinking,
    streamingText,
    scrollRef,
    scrollHandlers,
    scrollToBottom,
    handleSend,
    handleStreamDone,
    handleKeyDown,
    showDefault,
    isSending,
    clearChat,
    isClearing,
    retryMessage,
  } = useNouraChatContext();

  useEffect(() => {
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A full markdown parser re-reading and rebuilding a syntax tree on
  // every character of a live stream is expensive enough to drop
  // frames, that was the actual cause of the stutter. This only
  // handles bold text, the one thing worth keeping live since our own
  // prompt is what asks the model to use it, cheap enough to run on
  // every tick. Escaping happens first, the bold tag is only ever
  // inserted after that, so nothing here can inject real markup.
  const renderLiveText = (text: string): { __html: string } => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return { __html: withBold };
  };

  useEffect(() => {
    if (streamingText === null) return;
    indexRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      if (indexRef.current < streamingText.length) {
        setDisplayed(streamingText.slice(0, indexRef.current + 1));
        indexRef.current++;
        // Keeps the growing bubble in view for every character typed,
        // not only once when the stream starts. Not forced, so it stops
        // when the user scrolls up to read.
        scrollToBottom();
      } else {
        clearInterval(interval);
        handleStreamDone();
      }
    }, 18);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingText]);

  useEffect(() => {
    // Lock the document scroll while the full chat is open so mobile
    // browsers cannot scroll the page itself. Only the message list
    // scrolls internally via its own overflow-y-auto container.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleConfirmClear = () => {
    clearChat();
    setConfirmingClear(false);
  };

  // add near the other hooks in the component
  useEffect(() => {
    if (!isSending) {
      inputRef.current?.focus();
    }
  }, [isSending]);

  return (
    <div className="overflow-hidden flex flex-col h-full min-h-0 w-full max-w-[720px] mx-auto relative">
      {localMessages.length > 0 && (
        <div className="flex justify-end px-4 pt-1 shrink-0">
          <button
            onClick={() => setConfirmingClear(true)}
            aria-label="Clear chat"
            className="flex items-center gap-1.5 text-xs text-cocoa-faded
                hover:text-rose-700 transition-colors"
          >
            <Trash2 size={13} /> Clear chat
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        {...scrollHandlers}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col gap-4"
      >
        {showDefault && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="font-heading font-bold text-2xl lg:text-3xl text-cocoa dark:text-dark-white mb-2">
                Hi {firstName}, I am Noura
              </p>
              <p className="text-sm text-cocoa-faded max-w-sm">
                Ask me about meals, ingredients, nutrition, what fits your goal
                today, or what to eat next. I would be more than glad to journey
                along with you.
              </p>
            </div>
          </div>
        )}

        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`rounded-2xl px-3 py-3 max-w-[75%] text-xs md:text-sm leading-relaxed
      ${
        msg.role === "user"
          ? "rounded-tr-sm bg-surface-two dark:bg-dark-bg text-cocoa dark:text-dark-white"
          : "rounded-tl-sm bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] text-cocoa dark:text-dark-white"
      }
      ${msg.status === "failed" ? "opacity-60" : ""}`}
            >
              <NouraMarkdown text={msg.content} />
            </div>
            {msg.status === "failed" && (
              <div className="flex items-center gap-2 mt-1 mr-1">
                <span className="text-xs text-rose-700 dark:text-rose-500">
                  Message not sent, please try again
                </span>
                <button
                  onClick={() => retryMessage(msg.id)}
                  className="text-xs font-semibold text-moringa dark:text-moringa-faded hover:opacity-70"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
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
        )}

        {streamingText !== null && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%] text-xs md:text-sm bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] text-cocoa dark:text-dark-white leading-relaxed whitespace-pre-wrap">
              <span dangerouslySetInnerHTML={renderLiveText(displayed)} />
              <span className="inline-block w-px h-3.5 bg-moringa dark:bg-moringa-faded ml-0.5 align-middle animate-pulse" />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes noura-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Composer: centered with the welcome before the first message,
      sticky at the bottom for the rest of the conversation. */}
      <div
        className={
          showDefault
            ? "shrink-0 px-4 pb-24 flex justify-center"
            : "shrink-0 px-4 pb-4 pt-2"
        }
      >
        <div className="flex gap-2 bg-surface-two dark:bg-black-surface rounded-2xl p-2 shadow-sm w-full">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Noura..."
            className="flex-1 bg-transparent outline-none px-3 py-2 text-base text-cocoa dark:text-dark-white placeholder:text-cocoa-faded"
          />
          {/* The input is never disabled: a disabled field loses focus,
          which closed the mobile keyboard on every send. handleSend and
          the disabled button already block sending while Noura answers.
          preventDefault on mousedown keeps focus in the input, so
          tapping send does not close the keyboard either. */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            aria-label="Send message"
            className="w-10 h-10 rounded-xl bg-pawpaw dark:bg-black-pawpaw text-surface flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {confirmingClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-[90%] max-w-sm rounded-2xl bg-off-white dark:bg-dark-bg
p-5 shadow-xl border border-cocoa/10 dark:border-dark-white/10"
            >
              <h3 className="text-base font-semibold text-cocoa dark:text-dark-white">
                Clear chat?
              </h3>
              <p className="mt-2 text-sm text-cocoa-faded">
                This will permanently delete the entire conversation.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmingClear(false)}
                  className="px-4 py-2 rounded-lg text-sm
        text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmClear}
                  disabled={isClearing}
                  className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm
        hover:bg-rose-600 disabled:opacity-50"
                >
                  {isClearing ? "Clearing..." : "Clear chat"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
