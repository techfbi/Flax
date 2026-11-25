import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type {
  ApiResponse,
  ChatHistoryData,
  ChatReplyData,
} from "@/types/apiTypes";

/*
  Shared Noura chat logic, used by both the homepage widget and the
  full chat page so streaming, scrolling, sending, retrying, and
  clearing only exist in one place.

  All hooks below are called unconditionally, every render, in the
  same order, no early returns above them. That is deliberate, this
  file has been through several incremental edits and hook order bugs
  are exactly what happens when that rule slips, so keep any future
  edits to this file additive and above the return statement, never
  inside a condition.
*/

const SEND_TIMEOUT_MS = 20000;
const DRAFT_STORAGE_KEY = "flax-noura-draft";
const FAILED_STORAGE_KEY = "flax-noura-failed-messages";

export interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  /** Only meaningful for role "user". Undefined means confirmed sent. */
  status?: "sending" | "failed";
}

export const useNouraChat = () => {
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const historyLoaded = useRef(false);
  const isAtBottom = useRef(true);
  const sendControllerRef = useRef<AbortController | null>(null);
  const sendTimeoutRef = useRef<number | null>(null);

  //1 second delay before the thinking animation
  const thinkingDelayRef = useRef<number | null>(null);
  const clearThinkingDelay = () => {
    if (thinkingDelayRef.current) {
      window.clearTimeout(thinkingDelayRef.current);
      thinkingDelayRef.current = null;
    }
  };

  const queryClient = useQueryClient();
  // Restore anything left in the input box from before a reload.
  const [message, setMessage] = useState(() => {
    try {
      return sessionStorage.getItem(DRAFT_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (message) sessionStorage.setItem(DRAFT_STORAGE_KEY, message);
      else sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // storage unavailable, draft just will not survive a reload
    }
  }, [message]);

  useEffect(() => {
    const failed = localMessages.filter((m) => m.status === "failed");
    try {
      if (failed.length) sessionStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failed));
      else sessionStorage.removeItem(FAILED_STORAGE_KEY);
    } catch {
      // storage unavailable, failed messages just will not survive a reload
    }
  }, [localMessages]);

  const { data: history } = useQuery({
    queryKey: ["chat-history"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<ChatHistoryData>>("/api/chat/history");
      return data.data.messages;
    },
    staleTime: 60 * 1000,
  });

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

  //Persist failed messages so a message that couldn't send survives a reload too, and restore them once history has loaded
useEffect(() => {
  if (history && !historyLoaded.current) {
    historyLoaded.current = true;
    let restoredFailed: LocalMessage[] = [];
    try {
      const raw = sessionStorage.getItem(FAILED_STORAGE_KEY);
      if (raw) restoredFailed = JSON.parse(raw);
    } catch {
      // ignore corrupt or unavailable storage
    }
    setLocalMessages([
      ...history.map((m, i) => ({ role: m.role, content: m.content, id: `history-${i}` })),
      ...restoredFailed,
    ]);
  }
}, [history]);

  /*
    The chat follows the newest text (isAtBottom) so a streaming reply is
    always in view, until the user scrolls up to read. From then on it
    leaves the position alone, and follows again when they scroll back
    down to the end or send a message.

    Scrolling up is detected by direction, not distance. Text arrives every
    18ms, a slow drag would be pulled back before it got far enough from
    the bottom to count. Wheel and touch are read too because they fire
    before the first scroll event.
  */
  const lastScroll = useRef({ top: 0, height: 0, client: 0 });
  const touchY = useRef<number | null>(null);

  const stopFollowing = () => {
    // Nothing above to read, scrolling up cannot have been the intent.
    if (scrollRef.current && scrollRef.current.scrollTop > 0) {
      isAtBottom.current = false;
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const last = lastScroll.current;
    // The browser also moves the list up by itself when its content
    // shrinks or the keyboard closes, that is not the user scrolling.
    const resized = scrollHeight < last.height || clientHeight > last.client;
    if (scrollTop > last.top) {
      if (scrollHeight - scrollTop - clientHeight < 60) isAtBottom.current = true;
    } else if (scrollTop < last.top && !resized) {
      isAtBottom.current = false;
    }
    lastScroll.current = { top: scrollTop, height: scrollHeight, client: clientHeight };
  };

  // Spread on the scrolling list.
  const scrollHandlers = {
    onScroll: handleScroll,
    onWheel: (e: React.WheelEvent) => {
      if (e.deltaY < 0) stopFollowing();
    },
    onTouchStart: (e: React.TouchEvent) => {
      touchY.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const y = e.touches[0].clientY;
      if (touchY.current !== null && y > touchY.current) stopFollowing();
      touchY.current = y;
    },
    onTouchEnd: () => {
      touchY.current = null;
    },
    onTouchCancel: () => {
      touchY.current = null;
    },
  };

  const scrollToBottom = (force = false) => {
    if (!scrollRef.current) return;
    if (force) isAtBottom.current = true;
    if (!isAtBottom.current) return;
    requestAnimationFrame(() => {
      // Checked again, the user may have scrolled up since. Never moved
      // under a finger, on iOS that cancels the drag.
      if (scrollRef.current && isAtBottom.current && (force || touchY.current === null)) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMessages, isThinking]);

  useEffect(() => {
    if (streamingText !== null) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingText]);

  const clearSendWatchdog = () => {
    if (sendTimeoutRef.current) {
      window.clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
  };

  const sendMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const controller = new AbortController();
      sendControllerRef.current = controller;

      const { data } = await api.post<ApiResponse<ChatReplyData>>(
        "/api/chat",
        { message: text },
        { signal: controller.signal, timeout: SEND_TIMEOUT_MS },
      );
      return { id, reply: data.data.reply };
    },
    onMutate: ({ id }) => {
      // Plain browser timer, does not trust axios's own timeout option
      // to fire correctly. At the deadline it aborts the request and
      // flips this message to failed itself.
      clearSendWatchdog();
      clearThinkingDelay();
      thinkingDelayRef.current = window.setTimeout(() => setIsThinking(true), 1000);
      sendTimeoutRef.current = window.setTimeout(() => {
  sendControllerRef.current?.abort();
  setIsThinking(false);
  setLocalMessages((prev) =>
    prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)),
  );
}, SEND_TIMEOUT_MS);
    },
    onSuccess: ({ id, reply }) => {
      clearSendWatchdog();
      clearThinkingDelay();
      setIsThinking(false);
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: undefined } : m)),
      );
      setStreamingText(reply);
    },
    onError: (err: unknown, variables) => {
      clearSendWatchdog();
      clearThinkingDelay();
      setIsThinking(false);
      const code = (err as { code?: string })?.code;

      // The watchdog already marked the message failed before this
      // fires, for a cancellation caused by our own abort there is
      // nothing left to update on the message itself, resetting
      // isThinking above still needs to happen either way though.
      if (code === "ERR_CANCELED") return;

      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === variables.id ? { ...m, status: "failed" } : m,
        ),
      );
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/api/chat/history");
    },
    onSuccess: () => {
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ["chat-history"] });
      toast.success("Chat cleared");
    },
    onError: () => toast.error("Could not clear chat. Try again."),
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isThinking || streamingText !== null) return;

    setMessage("");
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // no-op
    }

    // Sending always returns to the newest message.
    isAtBottom.current = true;
    const id = `user-${Date.now()}`;
    setLocalMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, id, status: "sending" },
    ]);
    clearThinkingDelay();
    thinkingDelayRef.current = window.setTimeout(() => {
      setIsThinking(true);
    }, 1000);
    sendMutation.mutate({ id, text: trimmed });
  };

  const retryMessage = (id: string) => {
    const target = localMessages.find((m) => m.id === id);
    if (!target || target.status !== "failed") return;

    setLocalMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "sending" } : m)),
    );
    clearThinkingDelay();
    thinkingDelayRef.current = window.setTimeout(() => {
      setIsThinking(true);
    }, 1000);
    sendMutation.mutate({ id, text: target.content });
  };

  const handleStreamDone = () => {
    if (streamingText === null) return;
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

  useEffect(() => {
    return () => clearSendWatchdog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showDefault = localMessages.length === 0 && !isThinking;

  return {
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
    isSending: isThinking || streamingText !== null,
    clearChat: () => clearMutation.mutate(),
    isClearing: clearMutation.isPending,
    retryMessage,
  };
};