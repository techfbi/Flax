import { cache } from "react";

/*
  Server side access to the public food catalogue for the SEO food pages.
  Source: GET /api/public/foods on the backend, verified catalogue fields
  only, no user data. Never imported by client components.

  Failure policy, important for search engines:
  - During `next build` an unreachable backend (e.g. a cold Render
    instance) must not fail the deploy. Lists degrade to empty and the
    pages regenerate on the next revalidation.
  - At request time a failure THROWS. The page then errors (5xx), which
    search engines treat as temporary and retry, and Next keeps serving
    the last good cached copy. It must never turn into a 404, which
    would tell Google the page is gone.
*/

export interface PublicFood {
  slug: string;
  name: string;
  regional_names: string[];
  description: string;
  region: string;
  region_slug: string;
  image_url: string;
  tags: string[];
  meal_types: string[];
  allergen_tags: string[];
  ingredients: string[];
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_sizes: { label: string; grams: number }[];
  updated_at: string;
}

export const FOODS_REVALIDATE_SECONDS = 3600;

const API_ORIGIN = (process.env.API_ORIGIN ?? "https://flax-148t.onrender.com").replace(/\/+$/, "");
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const fetchFoodsOnce = async (): Promise<PublicFood[]> => {
  const res = await fetch(`${API_ORIGIN}/api/public/foods`, {
    headers: { accept: "application/json" },
    next: { revalidate: FOODS_REVALIDATE_SECONDS, tags: ["public-foods"] },
    // A cold Render instance can take ~30-50s to wake during a build.
    signal: AbortSignal.timeout(isBuildPhase ? 60_000 : 15_000),
  });
  if (!res.ok) throw new Error(`Public foods request failed with status ${res.status}`);
  const json = (await res.json()) as { data?: { foods?: unknown } };
  const foods = json?.data?.foods;
  if (!Array.isArray(foods)) throw new Error("Public foods response had an unexpected shape");
  return foods as PublicFood[];
};

const fetchFoods = async (): Promise<PublicFood[]> => {
  try {
    return await fetchFoodsOnce();
  } catch {
    // One retry covers a transient blip or the tail end of a cold start.
    return await fetchFoodsOnce();
  }
};

/** Throws on failure. Use for rendering pages at request time. */
export const getAllFoods = cache(async (): Promise<PublicFood[]> => {
  try {
    return await fetchFoods();
  } catch (err) {
    if (isBuildPhase) {
      console.warn(
        "[foods] Backend unreachable during build, food lists degrade to empty and regenerate on revalidation.",
        err instanceof Error ? err.message : err,
      );
      return [];
    }
    throw err;
  }
});

export const getFoodsByRegion = async (regionSlug: string): Promise<PublicFood[]> =>
  (await getAllFoods()).filter((f) => f.region_slug === regionSlug);

export const getFood = async (regionSlug: string, slug: string): Promise<PublicFood | null> =>
  (await getAllFoods()).find((f) => f.region_slug === regionSlug && f.slug === slug) ?? null;

export interface RegionSummary {
  slug: string;
  name: string;
  count: number;
}

export const getRegions = async (): Promise<RegionSummary[]> => {
  const byRegion = new Map<string, RegionSummary>();
  for (const food of await getAllFoods()) {
    const existing = byRegion.get(food.region_slug);
    if (existing) existing.count += 1;
    else byRegion.set(food.region_slug, { slug: food.region_slug, name: food.region, count: 1 });
  }
  // Nigeria and Ghana first, the audience Flax is built for, then the rest by size.
  const priority = ["nigeria", "ghana"];
  return [...byRegion.values()].sort((a, b) => {
    const pa = priority.indexOf(a.slug);
    const pb = priority.indexOf(b.slug);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return b.count - a.count;
  });
};

/*
  Catalogue images are full size PNG originals on Cloudinary, ~1.4 MB
  each. Shown at 72 px that made /foods download ~200 MB. Cloudinary
  resizes and re-encodes on its CDN when the transformation is part of
  the URL, a 144 px WebP thumbnail is ~4 KB. Derived images are cached
  by Cloudinary after the first request. Any other URL passes through.

  format "auto" serves WebP/AVIF to browsers that accept it, "jpg" is
  for Open Graph and structured data where crawlers expect JPEG/PNG.
*/
export const foodImage = (
  url: string,
  width: number,
  height: number = width,
  format: "auto" | "jpg" = "auto",
): string => {
  const marker = "/image/upload/";
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}f_${format},q_auto,c_fill,w_${width},h_${height}/`);
};

/** Public URL of a dish page, /foods/<region>/<slug>. */
export const foodPath = (food: Pick<PublicFood, "region_slug" | "slug">): string =>
  `/foods/${food.region_slug}/${food.slug}`;

/* ── Presentation helpers ─────────────────────────────────────── */

const DEMONYMS: Record<string, string> = {
  nigeria: "Nigerian",
  ghana: "Ghanaian",
  india: "Indian",
  china: "Chinese",
  america: "American",
};

export const regionDemonym = (regionSlug: string, regionName: string): string =>
  DEMONYMS[regionSlug] ?? regionName;

// General, true background about each cuisine, written so it never
// claims a specific dish is in the catalogue, the list below it shows that.
const REGION_INTROS: Record<string, string> = {
  nigeria:
    "Nigerian meals are built around filling staples, swallows like eba, amala, pounded yam and fufu eaten with soups such as egusi, ogbono and efo riro, rice dishes like jollof and fried rice, bean dishes like moi moi and akara, and street favourites like suya. Portions are often large and oils like palm oil add up quickly, which is exactly why knowing the calories and macros of local dishes matters.",
  ghana:
    "Ghanaian cooking shares a lot with the rest of West Africa, fermented corn and cassava staples like banku and kenkey, rice dishes like waakye and jollof, fufu with light soup or groundnut soup, and plantain in many forms. Many of these are energy dense, so tracking portions makes a real difference.",
};

export const regionIntro = (regionSlug: string, regionName: string): string =>
  REGION_INTROS[regionSlug] ??
  `Calories and macronutrients for popular ${regionDemonym(regionSlug, regionName)} dishes, per 100 g and per typical serving, so you can log what you actually eat.`;

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export const perPortion = (food: PublicFood, grams: number) => {
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories_per_100g * factor),
    protein_g: round1(food.protein_g * factor),
    carbs_g: round1(food.carbs_g * factor),
    fat_g: round1(food.fat_g * factor),
  };
};

/** Share of calories from each macro, using 4/4/9 kcal per gram. */
export const macroSplit = (food: PublicFood) => {
  const p = food.protein_g * 4;
  const c = food.carbs_g * 4;
  const f = food.fat_g * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((p / total) * 100),
    carbs: Math.round((c / total) * 100),
    fat: Math.round((f / total) * 100),
  };
};

export const humanList = (items: string[]): string => {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

export const formatTag = (tag: string): string => tag.replace(/[-_]/g, " ");
