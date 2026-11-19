import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_STORAGE_KEY } from "@/lib/themeKey";
import { SITE } from "@/lib/site";
import "@/styles/globals.css";

// Self hosted at build time by next/font, same family and weights the
// old index.html pulled from Google Fonts at runtime, no render blocking
// third party request and no layout shift while it loads.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.BING_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s | Flax" },
  description: SITE.description,
  applicationName: SITE.name,
  creator: SITE.operator,
  publisher: SITE.operator,
  authors: [{ name: SITE.founder.name, url: SITE.founder.sameAs[1] }],
  category: "health",
  keywords: [
    "Nigerian food calories",
    "African food nutrition",
    "West African diet tracker",
    "AI meal scanner",
    "food calorie scanner",
    "nutrition tracker Nigeria",
    "calorie counter Nigerian food",
    "hydration tracker",
    "water intake tracker",
    "macro tracker",
    "Ghanaian food calories",
    "jollof rice calories",
    "AI nutrition assistant",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: SITE.title,
    description: SITE.description,
    images: [{ ...SITE.ogImage, alt: SITE.shortTitle }],
  },
  twitter: {
    card: "summary_large_image",
    creator: SITE.twitter,
    title: SITE.title,
    description: SITE.description,
    images: [SITE.twitterImage],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, email: false, address: false },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // useStatusBar rewrites this tag at runtime, same as under Vite.
  themeColor: "#ffffff",
};

/*
  Runs before first paint. Applies the saved or system theme to <html>
  so server rendered pages never flash light mode for dark mode users.
  Mirrors ThemeProvider's logic exactly.
*/
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;

const RootLayout = ({ children }: { children: ReactNode }) => (
  // suppressHydrationWarning: the theme script adds "dark" to this element
  // before React hydrates, that one attribute difference is expected.
  <html lang="en" className={inter.variable} suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {/* iOS status bar, read and updated at runtime by useStatusBar */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Flax" />
      <meta name="msapplication-TileColor" content="#ffffff" />
    </head>
    <body>
      <ThemeProvider>{children}</ThemeProvider>
      <div id="modal-root" />
    </body>
  </html>
);

export default RootLayout;
