import { useState, useEffect } from "react";

// Matches AppLayout's own breakpoint reasoning, mobile below 768,
// tablet 768 to 1023 with the collapsed icon sidebar, desktop 1024
// and up with the full sidebar and no page level scroll.
export type ScreenTier = "mobile" | "tablet" | "desktop";

const getTier = (): ScreenTier => {
  const w = window.innerWidth;
  if (w >= 1024) return "desktop";
  if (w >= 768) return "tablet";
  return "mobile";
};

export const useScreenTier = (): ScreenTier => {
  const [tier, setTier] = useState<ScreenTier>(getTier);

  useEffect(() => {
    const handleResize = () => setTier(getTier());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return tier;
};