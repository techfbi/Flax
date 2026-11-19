/*
  Single source of truth for public site identity. Every canonical URL,
  sitemap entry, Open Graph tag and JSON-LD block is built from these.

  The canonical host is www. useflax.cc (no www) 308 redirects to it at
  the domain level, so no URL anywhere should point at the bare domain.
*/
export const SITE = {
  url: "https://www.useflax.cc",
  name: "Flax",
  title: "Flax | AI Nutrition & Hydration Tracker for Nigerian and West African Dishes",
  shortTitle: "Flax — AI nutrition tracker for Nigerian & African food",
  description:
    "Flax is an AI nutrition and hydration tracker built for Nigerian and West African food. Scan your plate, log local dishes like jollof rice, egusi and amala, track calories, macros and water, and get personalised guidance from Noura, your AI nutrition assistant.",
  operator: "Tech FBI",
  founder: {
    name: "Oluwafemi Johnson Daodu",
    sameAs: ["https://x.com/ojayy__x", "https://www.linkedin.com/in/johnsonprofile"],
  },
  twitter: "@ojayy__x",
  email: "support@useflax.cc",
  ogImage: { url: "/og-image.png", width: 1081, height: 569 },
  twitterImage: "/twitter_og_image.png",
  logo: "/android-chrome-512x512.png",
  locale: "en_NG",
} as const;

export const absoluteUrl = (path = "/"): string =>
  `${SITE.url}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}` || SITE.url;

// Date shown on legal pages. Update whenever their content changes.
export const LEGAL_LAST_UPDATED = "2026-11-19";
