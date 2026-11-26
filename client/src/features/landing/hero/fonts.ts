import { Montserrat } from "next/font/google";

// Landing page headings. Loaded here, not in the root layout, so only
// the landing page downloads it.
export const montserrat = Montserrat({ subsets: ["latin"], weight: ["700", "800"], display: "swap" });
