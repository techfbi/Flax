/* Full screen spinner, identical to the one in src/router/index.tsx. */
export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-bg">
    <div
      className="w-8 h-8 rounded-full animate-spin border-2 border-moringa dark:border-moringa-faded border-t-transparent dark:border-t-transparent"
      style={{ borderTopColor: "transparent" }}
    />
  </div>
);
