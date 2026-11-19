import type { ReactNode } from "react";
import { PublicStatusBar } from "@/components/public/PublicStatusBar";

// Every server rendered public page: landing, foods, tools, about, legal.
const PublicLayout = ({ children }: { children: ReactNode }) => (
  <>
    <PublicStatusBar />
    {children}
  </>
);

export default PublicLayout;
