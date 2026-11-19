import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, SignupCta, SiteShell } from "@/components/public/SiteShell";
import { FoodCard, foodPath } from "@/components/public/FoodCard";
import { getAllFoods, getRegions, regionDemonym } from "@/lib/foods";
import { JsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Food Calories & Nutrition Facts for Nigerian and African Dishes",
  description:
    "Calories, protein, carbs and fat for Nigerian, Ghanaian and other African dishes, per 100 g and per real serving size. Jollof rice, egusi soup, amala, pounded yam, waakye and more.",
  path: "/foods",
});

const PREVIEW_PER_REGION = 9;

const FoodsIndexPage = async () => {
  const [foods, regions] = await Promise.all([getAllFoods(), getRegions()]);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Foods", path: "/foods" },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Food calories and nutrition facts",
            url: absoluteUrl("/foods"),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: foods.length,
              itemListElement: foods.map((food, i) => ({
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
          Food calories &amp; nutrition facts for{" "}
          <span className="text-pawpaw dark:text-black-pawpaw">Nigerian and African dishes</span>
        </h1>
        <p className="text-sm md:text-base text-cocoa dark:text-dark-white/90 leading-relaxed max-w-3xl">
          Most calorie databases barely cover the food people in Nigeria and West Africa actually
          eat. This is the Flax food catalogue: calories, protein, carbohydrates and fat for local
          dishes, per 100 g and per real serving size, like a cup of rice or a medium ball of eba.
          Every dish here can be logged in the Flax app in seconds.
        </p>
      </header>

      {foods.length === 0 ? (
        <p className="text-sm text-cocoa-faded">
          The food catalogue is updating right now. Please check back in a few minutes.
        </p>
      ) : (
        regions.map((region) => {
          const regionFoods = foods.filter((f) => f.region_slug === region.slug);
          const demonym = regionDemonym(region.slug, region.name);
          return (
            <section key={region.slug} className="mb-12" aria-labelledby={`region-${region.slug}`}>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2
                  id={`region-${region.slug}`}
                  className="font-heading font-bold text-lg md:text-2xl text-cocoa dark:text-dark-white"
                >
                  {demonym} food calories
                </h2>
                <Link
                  href={`/foods/${region.slug}`}
                  className="text-xs md:text-sm font-semibold text-moringa dark:text-moringa-faded hover:underline underline-offset-2 shrink-0"
                >
                  All {region.count} {demonym} dishes →
                </Link>
              </div>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {regionFoods.slice(0, PREVIEW_PER_REGION).map((food) => (
                  <FoodCard key={food.slug} food={food} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <p className="text-xs text-cocoa-faded leading-relaxed">
        Nutrition values are estimates for typical home recipes. Ingredients, oil and portion sizes
        vary, so the exact values of your plate can differ.
      </p>

      <SignupCta />
    </SiteShell>
  );
};

export default FoodsIndexPage;
