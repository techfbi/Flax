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
  full chat page so the streaming, scrolling, and optimistic send
  behavior only exists in one place. Neither consumer needs to
  reimplement the thinking indicator timing or the character by
  character typing effect, they just read state from here.
*/

export interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  /** Only meaningful for role "user". Undefined means already confirmed sent. */
  status?: "sending" | "failed";
}

export const useNouraChat = () => {
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const historyLoaded = useRef(false);
  const isAtBottom = useRef(true);

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

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const scrollToBottom = (force = false) => {
    if (!scrollRef.current) return;
    if (!force && !isAtBottom.current) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, isThinking]);

  useEffect(() => {
    if (streamingText !== null) {
      scrollToBottom();
    }
  }, [streamingText]);

  const sendMutation = useMutation({
  mutationFn: async ({ id, text }: { id: string; text: string }) => {
    const { data } = await api.post<ApiResponse<ChatReplyData>>("/api/chat", {
      message: text,
    });
    return { id, reply: data.data.reply };
  },
  onSuccess: ({ id, reply }) => {
    setIsThinking(false);
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: undefined } : m)),
    );
    setStreamingText(reply);
  },
  onError: (_err, variables) => {
    setIsThinking(false);
    // The message stays in the list, it just gets marked failed instead
    // of being deleted, so a lost connection never erases what the
    // user typed.
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

    const id = `user-${Date.now()}`;
    setLocalMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, id, status: "sending" },
    ]);
    setIsThinking(true);
    sendMutation.mutate({ id, text: trimmed });
   };

   const retryMessage = (id: string) => {
    const target = localMessages.find((m) => m.id === id);
    if (!target || target.status !== "failed") return;

    setLocalMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "sending" } : m)),
    );
    setIsThinking(true);
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

  const showDefault = localMessages.length === 0 && !isThinking;

return {
  message,
  setMessage,
  localMessages,
  isThinking,
  streamingText,
  scrollRef,
  handleScroll,
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