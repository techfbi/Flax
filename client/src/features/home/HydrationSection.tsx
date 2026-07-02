import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";
import type { WaterData } from "@/types/apiTypes";
import type { ApiResponse } from "@/types/apiTypes";

interface HydrationSectionProps {
  waterData: WaterData | undefined;
  onRefetch: () => void;
}

/*
  Hydration section inside the Goal tab.
  Shows donut chart (progress), today target, remaining, tips.
  Log water intake box with quick-add buttons and manual input.

  Donut: moringa fill (light) / moringa-faded (dark). Grey track.
  Center: "[remaining]ml remaining" or "Target hit!" if done.

  Excess: if dailyTotal > targetMl, shows "Excess: Xml" below target.
  This is pure frontend calculation. No backend table needed.
*/
export const HydrationSection = ({
  waterData,
  onRefetch,
}: HydrationSectionProps) => {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const [mlInput, setMlInput] = useState("");

  const dailyTotal = waterData?.daily_total ?? 0;
  const targetMl = waterData?.target_ml ?? 2500;
  const remaining = Math.max(0, targetMl - dailyTotal);
  const excess = dailyTotal > targetMl ? dailyTotal - targetMl : 0;
  const pct = Math.min(100, Math.round((dailyTotal / targetMl) * 100));

  const fillColor = resolvedTheme === "dark" ? "#7FB096" : "#2F5D4B";
  const trackColor =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const pieData = [{ value: pct }, { value: 100 - pct }];

  const logWater = useMutation({
    mutationFn: async (amount: number) => {
      const { data } = await api.post<ApiResponse<unknown>>("/api/water", {
        amount_ml: amount,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["water"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      onRefetch();
      toast.success("Water logged");
      setMlInput("");
    },
    onError: () => {
      toast.error("Could not log water. Try again.");
    },
  });

  const handleAdd = () => {
    const n = parseInt(mlInput);
    if (isNaN(n) || n < 50 || n > 2000) {
      toast.error("Enter a value between 50 and 2000 ml");
      return;
    }
    logWater.mutate(n);
  };

  const quickAdd = (ml: number) => logWater.mutate(ml);

  return (
    <div>
      <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-1">
        Hydration
      </h2>

      <p className="text-sm text-cocoa dark:text-dark-white mb-0.5">
        Today's Target:{" "}
        <span className="font-bold">{targetMl.toLocaleString()} ml</span>
      </p>

      {excess > 0 && (
        <span
          className="inline-block text-xs font-semibold text-pawpaw
          dark:text-black-pawpaw bg-pawpaw/10 px-2 py-0.5 rounded-full mb-2"
        >
          Excess: {excess}ml
        </span>
      )}

      {/* Desktop: donut left + log water right */}
      {/* Mobile: target + tips left + donut right, log water below */}
      <div className="flex flex-col md:flex-row gap-5 mt-3">
        {/* Left: donut + tips */}
        <div className="flex flex-row md:flex-col items-start gap-5 md:gap-4">
          {/* Tips — outside the log water box */}
          <div className="flex-1 md:flex-none">
            <p className="text-xs font-semibold text-cocoa dark:text-dark-white mb-1">
              Tips
            </p>
            <ul className="text-xs text-cocoa-faded space-y-0.5">
              <li className="flex gap-1.5">
                <span>•</span>
                <span>1 sachet / small bottle of water is 500 ml</span>
              </li>
              <li className="flex gap-1.5">
                <span>•</span>
                <span>1 cup / 1 standard cup of water is 250ml</span>
              </li>
            </ul>
          </div>

          {/* Donut chart */}
          <div className="relative w-36 h-36 shrink-0 md:self-start self-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={64}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill={fillColor} />
                  <Cell fill={trackColor} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-bold text-sm text-cocoa dark:text-dark-white leading-tight">
                {remaining > 0 ? `${remaining}ml` : "0ml"}
              </p>
              <p className="text-[10px] text-cocoa-faded">
                {remaining > 0 ? "remaining" : "target hit!"}
              </p>
            </div>
          </div>
        </div>

        {/* Log water intake box */}
        <div
          className="flex-1 rounded-2xl p-4
          bg-off-white dark:bg-dark-bg"
        >
          <p className="text-sm font-semibold text-cocoa dark:text-dark-white mb-3">
            Log water intake
          </p>

          {/* Quick add */}
          <p className="text-[11px] text-cocoa-faded mb-2">Quick add</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { label: "+ 500ml", ml: 500 },
              { label: "+ 1 Glass 250ml", ml: 250 },
              { label: "+ 1/2 Glass 125ml", ml: 125 },
            ].map((opt) => (
              <button
                key={opt.ml}
                onClick={() => quickAdd(opt.ml)}
                disabled={logWater.isPending}
                className="px-3 py-1.5 rounded-full border border-cocoa/20
                  dark:border-dark-white/20 text-xs font-medium
                  text-cocoa dark:text-dark-white
                  hover:bg-cocoa/5 dark:hover:bg-dark-white/5
                  disabled:opacity-50 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Manual input */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2
              bg-surface dark:bg-black-surface
              border border-cocoa/15 dark:border-dark-white/15
              rounded-xl px-3 py-2.5"
            >
              <input
                type="number"
                value={mlInput}
                onChange={(e) => setMlInput(e.target.value)}
                placeholder=""
                className="flex-1 bg-transparent outline-none text-sm
                  text-cocoa dark:text-dark-white
                  [appearance:textfield]
                  [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-cocoa-faded shrink-0">ml</span>
            </div>
            <button
              onClick={handleAdd}
              disabled={logWater.isPending}
              className="px-4 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold
                hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
