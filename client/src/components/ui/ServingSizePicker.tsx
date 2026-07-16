import { useState, useEffect } from "react";

interface ServingSize {
  label: string;
  grams: number;
}

interface ServingSizePickerProps {
  servingSizes: ServingSize[];
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  onGramsChange: (grams: number) => void;
}

/*
  Lets someone pick a serving in a unit they actually recognize, a
  ball, a cup, a scoop, instead of guessing at grams from scratch.
  A manual grams field is always available too, for anyone who does
  own a scale, it never disappears behind the presets.

  Every number below updates live as the person picks a size or
  changes the quantity, calories_per_100g and friends are already on
  every catalogue food, so this is pure arithmetic, no request needed.
*/
export const ServingSizePicker = ({
  servingSizes,
  caloriesPer100g,
  proteinPer100g,
  carbsPer100g,
  fatPer100g,
  onGramsChange,
}: ServingSizePickerProps) => {
  const hasPresets = servingSizes.length > 0;
  const [selectedIndex, setSelectedIndex] = useState<number | "custom">(
    hasPresets ? 0 : "custom",
  );
  const [quantity, setQuantity] = useState(1);
  const [customGrams, setCustomGrams] = useState("100");

  const totalGrams =
    selectedIndex === "custom"
      ? parseInt(customGrams, 10) || 0
      : (servingSizes[selectedIndex]?.grams ?? 0) * quantity;

  useEffect(() => {
    onGramsChange(totalGrams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalGrams]);

  const scale = totalGrams / 100;
  const calories = Math.round(caloriesPer100g * scale);
  const protein = Math.round(proteinPer100g * scale * 10) / 10;
  const carbs = Math.round(carbsPer100g * scale * 10) / 10;
  const fat = Math.round(fatPer100g * scale * 10) / 10;

  return (
    <div>
      {hasPresets && (
        <div className="flex flex-wrap gap-2 mb-3">
          {servingSizes.map((size, i) => (
            <button
              key={size.label}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedIndex === i
                  ? "bg-moringa dark:bg-moringa-faded text-surface border-transparent"
                  : "border-cocoa/15 dark:border-dark-white/15 text-cocoa dark:text-dark-white"
              }`}
            >
              {size.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedIndex("custom")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedIndex === "custom"
                ? "bg-moringa dark:bg-moringa-faded text-surface border-transparent"
                : "border-cocoa/15 dark:border-dark-white/15 text-cocoa dark:text-dark-white"
            }`}
          >
            Custom grams
          </button>
        </div>
      )}

      {selectedIndex === "custom" ? (
        <div className="mb-3">
          <label className="text-xs md:text-sm font-heading text-cocoa-faded block mb-1">
            Quantity (g)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={customGrams}
            onChange={(e) =>
              setCustomGrams(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="w-full bg-surface dark:bg-black-surface border border-cocoa/20
              dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm
              outline-none text-cocoa dark:text-dark-white
              focus:border-pawpaw dark:focus:border-black-pawpaw"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs md:text-sm font-heading text-cocoa-faded">
            Quantity
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-7 h-7 rounded-full border border-cocoa/20 dark:border-dark-white/20
              text-cocoa dark:text-dark-white flex items-center justify-center"
          >
            −
          </button>
          <span className="text-sm font-medium text-cocoa dark:text-dark-white w-4 text-center">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="w-7 h-7 rounded-full border border-cocoa/20 dark:border-dark-white/20
              text-cocoa dark:text-dark-white flex items-center justify-center"
          >
            +
          </button>
          <span className="text-xs text-cocoa-faded">≈ {totalGrams}g</span>
        </div>
      )}

      <div className="flex gap-4 text-xs text-cocoa-faded">
        <span>{calories} kcal</span>
        <span>{protein}g protein</span>
        <span>{carbs}g carbs</span>
        <span>{fat}g fat</span>
      </div>
    </div>
  );
};
