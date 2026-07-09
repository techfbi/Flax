import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WaterLogList } from "./WaterLogList";
import api from "@/lib/api";
import type { ApiResponse, WaterData } from "@/types/apiTypes";

interface LogWaterPanelProps {
  waterData: WaterData | undefined;
  onRefetch: () => void;
}

/*
  Log water side of the Log intake tab.
  Quick add buttons, a manual ml input, and today's logged cups.
  This is the action focused twin of HydrationSection, which stays on
  the Goal tab as the at a glance overview with the donut chart.
*/

const sanitizeMl = (raw: string): string => {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly === "") return "";
  return digitsOnly.replace(/^0+(?=\d)/, "");
};

export const LogWaterPanel = ({ waterData, onRefetch }: LogWaterPanelProps) => {
  const queryClient = useQueryClient();
  const [mlInput, setMlInput] = useState("");

  const dailyTotal = waterData?.daily_total ?? 0;
  const targetMl = waterData?.target_ml ?? 2500;
  const remaining = Math.max(0, targetMl - dailyTotal);

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
    onError: () => toast.error("Could not log water. Try again."),
  });

  const handleAdd = () => {
    const n = parseInt(mlInput, 10) || 0;
    if (n < 50 || n > 2000) {
      toast.error("Enter a value between 50 and 2000 ml");
      return;
    }
    logWater.mutate(n);
  };

  return (
    <div className="p-5">
      <p className="text-xs text-cocoa-faded mb-4">
        {remaining > 0
          ? `${remaining}ml left to reach your ${targetMl.toLocaleString()}ml target today`
          : "Target hit for today"}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "+ 500ml", ml: 500 },
          { label: "+ 1 Glass 250ml", ml: 250 },
          { label: "+ 1/2 Glass 125ml", ml: 125 },
        ].map((opt) => (
          <button
            key={opt.ml}
            onClick={() => logWater.mutate(opt.ml)}
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

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div
          className="flex-1 flex items-center gap-2 bg-surface dark:bg-black-surface
          border border-cocoa/15 dark:border-dark-white/15 rounded-xl px-3 py-2.5 min-w-[140px]"
        >
          <input
            type="text"
            inputMode="numeric"
            value={mlInput}
            onChange={(e) => setMlInput(sanitizeMl(e.target.value))}
            onFocus={(e) => e.target.select()}
            placeholder="Amount"
            className="flex-1 bg-transparent outline-none text-base lg:text-sm
              text-cocoa dark:text-dark-white"
          />
          <span className="text-xs text-cocoa-faded shrink-0">ml</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={logWater.isPending}
          className="px-4 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
            text-surface text-sm font-semibold hover:opacity-90
            transition-opacity disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <p className="text-xs font-semibold text-cocoa dark:text-dark-white mb-1">
        Today
      </p>
      {waterData && waterData.logs.length > 0 ? (
        <WaterLogList logs={waterData.logs} />
      ) : (
        <p className="text-xs text-cocoa-faded">No water logged yet today</p>
      )}
    </div>
  );
};
