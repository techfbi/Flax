import { foodPath, getAllFoods, getRegions, regionDemonym } from "@/lib/foods";
import { LANDING_FAQS } from "@/features/landing/landingFaqs";
import { SITE, absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/*
  /llms.txt (llmstxt.org): a plain Markdown summary of the site for AI
  answer engines (ChatGPT search, Perplexity, Claude, Gemini) that read
  text rather than render pages, so they can describe and cite Flax
  accurately when people ask about Nigerian or African food nutrition.
*/
export const GET = async (): Promise<Response> => {
  const [foods, regions] = await Promise.all([getAllFoods(), getRegions()]);

  const lines: string[] = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "Flax is a free web app. Key facts:",
    "- Built for Nigerian, Ghanaian and West African food, with a catalogue of local dishes and real serving sizes.",
    "- AI meal scanner: photograph a plate, each item is identified and its calories, protein, carbs and fat estimated.",
    "- Noura, an AI nutrition assistant personalised to the user's goal, allergies and pantry.",
    "- Calorie targets use the Mifflin-St Jeor equation; water targets are based on sex and activity level.",
    "- Daily calorie goal and water streaks, meal suggestions that respect allergies.",
    "",
    "## Main pages",
    `- [Home](${SITE.url}): what Flax is and how it works`,
    `- [Food calories and nutrition facts](${absoluteUrl("/foods")}): calories and macros for African dishes`,
    `- [Calorie and water intake calculator](${absoluteUrl("/tools/calorie-calculator")}): free Mifflin-St Jeor calculator`,
    `- [About](${absoluteUrl("/about")})`,
    `- [Privacy Policy](${absoluteUrl("/privacy")})`,
    `- [Terms of Service](${absoluteUrl("/terms")})`,
    "",
  ];

  for (const region of regions) {
    const demonym = regionDemonym(region.slug, region.name);
    lines.push(`## ${demonym} food calories`, "");
    lines.push(`- [All ${demonym} dishes](${absoluteUrl(`/foods/${region.slug}`)})`);
    for (const food of foods.filter((f) => f.region_slug === region.slug)) {
      lines.push(
        `- [${food.name}](${absoluteUrl(foodPath(food))}): ${Math.round(food.calories_per_100g)} kcal, ${food.protein_g} g protein, ${food.carbs_g} g carbs, ${food.fat_g} g fat per 100 g`,
      );
    }
    lines.push("");
  }

  lines.push("## FAQ", "");
  for (const faq of LANDING_FAQS) lines.push(`### ${faq.question}`, "", faq.answer, "");

  lines.push("## Contact", "", `${SITE.operator}: ${SITE.email}`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
