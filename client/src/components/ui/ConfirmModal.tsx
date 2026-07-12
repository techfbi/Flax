import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

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
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 flex items-center justify-center p-4
            bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          style={{ zIndex: 99999 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="bg-surface-two dark:bg-black-box rounded-2xl shadow-xl
              w-full max-w-sm p-6 flex flex-col gap-5"
            style={{ zIndex: 999999 }}
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
                className="flex-1 py-2.5 rounded-xl bg-rose-400 dark:bg-rose-400
                  text-surface text-sm font-semibold
                  hover:opacity-90 transition-opacity"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
