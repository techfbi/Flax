import { createContext, useContext, type ReactNode } from "react";
import { useNouraChat } from "@/hooks/useChat";

type NouraChatValue = ReturnType<typeof useNouraChat>;

const NouraChatContext = createContext<NouraChatValue | null>(null);

/*
  Provides one single instance of Noura's chat state to the whole app,
  not one per component. The home widget and the full chat page used
  to each call useNouraChat() directly, meaning they held two
  completely separate conversations in memory, opening the full page
  mid stream showed nothing until the widget finished and a later
  remount happened to pick up the result from the shared history
  cache. Mounted once, above the router, so navigating between the
  homepage and Ask Noura never creates a second instance.
*/
export const NouraChatProvider = ({ children }: { children: ReactNode }) => {
  const chat = useNouraChat();
  return (
    <NouraChatContext.Provider value={chat}>
      {children}
    </NouraChatContext.Provider>
  );
};

export const useNouraChatContext = (): NouraChatValue => {
  const ctx = useContext(NouraChatContext);
  if (!ctx) {
    throw new Error(
      "useNouraChatContext must be used inside NouraChatProvider",
    );
  }
  return ctx;
};
