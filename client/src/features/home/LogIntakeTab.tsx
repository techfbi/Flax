import { useState } from "react";
import { LogMealTab } from "./LogMealTab";
import { LogWaterPanel } from "./LogWaterPanel";
import type { WaterData } from "@/types/apiTypes";
import { SlidingTabs } from "@/components/ui/SlidingTabs";

interface LogIntakeTabProps {
  waterData: WaterData | undefined;
  onRefetchWater: () => void;
}

type IntakeMode = "meal" | "water";

/*
  Log intake tab. One pill switch between logging a meal and logging
  water, both writing to the same day. Meal takes priority visually
  since it is the more common action, but either can be reached in one
  tap.
*/
export const LogIntakeTab = ({
  waterData,
  onRefetchWater,
}: LogIntakeTabProps) => {
  const [mode, setMode] = useState<IntakeMode>("meal");

  return (
    <div>
      <div className="px-5 pt-5">
        <SlidingTabs
          tabs={[
            { key: "meal" as const, label: "Log meal" },
            { key: "water" as const, label: "Log water" },
          ]}
          active={mode}
          onChange={setMode}
          fitWidth
        />
      </div>

      {mode === "meal" ? (
        <LogMealTab />
      ) : (
        <LogWaterPanel waterData={waterData} onRefetch={onRefetchWater} />
      )}
    </div>
  );
};
