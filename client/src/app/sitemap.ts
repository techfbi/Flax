import type { MetadataRoute } from "next";
import { foodPath, getAllFoods } from "@/lib/foods";
import { LEGAL_LAST_UPDATED, SITE, absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

// Fixed dates, not "now": a lastModified that changes on every build
// teaches search engines to ignore it. Bump when the page content changes.
const CONTENT_UPDATED = "2026-11-19";

/*
  Only indexable pages belong here. The app screens, login and register
  are noindex and deliberately left out, listing a noindex URL in a
  sitemap sends search engines conflicting signals.
*/
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const foods = await getAllFoods();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/foods"), lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    {
      url: absoluteUrl("/tools/calorie-calculator"),
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: absoluteUrl("/about"), lastModified: CONTENT_UPDATED, changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), lastModified: LEGAL_LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), lastModified: LEGAL_LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];

  const latestByRegion = new Map<string, string>();
  for (const food of foods) {
    const prev = latestByRegion.get(food.region_slug);
    if (!prev || food.updated_at > prev) latestByRegion.set(food.region_slug, food.updated_at);
  }

  const regionPages: MetadataRoute.Sitemap = [...latestByRegion.entries()].map(([slug, updated]) => ({
    url: absoluteUrl(`/foods/${slug}`),
    lastModified: updated,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const foodPages: MetadataRoute.Sitemap = foods.map((food) => ({
    url: absoluteUrl(foodPath(food)),
    lastModified: food.updated_at,
    changeFrequency: "monthly",
    priority: 0.7,
    images: [food.image_url],
  }));

  return [...staticPages, ...regionPages, ...foodPages];
};

export default sitemap;
