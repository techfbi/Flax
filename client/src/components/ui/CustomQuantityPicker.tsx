import { useState, useEffect } from "react";

const UNIT_OPTIONS = [
  { label: "Grams (exact)", isGrams: true },
  { label: "small ball", isGrams: false },
  { label: "medium ball", isGrams: false },
  { label: "large ball", isGrams: false },
  { label: "wrap", isGrams: false },
  { label: "scoop", isGrams: false },
  { label: "cup", isGrams: false },
  { label: "tablespoon", isGrams: false },
  { label: "handful", isGrams: false },
  { label: "half plate", isGrams: false },
  { label: "full plate", isGrams: false },
] as const;

interface CustomQuantityPickerProps {
  onQuantityChange: (
    result: { grams: number } | { description: string },
  ) => void;
}

/*
  For a custom meal there is no catalogue entry to calculate against,
  so this covers every common way someone might describe a portion,
  not tied to any one food. If an exact gram amount is picked, that
  is sent straight through. Otherwise a description like "2 scoops"
  is sent instead, and the AI itself works out a realistic gram
  equivalent for that specific food, since a scoop of eba and a scoop
  of soup do not weigh anything close to the same.
*/
export const CustomQuantityPicker = ({
  onQuantityChange,
}: CustomQuantityPickerProps) => {
  const [unitIndex, setUnitIndex] = useState(0);
  const [count, setCount] = useState(1);
  const [gramsInput, setGramsInput] = useState("100");

  const unit = UNIT_OPTIONS[unitIndex];

  useEffect(() => {
    if (unit.isGrams) {
      onQuantityChange({ grams: parseInt(gramsInput, 10) || 0 });
    } else {
      onQuantityChange({
        description: `${count} ${unit.label}${count > 1 ? "s" : ""}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitIndex, count, gramsInput]);

  const selectClass =
    "w-full bg-surface dark:bg-black-surface border border-cocoa/20 " +
    "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
    "outline-none text-cocoa dark:text-dark-white " +
    "focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50";

  return (
    <div>
      <label className="text-xs md:text-sm font-heading text-cocoa-faded block mb-1">
        Quantity
      </label>
      <select
        value={unitIndex}
        onChange={(e) => setUnitIndex(Number(e.target.value))}
        className={selectClass}
      >
        {UNIT_OPTIONS.map((u, i) => (
          <option key={u.label} value={i}>
            {u.isGrams ? u.label : `By ${u.label}`}
          </option>
        ))}
      </select>

      {unit.isGrams ? (
        <input
          type="text"
          inputMode="numeric"
          value={gramsInput}
          onChange={(e) => setGramsInput(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="100"
          className={`${selectClass} mt-2`}
        />
      ) : (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="w-7 h-7 rounded-full border border-cocoa/20 dark:border-dark-white/20
              text-cocoa dark:text-dark-white flex items-center justify-center shrink-0"
          >
            −
          </button>
          <span className="text-sm font-medium text-cocoa dark:text-dark-white w-4 text-center">
            {count}
          </span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(20, c + 1))}
            className="w-7 h-7 rounded-full border border-cocoa/20 dark:border-dark-white/20
              text-cocoa dark:text-dark-white flex items-center justify-center shrink-0"
          >
            +
          </button>
          <span className="text-xs text-cocoa-faded">
            {count} {unit.label}
            {count > 1 ? "s" : ""}, ask Noura to convert this to grams below
          </span>
        </div>
      )}
    </div>
  );
};
