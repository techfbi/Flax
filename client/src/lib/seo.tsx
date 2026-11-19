import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

/*
  Builds complete per page metadata. Next merges metadata shallowly per
  top level key, so a page that sets openGraph without images would lose
  the site default image. Every public page goes through this helper so
  canonical, Open Graph and Twitter tags are always complete.
*/
export const buildMetadata = ({
  title,
  description,
  path,
  image,
  absoluteTitle = false,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; width?: number; height?: number; alt?: string };
  absoluteTitle?: boolean;
  type?: "website" | "article";
}): Metadata => {
  const url = absoluteUrl(path);
  const ogImage = image ?? { ...SITE.ogImage, alt: SITE.shortTitle };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE.name,
      locale: SITE.locale,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: SITE.twitter,
      images: [image?.url ?? SITE.twitterImage],
    },
  };
};

/*
  Renders schema.org JSON-LD. "<" is escaped so data coming from the
  food catalogue can never close the script tag early.
*/
export const JsonLd = ({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
  />
);

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

export const faqJsonLd = (faqs: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

export const organizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
  logo: absoluteUrl(SITE.logo),
  email: SITE.email,
  founder: { "@type": "Person", name: SITE.founder.name, sameAs: SITE.founder.sameAs },
  sameAs: [...SITE.founder.sameAs],
});

export const websiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  inLanguage: "en",
  publisher: { "@id": `${SITE.url}/#organization` },
});
