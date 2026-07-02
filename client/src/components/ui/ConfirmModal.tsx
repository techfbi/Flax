/*
  Simple confirmation dialog.
  Used for logout and any other destructive action confirmation.
  No external library needed, built from our existing patterns.
*/
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      {/* Dialog card */}
      <div
        className="bg-surface dark:bg-black-box rounded-2xl shadow-xl
          w-full max-w-sm p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-2">
            {title}
          </h3>
          <p className="text-sm text-cocoa-faded">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-cocoa/15
              dark:border-dark-white/15 text-sm font-semibold
              text-cocoa dark:text-dark-white
              hover:bg-cocoa/5 dark:hover:bg-dark-white/5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-pawpaw dark:bg-black-pawpaw
              text-surface text-sm font-semibold
              hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
