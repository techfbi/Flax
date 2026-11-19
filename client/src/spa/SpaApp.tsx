"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";
import AppRouter from "@/router/index";

/*
  The signed in app, exactly what src/main.tsx used to render under Vite,
  minus ThemeProvider which now lives in the root layout so public pages
  and the app share one theme. Loaded client side only (ssr: false) by
  app/[...app]/SpaShell.tsx, it reads window, storage and the in memory
  token store from its first render, none of which exist on a server.
*/
const SpaApp = () => (
  // QueryClientProvider: server state and caching
  <QueryClientProvider client={queryClient}>
    <AppRouter />
    {/* Toaster renders the floating top-center success/error pill. */}
    <Toaster
      position="top-center"
      richColors
      toastOptions={{
        style: { borderRadius: "999px", fontSize: "13px" },
      }}
    />
  </QueryClientProvider>
);

export default SpaApp;
