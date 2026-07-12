import { motion } from "framer-motion";
/*
  Spin tips popup.
  Desktop: stacked modal with 5 tips, two buttons.
  Mobile: bottom sheet with 3 tips.
  "Ok": dismisses for this session only (sessionStorage).
  "Do not show again": stores in localStorage, never shows again.
*/

interface SpinTipsPopupProps {
  onOk: () => void;
  onDontShow: () => void;
}

const TIPS_FULL = [
  "Spin for personalized meals + Noura's insight",
  "Like on meals that match your taste to show it more often",
  "Flag meals that are irrelevant to you so they won't appear again",
  "Add available food-stuff / ingredients to your pantry to get tailored suggestions",
  "Log meal immediately or from history if suggested result is what you are having",
];

const TIPS_MOBILE = TIPS_FULL.slice(0, 3);

export const SpinTipsPopup = ({ onOk, onDontShow }: SpinTipsPopupProps) => {
  return (
    <>
      {/* Desktop version */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="hidden md:flex fixed inset-0 z-50 items-center
        justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-md mx-4
          bg-off-white dark:bg-black-surface rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-6">
            <h3 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-4">
              Tips
            </h3>
            <ul className="space-y-2.5">
              {TIPS_FULL.map((tip, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm text-cocoa dark:text-dark-white"
                >
                  <span className="text-cocoa/40 dark:text-dark-white/40 shrink-0 mt-0.5">
                    •
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex border-t border-cocoa/10 dark:border-dark-white/10">
            <button
              onClick={onOk}
              className="flex-1 py-4 text-sm font-semibold text-cocoa dark:text-dark-white
                hover:bg-cocoa/5 dark:hover:bg-dark-white/5 transition-colors"
            >
              Ok
            </button>
            <div className="w-px bg-cocoa/10 dark:border-dark-white/10" />
            <button
              onClick={onDontShow}
              className="flex-1 py-4 text-sm font-semibold text-cocoa dark:text-dark-white
                hover:bg-cocoa/5 dark:hover:bg-dark-white/5 transition-colors"
            >
              Do not show again
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Mobile version: bottom sheet */}
      <div className="md:hidden fixed inset-0 z-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 bg-black/30"
          onClick={onOk}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-0 left-0 right-0
          bg-off-white dark:bg-black-surface rounded-t-3xl overflow-hidden shadow-2xl"
        >
          <div className="p-5">
            <h3 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-3">
              Tips
            </h3>
            <ul className="space-y-2">
              {TIPS_MOBILE.map((tip, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-cocoa dark:text-dark-white"
                >
                  <span className="text-cocoa/40 dark:text-dark-white/40 shrink-0">
                    •
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex border-t border-cocoa/10 dark:border-dark-white/10">
            <button
              onClick={onOk}
              className="flex-1 py-4 text-sm font-semibold text-cocoa dark:text-dark-white"
            >
              Ok
            </button>
            <div className="w-px bg-cocoa/10" />
            <button
              onClick={onDontShow}
              className="flex-1 py-4 text-sm font-semibold text-cocoa dark:text-dark-white"
            >
              Do not show again
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};
