import Link from "next/link";
import type { PublicFood } from "@/lib/foods";
import { foodImage, foodPath, round1 } from "@/lib/foods";

export { foodPath };

export const FoodCard = ({ food }: { food: PublicFood }) => (
  <li>
    <Link
      href={foodPath(food)}
      className="group flex gap-4 items-center bg-surface dark:bg-black-surface rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow h-full"
    >
      <img
        src={foodImage(food.image_url, 144)}
        srcSet={`${foodImage(food.image_url, 72)} 1x, ${foodImage(food.image_url, 144)} 2x, ${foodImage(food.image_url, 216)} 3x`}
        alt={food.name}
        width={72}
        height={72}
        loading="lazy"
        decoding="async"
        className="w-[72px] h-[72px] rounded-xl object-cover shrink-0 bg-cocoa/5 dark:bg-dark-white/5"
      />
      <div className="min-w-0">
        <h3 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white group-hover:text-moringa dark:group-hover:text-moringa-faded transition-colors">
          {food.name}
        </h3>
        <p className="text-xs text-pawpaw dark:text-black-pawpaw font-semibold mt-0.5">
          {Math.round(food.calories_per_100g)} kcal per 100 g
        </p>
        <p className="text-[11px] text-cocoa-faded mt-0.5">
          P {round1(food.protein_g)} g · C {round1(food.carbs_g)} g · F {round1(food.fat_g)} g
        </p>
      </div>
    </Link>
  </li>
);
