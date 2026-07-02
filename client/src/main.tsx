import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/context/ThemeContext";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "sonner";
import AppRouter from "@/router/index";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    {/* QueryClientProvider: server state and caching */}
    <QueryClientProvider client={queryClient}>
      {/* ThemeProvider: light/dark/system theme via <html class="dark"> */}
      <ThemeProvider>
        <AppRouter />
        {/*
          Toaster renders the floating top-center success/error pill.*/}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: { borderRadius: "999px", fontSize: "13px" },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
