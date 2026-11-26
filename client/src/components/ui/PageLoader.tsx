import { FlaxLoader } from "./FlaxLoader";

/*
  Full screen loading state, shared by the router (while the session is
  verified and while a screen's code loads) and the Next shell (before the
  app mounts), so every loading moment looks the same.
*/
export const PageLoader = () => (
  <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-bg">
    <FlaxLoader className="w-16 text-cocoa dark:text-white" />
  </div>
);
