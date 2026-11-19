import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { LANDING_FAQS } from "@/features/landing/landingFaqs";
import {
  JsonLd,
  buildMetadata,
  faqJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { SITE, absoluteUrl } from "@/lib/site";

// The homepage. Fully static, rendered at build time, served from the CDN.
export const metadata: Metadata = buildMetadata({
  title: SITE.title,
  absoluteTitle: true,
  description: SITE.description,
  path: "/",
});

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE.url}/#app`,
  name: SITE.name,
  url: SITE.url,
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Nutrition tracker",
  // Web app (installable PWA). No native store apps exist, so none are claimed.
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript. Works in any modern mobile or desktop browser.",
  inLanguage: "en",
  image: absoluteUrl(SITE.ogImage.url),
  description:
    "An AI nutrition and hydration tracker for Nigerian, Ghanaian and West African dishes. Noura, the built in AI assistant, scans meals, estimates calories and macros, and answers food questions personalised to the user's health profile. Users track calories and water against personalised targets, build daily streaks, and log local dishes like jollof rice, egusi soup, pounded yam, fufu, waakye and nkwobi.",
  featureList: [
    "AI meal scanner that identifies each item on a plate and estimates calories and macros",
    "Food catalogue of Nigerian and Ghanaian dishes with real serving sizes",
    "AI nutrition estimates for homemade and regional dishes from a description",
    "Personalised calorie and water targets (Mifflin-St Jeor)",
    "Water intake tracking and hydration streaks",
    "Meal suggestions that respect allergies, goals and pantry ingredients",
    "Noura, an AI nutrition assistant",
  ],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": `${SITE.url}/#organization` },
  author: {
    "@type": "Person",
    name: SITE.founder.name,
    sameAs: SITE.founder.sameAs,
  },
};

const HomePage = () => (
  <>
    <JsonLd
      data={[
        organizationJsonLd(),
        websiteJsonLd(),
        softwareApplicationJsonLd,
        faqJsonLd(LANDING_FAQS),
      ]}
    />
    <LandingPage />
  </>
);

export default HomePage;
