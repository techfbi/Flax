import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Breadcrumbs, SignupCta, SiteShell } from "@/components/public/SiteShell";
import { FoodCard, foodPath } from "@/components/public/FoodCard";
import {
  type PublicFood,
  foodImage,
  formatTag,
  getAllFoods,
  getFood,
  getFoodsByRegion,
  humanList,
  macroSplit,
  perPortion,
  regionDemonym,
  round1,
} from "@/lib/foods";
import { JsonLd, breadcrumbJsonLd, buildMetadata, faqJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

type Params = { region: string; slug: string };

export const generateStaticParams = async (): Promise<Params[]> =>
  (await getAllFoods()).map((f) => ({ region: f.region_slug, slug: f.slug }));

const kcal = (food: PublicFood) => Math.round(food.calories_per_100g);

// First letter only. CSS `capitalize` would turn "1 cup (cooked beans)"
// into "1 Cup (Cooked Beans)".
const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const buildFaqs = (food: PublicFood) => {
  const split = macroSplit(food);
  const servings = food.serving_sizes.slice(0, 2);
  const servingSentence = servings.length
    ? ` ${servings
        // Real labels look like "1 bowl", "1 cup (cooked beans)" or
        // "Medium plate", so they lead the sentence as written.
        .map((s) => `${sentenceCase(s.label)} (${s.grams} g) has about ${perPortion(food, s.grams).calories} kcal.`)
        .join(" ")}`
    : "";

  const faqs = [
    {
      question: `How many calories are in ${food.name}?`,
      answer: `${food.name} has about ${kcal(food)} calories (kcal) per 100 g.${servingSentence}`,
    },
    {
      question: `How much protein, carbs and fat are in ${food.name}?`,
      answer: `Per 100 g, ${food.name} contains ${round1(food.protein_g)} g of protein, ${round1(food.carbs_g)} g of carbohydrates and ${round1(food.fat_g)} g of fat. That means about ${split.carbs}% of its calories come from carbs, ${split.protein}% from protein and ${split.fat}% from fat.`,
    },
  ];

  if (food.ingredients.length > 0) {
    faqs.push({
      question: `What is ${food.name} made of?`,
      answer: `Typical ingredients include ${humanList(food.ingredients)}. Recipes vary from home to home, so the exact nutrition of your plate can differ.`,
    });
  }

  faqs.push({
    question: `How do I track the calories in ${food.name}?`,
    answer: `In Flax, search for ${food.name} in the food catalogue and pick your portion, or snap a photo of your plate and Noura, the AI nutrition assistant, identifies it and estimates the calories and macros for you.`,
  });

  return faqs;
};

const relatedFoods = (food: PublicFood, regionFoods: PublicFood[], limit = 6): PublicFood[] => {
  const tagSet = new Set(food.tags);
  return regionFoods
    .filter((f) => f.slug !== food.slug)
    .map((f) => ({ f, score: f.tags.filter((t) => tagSet.has(t)).length }))
    .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map(({ f }) => f);
};

export const generateMetadata = async ({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> => {
  const { region, slug } = await params;
  const food = await getFood(region, slug);
  if (!food) return { title: "Not found", robots: { index: false } };
  const demonym = regionDemonym(food.region_slug, food.region);
  return buildMetadata({
    title: `${food.name} Calories & Nutrition Facts`,
    description: `${food.name} has ${kcal(food)} calories per 100 g, with ${round1(food.protein_g)} g protein, ${round1(food.carbs_g)} g carbs and ${round1(food.fat_g)} g fat. See calories per serving, ingredients and allergens for this ${demonym} dish.`,
    path: foodPath(food),
    // 1200x630 JPEG, the size and format social and chat apps expect.
    image: { url: foodImage(food.image_url, 1200, 630, "jpg"), width: 1200, height: 630, alt: food.name },
  });
};

const Stat = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
  <div className="bg-surface dark:bg-black-surface rounded-2xl p-4 shadow-sm text-center">
    <dt className="text-xs text-cocoa-faded font-semibold mb-1">{label}</dt>
    <dd className="font-heading font-bold text-xl md:text-2xl text-cocoa dark:text-dark-white">
      {value}
      <span className="text-xs font-semibold text-cocoa-faded ml-1">{unit}</span>
    </dd>
  </div>
);

const FoodPage = async ({ params }: { params: Promise<Params> }) => {
  const { region, slug } = await params;
  const food = await getFood(region, slug);
  if (!food) {
    // A real 404 only when the catalogue loaded and this dish is not in
    // it. An unreachable backend throws inside getAllFoods instead, a
    // temporary error search engines retry, never a "page gone" signal.
    if ((await getAllFoods()).length > 0) notFound();
    throw new Error("Food catalogue unavailable");
  }

  const demonym = regionDemonym(food.region_slug, food.region);
  const split = macroSplit(food);
  const faqs = buildFaqs(food);
  const related = relatedFoods(food, await getFoodsByRegion(food.region_slug));
  const url = absoluteUrl(foodPath(food));
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Foods", path: "/foods" },
    { name: `${demonym} food`, path: `/foods/${food.region_slug}` },
    { name: food.name, path: foodPath(food) },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "MenuItem",
            name: food.name,
            ...(food.regional_names.length ? { alternateName: food.regional_names } : {}),
            description: food.description,
            image: foodImage(food.image_url, 1200, 1200, "jpg"),
            url,
            nutrition: {
              "@type": "NutritionInformation",
              servingSize: "100 g",
              calories: `${kcal(food)} kcal`,
              proteinContent: `${round1(food.protein_g)} g`,
              carbohydrateContent: `${round1(food.carbs_g)} g`,
              fatContent: `${round1(food.fat_g)} g`,
            },
          },
          faqJsonLd(faqs),
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <article>
        <header className="grid md:grid-cols-[1fr_300px] gap-6 md:gap-10 items-start mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-moringa dark:text-moringa-faded mb-2">
              {demonym} food
              {food.meal_types.length > 0 && ` · ${food.meal_types.map((m) => m[0].toUpperCase() + m.slice(1)).join(", ")}`}
            </p>
            <h1 className="font-heading font-bold text-2xl md:text-4xl text-cocoa dark:text-dark-white leading-tight mb-4">
              {food.name}{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">calories &amp; nutrition facts</span>
            </h1>
            <p className="text-sm md:text-base text-cocoa dark:text-dark-white/90 leading-relaxed">
              {food.description}
            </p>
            {food.regional_names.length > 0 && (
              <p className="text-sm text-cocoa-faded mt-3">
                Also known as {humanList(food.regional_names)}.
              </p>
            )}
          </div>
          <img
            src={foodImage(food.image_url, 600)}
            srcSet={`${foodImage(food.image_url, 300)} 300w, ${foodImage(food.image_url, 600)} 600w, ${foodImage(food.image_url, 900)} 900w`}
            sizes="300px"
            alt={`A serving of ${food.name}`}
            width={600}
            height={600}
            fetchPriority="high"
            className="w-full max-w-[300px] aspect-square rounded-2xl object-cover shadow-sm bg-cocoa/5 dark:bg-dark-white/5 mx-auto md:mx-0"
          />
        </header>

        <section aria-labelledby="per-100g" className="mb-10">
          <h2 id="per-100g" className="font-heading font-bold text-lg md:text-xl text-cocoa dark:text-dark-white mb-4">
            {food.name} nutrition per 100 g
          </h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Calories" value={kcal(food)} unit="kcal" />
            <Stat label="Protein" value={round1(food.protein_g)} unit="g" />
            <Stat label="Carbohydrates" value={round1(food.carbs_g)} unit="g" />
            <Stat label="Fat" value={round1(food.fat_g)} unit="g" />
          </dl>
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-cocoa dark:text-dark-white mb-2">Where the calories come from</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-cocoa/10 dark:bg-dark-white/10" aria-hidden="true">
              <div className="bg-pawpaw dark:bg-black-pawpaw" style={{ width: `${split.carbs}%` }} />
              <div className="bg-moringa dark:bg-moringa-faded" style={{ width: `${split.protein}%` }} />
              <div className="bg-[#EAB308]" style={{ width: `${split.fat}%` }} />
            </div>
            <p className="text-xs text-cocoa-faded mt-2">
              {split.carbs}% carbohydrates · {split.protein}% protein · {split.fat}% fat
            </p>
          </div>
        </section>

        {food.serving_sizes.length > 0 && (
          <section aria-labelledby="servings" className="mb-10">
            <h2 id="servings" className="font-heading font-bold text-lg md:text-xl text-cocoa dark:text-dark-white mb-4">
              Calories in {food.name} per serving
            </h2>
            <div className="overflow-x-auto bg-surface dark:bg-black-surface rounded-2xl shadow-sm">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs text-cocoa-faded border-b border-cocoa/10 dark:border-dark-white/10">
                    <th scope="col" className="px-4 py-3 font-semibold">Serving</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Weight</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Calories</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Protein</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Carbs</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Fat</th>
                  </tr>
                </thead>
                <tbody>
                  {food.serving_sizes.map((s) => {
                    const n = perPortion(food, s.grams);
                    return (
                      <tr key={`${s.label}-${s.grams}`} className="border-b last:border-0 border-cocoa/5 dark:border-dark-white/5 text-cocoa dark:text-dark-white">
                        <th scope="row" className="px-4 py-3 font-medium">{sentenceCase(s.label)}</th>
                        <td className="px-4 py-3">{s.grams} g</td>
                        <td className="px-4 py-3 font-semibold">{n.calories} kcal</td>
                        <td className="px-4 py-3">{n.protein_g} g</td>
                        <td className="px-4 py-3">{n.carbs_g} g</td>
                        <td className="px-4 py-3">{n.fat_g} g</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section aria-labelledby="ingredients" className="mb-10 grid md:grid-cols-2 gap-4">
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h2 id="ingredients" className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-3">
              Typical ingredients
            </h2>
            {food.ingredients.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {food.ingredients.map((ing) => (
                  <li key={ing} className="text-xs px-3 py-1 rounded-full bg-off-white dark:bg-dark-bg text-cocoa dark:text-dark-white capitalize">
                    {ing}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cocoa-faded">Ingredients vary by recipe.</p>
            )}
          </div>
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-3">
              Allergens &amp; tags
            </h2>
            <p className="text-sm text-cocoa dark:text-dark-white/90 mb-3">
              {food.allergen_tags.length > 0
                ? `Commonly contains: ${humanList(food.allergen_tags)}.`
                : "No major allergens are tagged for this dish, but recipes vary, always check the ingredients if you have an allergy."}
            </p>
            {food.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {food.tags.map((tag) => (
                  <li key={tag} className="text-xs px-3 py-1 rounded-full bg-moringa-faded/30 text-cocoa dark:text-dark-white capitalize">
                    {formatTag(tag)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="food-faq" className="mb-10">
          <h2 id="food-faq" className="font-heading font-bold text-lg md:text-xl text-cocoa dark:text-dark-white mb-4">
            {food.name}: common questions
          </h2>
          <div className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group bg-surface dark:bg-black-surface rounded-2xl shadow-sm px-5 py-4" open>
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">{faq.question}</h3>
                  <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-cocoa-faded transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-cocoa-faded leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="text-xs text-cocoa-faded leading-relaxed">
          Values are estimates for a typical home recipe of {food.name}. Ingredients, cooking oil and
          portion sizes vary, so your plate can differ. This page is for general information and is
          not medical or dietary advice.
        </p>

        <SignupCta
          title={`Log ${food.name} in seconds`}
          body={`Pick ${food.name} from the Flax catalogue with your real portion size, or snap your plate and let Noura estimate it. Track calories, macros and water against targets built for you. Free.`}
        />

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-12">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 id="related" className="font-heading font-bold text-lg md:text-xl text-cocoa dark:text-dark-white">
                More {demonym} dishes
              </h2>
              <Link href={`/foods/${food.region_slug}`} className="text-xs md:text-sm font-semibold text-moringa dark:text-moringa-faded hover:underline underline-offset-2 shrink-0">
                See all →
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {related.map((f) => (
                <FoodCard key={f.slug} food={f} />
              ))}
            </ul>
          </section>
        )}
      </article>
    </SiteShell>
  );
};

export default FoodPage;
