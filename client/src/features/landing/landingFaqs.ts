/*
  Landing page FAQ. Rendered visibly on the page and emitted as FAQPage
  JSON-LD from the same data, search engines require structured data to
  match visible content, a single source keeps them identical.

  Every answer describes what the app actually does today. Update the
  answers if a feature changes (e.g. the daily scan limit in
  server/src/modules/meal-log/scanUsage.service.ts).
*/
export interface LandingFaq {
  question: string;
  answer: string;
}

export const LANDING_FAQS: LandingFaq[] = [
  {
    question: "What is Flax?",
    answer:
      "Flax is a free AI nutrition and hydration tracker built for Nigerian and West African food. You log meals and water, track calories, protein, carbs and fat against targets calculated for your body, build daily streaks, and get guidance from Noura, the AI nutrition assistant built into the app.",
  },
  {
    question: "Does Flax work with Nigerian and West African dishes?",
    answer:
      "Yes, that is what it is built for. The food catalogue covers everyday Nigerian and Ghanaian dishes like jollof rice, egusi soup, amala, pounded yam, moi moi and waakye, with real serving sizes such as a cup, a scoop or a medium ball, not just grams. For anything not in the catalogue, homemade and regional dishes included, Noura estimates the nutrition from the meal name and a description of your portion.",
  },
  {
    question: "How does the AI meal scanner work?",
    answer:
      "Take or upload a photo of your plate and optionally add a short description. Noura identifies each item on the plate separately, for example rice, stew and chicken, and estimates the portion size, calories, protein, carbs and fat for each one. You review and adjust the results before anything is logged. You get 3 meal scans per day.",
  },
  {
    question: "How does Flax calculate my calorie and water targets?",
    answer:
      "Your calorie target uses the Mifflin-St Jeor equation, based on your sex, age, height, weight and activity level, then adjusted for your goal, for example 500 kcal below maintenance for weight loss. Your water target is based on your sex and activity level. You can override either target at any time, and you can try the same calculation with the free Flax calorie calculator.",
  },
  {
    question: "What is Noura?",
    answer:
      "Noura is the AI nutrition assistant inside Flax. It knows your health goal, dietary style, allergies and pantry items, so it can answer food questions about you specifically, suggest realistic meals that respect your allergies, explain why a suggested meal fits your goal, scan your plate, and estimate dishes that are not in any database.",
  },
  {
    question: "Is Flax free?",
    answer:
      "Yes. Creating an account and using Flax, including Noura, meal logging, water tracking and streaks, is free.",
  },
  {
    question: "Is my data sold or used for advertising?",
    answer:
      "No. Flax never sells your data and does not use it for advertising. It is only processed by the service providers needed to run the app, such as hosting and the AI models behind Noura. The Privacy Policy explains exactly what is collected and why.",
  },
  {
    question: "Is Flax a substitute for a doctor or dietitian?",
    answer:
      "No. Flax helps you build healthy, consistent eating and hydration habits, but it does not give medical advice. If you have a medical condition, are pregnant, or are planning a big change to your diet, talk to a qualified health professional.",
  },
];
