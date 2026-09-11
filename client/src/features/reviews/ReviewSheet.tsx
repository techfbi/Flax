import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Send, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useReviewStore } from "@/store/reviewStore";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/errors";
import type { ApiResponse } from "@/types/apiTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewReply {
  id: string;
  message: string;
  is_edited: boolean;
  seen_by_user: boolean;
  created_at: string;
}

interface Review {
  id: string;
  user_id: string;
  message: string;
  is_edited: boolean;
  created_at: string;
  user: {
    display_name: string;
    avatar_url: string | null;
    email?: string;
  };
  reply: ReviewReply | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DRAFT_KEY = "flax_review_draft";
const ONE_HOUR = 60 * 60 * 1000;

const relativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const withinEditWindow = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() <= ONE_HOUR;

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({
  url,
  name,
  size = 34,
  isAdmin = false,
}: {
  url?: string | null;
  name: string;
  size?: number;
  isAdmin?: boolean;
}) => {
  const s = { width: size, height: size };

  if (isAdmin) {
    return (
      <div
        className="shrink-0 rounded-full bg-moringa flex items-center justify-center"
        style={s}
      >
        <svg
          width={size * 0.44}
          height={size * 0.44}
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
        </svg>
      </div>
    );
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={s}
        draggable={false}
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="shrink-0 rounded-full bg-cocoa/10 dark:bg-dark-white/10 flex items-center justify-center"
      style={s}
    >
      <span
        className="font-heading font-bold text-cocoa dark:text-dark-white"
        style={{ fontSize: size * 0.38 }}
      >
        {initials}
      </span>
    </div>
  );
};

// ─── ReviewItem ───────────────────────────────────────────────────────────────

const ReviewItem = ({
  review,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onReply,
  onEditReply,
  onDeleteReply,
}: {
  review: Review;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (id: string, msg: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReply: (reviewId: string, msg: string) => Promise<void>;
  onEditReply: (replyId: string, msg: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
}) => {
  const [editingReview, setEditingReview] = useState(false);
  const [reviewText, setReviewText] = useState(review.message);
  const [savingReview, setSavingReview] = useState(false);

  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  const [editingReply, setEditingReply] = useState(false);
  const [replyEditText, setReplyEditText] = useState(
    review.reply?.message ?? "",
  );

  const isOwn = currentUserId === review.user_id;
  const canEdit = isOwn && withinEditWindow(review.created_at);
  const canDelete = isOwn || isAdmin;
  const canReply = isAdmin && !review.reply;

  const fieldCls = `text-xs bg-surface-two dark:bg-black-surface border border-cocoa/20
     dark:border-dark-white/20 rounded-lg px-2.5 py-1.5 text-cocoa dark:text-dark-white
     outline-none focus:border-moringa-faded transition-colors flex-1`;

  const saveReview = async () => {
    if (!reviewText.trim() || reviewText.trim() === review.message) {
      setEditingReview(false);
      return;
    }
    setSavingReview(true);
    try {
      await onEdit(review.id, reviewText.trim());
      setEditingReview(false);
    } finally {
      setSavingReview(false);
    }
  };

  const saveReplyEdit = async () => {
    if (!review.reply || !replyEditText.trim()) return;
    setSavingReply(true);
    try {
      await onEditReply(review.reply.id, replyEditText.trim());
      setEditingReply(false);
    } finally {
      setSavingReply(false);
    }
  };

  const sendReply = async () => {
    if (!replyInput.trim()) return;
    setSavingReply(true);
    try {
      await onReply(review.id, replyInput.trim());
      setReplyInput("");
      setShowReplyBox(false);
    } finally {
      setSavingReply(false);
    }
  };

  return (
    <div className="group">
      {/* User review */}
      <div className="flex gap-2.5">
        <Avatar
          url={review.user.avatar_url}
          name={review.user.display_name}
          size={34}
        />
        <div className="flex-1 min-w-0">
          {/* Email (admin only) + name + time */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="min-w-0 flex-1">
              {isAdmin && review.user.email && (
                <span className="text-[10px] text-cocoa-faded block truncate leading-tight mb-px">
                  {review.user.email}
                </span>
              )}
              <span className="font-heading font-semibold text-xs text-cocoa dark:text-dark-white block">
                {review.user.display_name}
              </span>
            </div>
            <span className="text-[11px] text-cocoa-faded shrink-0 mt-px">
              {relativeTime(review.created_at)}
            </span>
          </div>

          {/* Message or edit input */}
          {editingReview ? (
            <div className="flex gap-1.5 mt-1">
              <input
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && saveReview()
                }
                className={fieldCls}
                style={{ fontSize: 16 }}
                autoFocus
              />
              <button
                onClick={saveReview}
                disabled={savingReview}
                className="p-1.5 rounded-lg bg-moringa text-white shrink-0"
              >
                {savingReview ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Check size={11} />
                )}
              </button>
              <button
                onClick={() => {
                  setEditingReview(false);
                  setReviewText(review.message);
                }}
                className="p-1.5 rounded-lg border border-cocoa/20 dark:border-dark-white/20 text-cocoa-faded shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-cocoa/80 dark:text-dark-white/80 leading-relaxed">
              {review.message}
            </p>
          )}

          {/* Edit / delete actions */}
          {!editingReview && (
            <div className="flex items-center gap-2 mt-1">
              {review.is_edited && (
                <span className="text-[10px] text-cocoa-faded">Edited</span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingReview(true);
                      setReviewText(review.message);
                    }}
                    className="p-1 rounded text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white transition-colors"
                    title="Edit (available for 1 hour)"
                  >
                    <Pencil size={10} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(review.id)}
                    className="p-1 rounded text-cocoa-faded hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Thread line + reply or reply button */}
      {(review.reply || canReply) && (
        <div className="ml-4 mt-1 flex">
          <div className="flex flex-col items-center" style={{ width: 18 }}>
            <div className="w-px bg-cocoa/10 dark:bg-dark-white/8 flex-1 my-1" />
          </div>

          <div className="flex-1 ml-1.5 pb-1">
            {review.reply ? (
              // Existing admin reply
              <div className="group/reply flex gap-2">
                <Avatar name="Admin" size={28} isAdmin />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-heading font-semibold text-xs text-cocoa dark:text-dark-white">
                      Admin
                    </span>
                    <span className="text-[11px] text-cocoa-faded shrink-0">
                      {relativeTime(review.reply.created_at)}
                    </span>
                  </div>

                  {editingReply ? (
                    <div className="flex gap-1.5 mt-1">
                      <input
                        value={replyEditText}
                        onChange={(e) => setReplyEditText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && !e.shiftKey && saveReplyEdit()
                        }
                        className={fieldCls}
                        style={{ fontSize: 16 }}
                        autoFocus
                      />
                      <button
                        onClick={saveReplyEdit}
                        disabled={savingReply}
                        className="p-1.5 rounded-lg bg-moringa text-white shrink-0"
                      >
                        {savingReply ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Check size={11} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditingReply(false);
                          setReplyEditText(review.reply!.message);
                        }}
                        className="p-1.5 rounded-lg border border-cocoa/20 dark:border-dark-white/20 text-cocoa-faded shrink-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-cocoa/80 dark:text-dark-white/80 leading-relaxed">
                      {review.reply.message}
                    </p>
                  )}

                  {isAdmin && !editingReply && (
                    <div className="flex items-center gap-2 mt-1">
                      {review.reply.is_edited && (
                        <span className="text-[10px] text-cocoa-faded">
                          Edited
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingReply(true);
                            setReplyEditText(review.reply!.message);
                          }}
                          className="p-1 rounded text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white transition-colors"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => onDeleteReply(review.reply!.id)}
                          className="p-1 rounded text-cocoa-faded hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                  {review.reply.is_edited && !isAdmin && (
                    <span className="text-[10px] text-cocoa-faded mt-1 block">
                      Edited
                    </span>
                  )}
                </div>
              </div>
            ) : canReply ? (
              // Reply button — expands to input on click
              <div className="mt-1">
                {!showReplyBox ? (
                  <button
                    onClick={() => setShowReplyBox(true)}
                    className="text-[11px] font-medium text-cocoa-faded hover:text-moringa
                      dark:hover:text-moringa-faded transition-colors"
                  >
                    Reply
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Avatar name="Admin" size={24} isAdmin />
                    <input
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !e.shiftKey && sendReply()
                      }
                      placeholder="Reply as admin..."
                      className={`${fieldCls} min-w-0`}
                      style={{ fontSize: 16 }}
                      autoFocus
                    />
                    <button
                      onClick={sendReply}
                      disabled={savingReply || !replyInput.trim()}
                      className="w-7 h-7 rounded-lg bg-moringa flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                    >
                      {savingReply ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Send size={11} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowReplyBox(false);
                        setReplyInput("");
                      }}
                      className="p-1 rounded text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ReviewSheet ──────────────────────────────────────────────────────────────

export const ReviewSheet = () => {
  const { isOpen, close } = useReviewStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";
  const currentUserId = user?.id ?? "";

  // Draft persists across navigation — initialised from localStorage on mount
  const [input, setInput] = useState<string>(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Animation — mounted trails isOpen so the exit animation plays before unmount
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  // Mobile drag-to-dismiss
  const dragStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Double rAF: first frame commits the initial translateY(100%) paint,
      // second frame applies the transition to translateY(0).
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShow(true)),
      );
      return () => cancelAnimationFrame(id);
    } else {
      setShow(false);
      setDragOffset(0);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ reviews: Review[] }>>("/api/reviews");
      return data.data.reviews;
    },
    enabled: isOpen,
  });

  const reviews = data ?? [];

  // Mark all replies as read and clear the red dot when the panel opens
  useEffect(() => {
    if (isOpen && !isAdmin) {
      api.post("/api/reviews/read").catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["reviews", "unread"] });
    }
  }, [isOpen, isAdmin, queryClient]);

  // Scroll list to bottom when new items appear
  useEffect(() => {
    if (listRef.current && reviews.length) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [reviews.length]);

  // Dismiss on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Lock body scroll while the sheet is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["reviews"] });

  const handleInputChange = (val: string) => {
    setInput(val);
    try {
      if (val) localStorage.setItem(DRAFT_KEY, val);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const handlePost = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.post("/api/reviews", { message: input.trim() });
      setInput("");
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to post review"));
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (id: string, msg: string) => {
    try {
      await api.patch(`/api/reviews/${id}`, { message: msg });
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to edit review"));
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/reviews/${id}`);
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete review"));
    }
  };
  const handleReply = async (reviewId: string, msg: string) => {
    try {
      await api.post(`/api/reviews/${reviewId}/reply`, { message: msg });
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to post reply"));
    }
  };
  const handleEditReply = async (replyId: string, msg: string) => {
    try {
      await api.patch(`/api/reviews/reply/${replyId}`, { message: msg });
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to edit reply"));
    }
  };
  const handleDeleteReply = async (replyId: string) => {
    try {
      await api.delete(`/api/reviews/reply/${replyId}`);
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete reply"));
    }
  };

  // Touch drag handlers for mobile sheet
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset > 110) close();
    else setDragOffset(0);
  };

  if (!mounted) return null;

  // Shared inner content used by both mobile sheet and desktop modal.
  // The parent containers in each case are flex-col with a fixed height
  // and overflow-hidden, so the list's flex-1 + overflow-y-auto produces
  // scrolling correctly without overflowing the container.
  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cocoa/8 dark:border-dark-white/8 shrink-0">
        <h3 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">
          {isAdmin ? "All Reviews" : "Reviews"}
        </h3>
        <button
          onClick={close}
          className="w-7 h-7 rounded-full bg-cocoa/5 dark:bg-dark-white/5 flex items-center justify-center
            text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Review list — this is the only scroll region */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-5"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-cocoa-faded" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-3">
            <div className="w-10 h-10 rounded-full bg-cocoa/5 dark:bg-dark-white/5 flex items-center justify-center">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-cocoa-faded"
              >
                <path
                  d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-heading font-semibold text-cocoa dark:text-dark-white mb-0.5">
                {isAdmin ? "No reviews yet" : "Drop a review"}
              </p>
              <p className="text-[11px] text-cocoa-faded leading-relaxed max-w-[180px]">
                {isAdmin
                  ? "Reviews from users will appear here"
                  : "Only you and the admin can see it"}
              </p>
            </div>
          </div>
        ) : (
          reviews.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={handleReply}
              onEditReply={handleEditReply}
              onDeleteReply={handleDeleteReply}
            />
          ))
        )}
      </div>

      {/* Input — hidden for admin, they reply inline per review */}
      {!isAdmin && (
        <div className="shrink-0 px-4 py-3 border-t border-cocoa/8 dark:border-dark-white/8">
          <div className="flex gap-2 items-center">
            <Avatar url={null} name={user?.display_name ?? "U"} size={30} />
            <input
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
              placeholder="Write a review..."
              className="flex-1 min-w-0 text-sm bg-surface-two dark:bg-black-surface border border-cocoa/15
                dark:border-dark-white/15 rounded-xl px-3 py-2 text-cocoa dark:text-dark-white
                outline-none focus:border-moringa-faded placeholder:text-cocoa-faded transition-colors"
              style={{ fontSize: 16 }}
            />
            <button
              onClick={handlePost}
              disabled={sending || !input.trim()}
              className="w-8 h-8 rounded-xl bg-moringa flex items-center justify-center text-white shrink-0 disabled:opacity-40"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Backdrop — fades in with the sheet */}
      <div
        className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[2px]"
        style={{
          opacity: show ? 1 : 0,
          transition: "opacity 0.3s",
        }}
        onClick={close}
      />

      {/* ── Mobile: bottom sheet ── */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[61] md:hidden"
        style={{
          // Slide up from bottom on open, slide down on close,
          // plus follow drag offset while the user is pulling it down.
          transform: show ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging
            ? "none"
            : "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div
          className="bg-surface dark:bg-black-surface rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "78vh" }}
        >
          {/* Drag handle */}
          <div
            className="shrink-0 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-9 h-1 rounded-full bg-cocoa/12 dark:bg-dark-white/12" />
          </div>

          {/* flex-col flex-1 min-h-0 fills the remaining height after the drag handle */}
          <div className="flex flex-col flex-1 min-h-0">{content}</div>
        </div>
      </div>

      {/* ── Desktop + tablet: centered modal ── */}
      <div className="hidden md:flex fixed inset-0 z-[61] items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-surface dark:bg-black-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto w-full"
          style={{
            maxWidth: 440,
            maxHeight: 560,
            minHeight: 260,
            // Subtle scale + fade so it does not just pop in
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.97)",
            transition:
              "opacity 0.22s, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    </>
  );
};
