import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, SignupCta, SiteShell } from "@/components/public/SiteShell";
import { PageHeader, Prose } from "@/components/public/Prose";
import { JsonLd, breadcrumbJsonLd, buildMetadata, organizationJsonLd } from "@/lib/seo";
import { SITE, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "About Flax — Nutrition Tracking Built for African Food",
  absoluteTitle: true,
  description:
    "Flax is an AI nutrition and hydration tracker built for the way people in Nigeria and West Africa actually eat. Learn what Flax does, how Noura works and who builds it.",
  path: "/about",
});

const AboutPage = () => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          organizationJsonLd(),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "About Flax",
            url: absoluteUrl("/about"),
            about: { "@id": `${SITE.url}/#organization` },
          },
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <PageHeader
        title={
          <>
            Nutrition tracking that{" "}
            <span className="text-pawpaw dark:text-black-pawpaw">speaks your food</span>
          </>
        }
        lead="Flax is an AI nutrition and hydration tracker built for the way people in Nigeria and West Africa actually eat."
      />

      <Prose>
        <h2>Why Flax exists</h2>
        <p>
          Most calorie trackers are built around packaged foods and Western recipes. Try logging a
          wrap of eba with egusi soup, a plate of jollof rice from a party, or a bowl of nkwobi and
          you are left guessing. Most nutrition advice also ignores the habits people actually
          struggle with: losing track of what they eat and forgetting to drink water.
        </p>
        <p>
          Flax was built to fix that. It knows local dishes, it understands real portions like a
          scoop, a cup or a medium ball of swallow, and it helps you build the consistency that
          actually changes things, meal by meal and glass by glass, without giving up the food
          you grew up with.
        </p>

        <h2>What Flax does</h2>
        <ul>
          <li>
            <strong>Personal targets.</strong> Your daily calorie target is calculated from your
            age, height, weight, activity level and goal with the Mifflin-St Jeor equation, and
            your water target from your sex and activity level. Try it with the{" "}
            <Link href="/tools/calorie-calculator">free calorie calculator</Link>.
          </li>
          <li>
            <strong>Meal logging that fits African food.</strong> Pick from a catalogue of{" "}
            <Link href="/foods/nigeria">Nigerian</Link>, <Link href="/foods/ghana">Ghanaian</Link>{" "}
            and other dishes with real serving sizes, enter your own meal, or let Noura estimate it.
          </li>
          <li>
            <strong>Water tracking.</strong> Quick add glasses through the day and see how close
            you are to your hydration target.
          </li>
          <li>
            <strong>Streaks.</strong> A calorie goal streak and a water streak, each counts once you
            reach 80% of the day&apos;s target, consistency over perfection.
          </li>
          <li>
            <strong>Meal suggestions.</strong> Out of ideas? Spin for a meal that fits your goal,
            avoids your allergens and uses what is already in your kitchen.
          </li>
        </ul>

        <h2>Meet Noura</h2>
        <p>
          Noura, from &ldquo;nourish&rdquo; and &ldquo;aura&rdquo;, is the AI nutrition assistant
          inside Flax. Noura can scan a photo of your plate and estimate each item on it, estimate
          the nutrition of homemade or regional dishes from a short description, answer food
          questions with your goal, allergies and pantry in mind, and explain why a suggested meal
          fits you.
        </p>

        <h2>How our nutrition numbers work</h2>
        <p>
          Values in the <Link href="/foods">Flax food catalogue</Link> are per 100 g estimates for a
          typical home recipe of each dish. AI estimates from Noura are exactly that, estimates,
          and you can always review and edit them before anything is logged. Home cooking varies a
          lot, especially with oil and portion sizes, so treat every number as a well informed
          guide rather than a lab measurement.
        </p>
        <p>
          Flax is a wellness tool, not a medical service. It does not diagnose or treat any
          condition. If you have a health condition, are pregnant, or are planning a big change to
          your diet, please speak to a qualified health professional.
        </p>

        <h2>Who builds Flax</h2>
        <p>
          Flax is built and operated by {SITE.operator}, founded by {SITE.founder.name}. You can
          reach the team at <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
        <p>
          Read how we handle your data in the <Link href="/privacy">Privacy Policy</Link> and the
          rules for using Flax in the <Link href="/terms">Terms of Service</Link>.
        </p>
      </Prose>

      <SignupCta />
    </SiteShell>
  );
};

export default AboutPage;
