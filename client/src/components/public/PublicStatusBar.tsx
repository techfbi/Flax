"use client";

import { useStatusBar } from "@/hooks/useStatusBar";

// Same mobile status bar tinting the SPA applied to the landing page.
export const PublicStatusBar = () => {
  useStatusBar({ show: true });
  return null;
};
