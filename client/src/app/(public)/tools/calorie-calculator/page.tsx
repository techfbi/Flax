import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Breadcrumbs, SignupCta, SiteShell } from "@/components/public/SiteShell";
import { CalorieCalculator } from "@/features/tools/CalorieCalculator";
import {
  ACTIVITY_MULTIPLIERS,
  ACTIVITY_OPTIONS,
  GOAL_ADJUSTMENTS,
  GOAL_OPTIONS,
  WATER_ACTIVITY_ADDITIONS,
  WATER_BASE_ML,
} from "@/lib/calculations";
import { JsonLd, breadcrumbJsonLd, buildMetadata, faqJsonLd } from "@/lib/seo";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/tools/calorie-calculator";

export const metadata: Metadata = buildMetadata({
  title: "Calorie & Water Intake Calculator (Free, Mifflin-St Jeor)",
  description:
    "Free daily calorie and water intake calculator. Get your calorie target for weight loss, muscle gain or maintenance with the Mifflin-St Jeor equation, plus a personalised daily water target.",
  path: PATH,
});

const FAQS = [
  {
    question: "How many calories should I eat a day?",
    answer:
      "It depends on your sex, age, height, weight, activity level and goal. This calculator estimates your basal metabolic rate with the Mifflin-St Jeor equation, multiplies it by an activity factor to get your maintenance calories, then adjusts for your goal, for example 500 kcal less per day to lose weight.",
  },
  {
    question: "How much water should I drink a day?",
    answer:
      "Flax sets a base of 3.0 litres a day for men and 2.2 litres for women, then adds between 300 ml and 1 litre depending on how active you are. Hot weather, illness and pregnancy can raise your needs, so treat the number as a starting point.",
  },
  {
    question: "What is the Mifflin-St Jeor equation?",
    answer:
      "It is a widely used formula for estimating basal metabolic rate, the calories your body burns at rest. For men it is 10 × weight in kg + 6.25 × height in cm − 5 × age + 5, and for women the same with −161 instead of +5. It is generally considered more accurate for most adults than the older Harris-Benedict equation.",
  },
  {
    question: "Is a 500 calorie deficit safe for weight loss?",
    answer:
      "For most healthy adults a deficit of around 500 kcal a day is a common, moderate starting point. It is not right for everyone, if you are pregnant, breastfeeding, under 18, have a medical condition or a history of disordered eating, speak to a doctor or registered dietitian before changing how much you eat.",
  },
];

const goalLabel = Object.fromEntries(GOAL_OPTIONS.map((g) => [g.value, g.label]));

const CalculatorPage = () => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Calorie calculator", path: PATH },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Flax Calorie & Water Intake Calculator",
            url: absoluteUrl(PATH),
            applicationCategory: "HealthApplication",
            operatingSystem: "Web",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "Calculates a daily calorie target with the Mifflin-St Jeor equation and a daily water target from sex and activity level.",
            publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
          },
          faqJsonLd(FAQS),
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <header className="mb-8">
        <h1 className="font-heading font-bold text-2xl md:text-4xl text-cocoa dark:text-dark-white leading-tight mb-4">
          Calorie &amp; water intake{" "}
          <span className="text-pawpaw dark:text-black-pawpaw">calculator</span>
        </h1>
        <p className="text-sm md:text-base text-cocoa dark:text-dark-white/90 leading-relaxed max-w-3xl">
          Find out how many calories and how much water you need each day, for losing weight,
          gaining muscle or staying where you are. It is the exact calculation Flax uses to set your
          targets when you sign up.
        </p>
      </header>

      <CalorieCalculator />

      <section className="mt-14" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="font-heading font-bold text-lg md:text-2xl text-cocoa dark:text-dark-white mb-4">
          How the calculation works
        </h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-cocoa dark:text-dark-white/90 leading-relaxed">
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h3 className="font-heading font-bold text-base mb-2">1. Basal metabolic rate</h3>
            <p className="mb-2">
              Your BMR is estimated with the Mifflin-St Jeor equation:
            </p>
            <p className="text-xs bg-off-white dark:bg-dark-bg rounded-lg p-3 font-mono leading-relaxed">
              Men: 10 × kg + 6.25 × cm − 5 × age + 5
              <br />
              Women: 10 × kg + 6.25 × cm − 5 × age − 161
            </p>
          </div>
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h3 className="font-heading font-bold text-base mb-2">2. Activity level</h3>
            <p className="mb-2">BMR is multiplied by your activity factor to get maintenance calories:</p>
            <ul className="text-xs space-y-1">
              {ACTIVITY_OPTIONS.map((o) => (
                <li key={o.value} className="flex justify-between gap-3">
                  <span>{o.label}</span>
                  <span className="font-semibold">× {ACTIVITY_MULTIPLIERS[o.value]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h3 className="font-heading font-bold text-base mb-2">3. Your goal</h3>
            <p className="mb-2">Maintenance is adjusted for your goal and rounded to the nearest 50 kcal:</p>
            <ul className="text-xs space-y-1">
              {Object.entries(GOAL_ADJUSTMENTS).map(([goal, adj]) => (
                <li key={goal} className="flex justify-between gap-3">
                  <span>{goalLabel[goal]}</span>
                  <span className="font-semibold">{adj > 0 ? `+${adj}` : adj === 0 ? "±0" : adj} kcal</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface dark:bg-black-surface rounded-2xl p-5 shadow-sm">
            <h3 className="font-heading font-bold text-base mb-2">4. Water target</h3>
            <p className="mb-2">
              A base of {WATER_BASE_ML.male / 1000} L for men and {WATER_BASE_ML.female / 1000} L for
              women, plus extra for activity:
            </p>
            <ul className="text-xs space-y-1">
              {ACTIVITY_OPTIONS.map((o) => (
                <li key={o.value} className="flex justify-between gap-3">
                  <span>{o.label}</span>
                  <span className="font-semibold">+{WATER_ACTIVITY_ADDITIONS[o.value]} ml</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="calc-faq">
        <h2 id="calc-faq" className="font-heading font-bold text-lg md:text-2xl text-cocoa dark:text-dark-white mb-4">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group bg-surface dark:bg-black-surface rounded-2xl shadow-sm px-5 py-4">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <h3 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">{faq.question}</h3>
                <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-cocoa-faded transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-cocoa-faded leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-xs text-cocoa-faded leading-relaxed mt-8">
        These numbers are estimates for healthy adults and are not medical advice. To see how your
        favourite dishes fit your target, check the{" "}
        <Link href="/foods/nigeria" className="underline underline-offset-2">
          Nigerian food calorie list
        </Link>
        .
      </p>

      <SignupCta
        title="Hit these targets every day"
        body="Flax sets these targets for you automatically, then helps you hit them: log local dishes in seconds, scan your plate with Noura, track water and build streaks. Free."
      />
    </SiteShell>
  );
};

export default CalculatorPage;
