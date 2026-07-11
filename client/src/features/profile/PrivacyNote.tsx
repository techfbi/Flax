import { useState } from "react";

/*
  Short reassurance line under the identity card. Health data (weight,
  height, age, goals) is only ever used to calculate BMI and calorie
  and water targets. Nothing is shared with third parties. Collapsed
  to two lines by default since the full text is a bit long for a
  card this size, expands on tap.
*/
export const PrivacyNote = () => {
  const [expanded, setExpanded] = useState(false);

  const text =
    "We use your health details, like weight, height, and goals, only " +
    "to calculate things like your BMI and your daily calorie and " +
    "water targets. We never sell or share this information with " +
    "third parties.";

  return (
    <p className="text-[11px] text-cocoa-faded leading-relaxed px-1">
      {expanded ? text : `${text.slice(0, 90)}...`}{" "}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-cocoa dark:text-dark-white underline decoration-dotted"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </p>
  );
};
