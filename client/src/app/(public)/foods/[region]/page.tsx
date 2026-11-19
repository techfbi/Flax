import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SignupCta, SiteShell } from "@/components/public/SiteShell";
import { FoodCard, foodPath } from "@/components/public/FoodCard";
import {
  getAllFoods,
  getFoodsByRegion,
  getRegions,
  regionDemonym,
  regionIntro,
} from "@/lib/foods";
import { JsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

type Params = { region: string };

export const generateStaticParams = async (): Promise<Params[]> =>
  (await getRegions()).map((r) => ({ region: r.slug }));

const loadRegion = async (regionSlug: string) => {
  const foods = await getFoodsByRegion(regionSlug);
  if (foods.length === 0) return null;
  return { foods, name: foods[0].region, demonym: regionDemonym(regionSlug, foods[0].region) };
};

export const generateMetadata = async ({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> => {
  const { region } = await params;
  const data = await loadRegion(region);
  if (!data) return { title: "Not found", robots: { index: false } };
  const examples = data.foods.slice(0, 4).map((f) => f.name.toLowerCase()).join(", ");
  return buildMetadata({
    title: `${data.demonym} Food Calories & Nutrition Facts (${data.foods.length} Dishes)`,
    description: `Calories, protein, carbs and fat for ${data.foods.length} ${data.demonym} dishes including ${examples}, per 100 g and per serving. Track ${data.demonym} food easily with Flax.`,
    path: `/foods/${region}`,
  });
};

const RegionPage = async ({ params }: { params: Promise<Params> }) => {
  const { region } = await params;
  const data = await loadRegion(region);
  if (!data) {
    // Only a real 404 when the catalogue loaded and this region is not in
    // it. If the backend was unreachable getAllFoods throws instead, which
    // is a temporary error, never a "page gone" signal to search engines.
    // An empty list (only possible during a degraded build) is not a 404 either.
    if ((await getAllFoods()).length > 0) notFound();
    throw new Error("Food catalogue unavailable");
  }

  const { foods, name, demonym } = data;
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name));
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Foods", path: "/foods" },
    { name: `${demonym} food`, path: `/foods/${region}` },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${demonym} food calories and nutrition facts`,
            url: absoluteUrl(`/foods/${region}`),
            about: { "@type": "Country", name },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: sorted.length,
              itemListElement: sorted.map((food, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: food.name,
                url: absoluteUrl(foodPath(food)),
              })),
            },
          },
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <header className="mb-10">
        <h1 className="font-heading font-bold text-2xl md:text-4xl text-cocoa dark:text-dark-white leading-tight mb-4">
          {demonym} food{" "}
          <span className="text-pawpaw dark:text-black-pawpaw">calories &amp; nutrition facts</span>
        </h1>
        <p className="text-sm md:text-base text-cocoa dark:text-dark-white/90 leading-relaxed max-w-3xl">
          {regionIntro(region, name)}
        </p>
        <p className="text-sm text-cocoa-faded mt-3">
          {sorted.length} {demonym} dishes, values per 100 g. Open any dish for calories per serving,
          ingredients and allergens.
        </p>
      </header>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {sorted.map((food) => (
          <FoodCard key={food.slug} food={food} />
        ))}
      </ul>

      <p className="text-xs text-cocoa-faded leading-relaxed">
        Nutrition values are estimates for typical home recipes. Ingredients, oil and portion sizes
        vary, so the exact values of your plate can differ.
      </p>

      <SignupCta
        title={`Track ${demonym} food without guessing`}
        body={`Log any of these dishes in seconds, or snap your plate and Noura identifies each item and estimates the calories and macros for you. Free.`}
      />
    </SiteShell>
  );
};

export default RegionPage;
