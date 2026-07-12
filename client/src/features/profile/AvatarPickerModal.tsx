import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Check, Ban } from "lucide-react";
import { AVATARS } from "@/lib/avatars";
import type { BiologicalSex } from "@/types/apiTypes";

interface AvatarPickerModalProps {
  open: boolean;
  biologicalSex: BiologicalSex | string | null | undefined;
  currentUrl: string | null;
  onSelect: (url: string | null) => void;
  onClose: () => void;
}

/*
  Rectangular modal, 5 avatars in a row that scrolls horizontally
  rather than wrapping on small screens. Set only shows the user's own
  sex's avatars, if biological sex isn't set yet, shows both sets so
  nobody is blocked from picking one.

  Avatar paths in lib/avatars.ts are relative to the client's own
  public folder, resolved to an absolute URL here since the backend
  requires avatar_url to be a full URL, not a path.
*/
const toAbsolute = (path: string) => `${window.location.origin}${path}`;

export const AvatarPickerModal = ({
  open,
  biologicalSex,
  currentUrl,
  onSelect,
  onClose,
}: AvatarPickerModalProps) => {
  const options =
    biologicalSex === "male"
      ? AVATARS.male
      : biologicalSex === "female"
        ? AVATARS.female
        : [...AVATARS.male, ...AVATARS.female];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          style={{ zIndex: 99999 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="bg-surface-two dark:bg-black-surface rounded-2xl shadow-xl w-full max-w-md p-5"
            style={{ zIndex: 999999 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-cocoa dark:text-dark-white">
                Choose an avatar
              </h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              <button
                onClick={() => onSelect(null)}
                aria-label="Remove avatar"
                className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-colors
                  flex items-center justify-center bg-cocoa/8 dark:bg-dark-white/8"
                style={{
                  borderColor:
                    currentUrl === null
                      ? "var(--tw-color-pawpaw, #E8623C)"
                      : "transparent",
                }}
              >
                <Ban size={18} className="text-cocoa-faded" />
                {currentUrl === null && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Check size={18} className="text-white" />
                  </span>
                )}
              </button>

              {options.map((url) => {
                const absoluteUrl = toAbsolute(url);
                return (
                  <button
                    key={url}
                    onClick={() => onSelect(absoluteUrl)}
                    className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-colors"
                    style={{
                      borderColor:
                        currentUrl === absoluteUrl
                          ? "var(--tw-color-pawpaw, #E8623C)"
                          : "transparent",
                    }}
                  >
                    <img
                      src={url}
                      alt="Avatar option"
                      className="w-full h-full object-cover bg-cocoa/10"
                    />
                    {currentUrl === absoluteUrl && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Check size={18} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
