import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { getLocalDateStr } from "@/lib/date";
import type { ApiResponse, MealLogEntry, MealType } from "@/types/apiTypes";
import { useTheme } from "@/context/ThemeContext";

interface ScannedItem {
  name: string;
  portion_grams: number;
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
}

interface ScanMealTabProps {
  mealType: MealType;
}

const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const fileToBase64 = (
  file: File,
): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, base64] = result.split(",");
      const mimeType = prefix.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const inputClass =
  "bg-surface dark:bg-black-surface border border-cocoa/20 " +
  "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
  "outline-none text-cocoa dark:text-dark-white " +
  "focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50";

export const ScanMealTab = ({ mealType }: ScanMealTabProps) => {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{
    base64: string;
    mimeType: string;
  } | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState(false);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [correctingIndex, setCorrectingIndex] = useState<number | null>(null);
  const [correctionName, setCorrectionName] = useState("");

  const { data: usage } = useQuery({
    queryKey: ["scan-usage"],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{ used: number; remaining: number; limit: number }>
      >("/api/meal-logs/scan-usage");
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileTooLarge(true);
      setPreviewUrl(URL.createObjectURL(file));
      setImageData(null);
      setItems([]);
      return;
    }

    setFileTooLarge(false);
    setItems([]);
    setPreviewUrl(URL.createObjectURL(file));
    setImageData(await fileToBase64(file));
  };

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!imageData) throw new Error("No image selected");
      const { data } = await api.post<ApiResponse<{ items: ScannedItem[] }>>(
        "/api/meal-logs/scan",
        {
          image: imageData.base64,
          mime_type: imageData.mimeType,
          description: description.trim() || undefined,
        },
      );
      return data.data.items;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["scan-usage"] });
      if (result.length === 0) {
        toast.error(
          "Could not identify any food in that photo, try a clearer shot or add a description",
        );
        return;
      }
      setItems(result);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ["scan-usage"] });
      toast.error(getErrorMessage(err, "Could not scan that photo, try again"));
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async ({
      index,
      name,
      grams,
    }: {
      index: number;
      name: string;
      grams: number;
    }) => {
      const { data } = await api.post<
        ApiResponse<{
          estimate: {
            calories: number;
            protein_g: number;
            carbs_g: number;
            fat_g: number;
          };
        }>
      >("/api/meal-logs/estimate", { name, grams });
      return { index, name, estimate: data.data.estimate };
    },
    onSuccess: ({ index, name, estimate }) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                name,
                calories_per_100g: Math.round(
                  (estimate.calories / item.portion_grams) * 100,
                ),
                protein_g:
                  Math.round(
                    (estimate.protein_g / item.portion_grams) * 100 * 10,
                  ) / 10,
                carbs_g:
                  Math.round(
                    (estimate.carbs_g / item.portion_grams) * 100 * 10,
                  ) / 10,
                fat_g:
                  Math.round((estimate.fat_g / item.portion_grams) * 100 * 10) /
                  10,
              }
            : item,
        ),
      );
      setCorrectingIndex(null);
      toast.success("Updated with the corrected name");
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not recalculate, try again")),
  });

  const logItemMutation = useMutation({
    mutationFn: async (item: ScannedItem) => {
      await api.post<ApiResponse<{ log: MealLogEntry }>>("/api/meal-logs", {
        custom_name: item.name,
        quantity_grams: item.portion_grams,
        calories_per_100g: item.calories_per_100g,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        meal_type: mealType,
        logged_date: getLocalDateStr(),
      });
    },
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setItems((prev) => prev.filter((i) => i !== item));
      toast.success(`${item.name} logged`);
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not log this meal")),
  });

  {
    /*// Combines every identified item into one entry, names joined,
  // nutrition summed. Computed entirely here from whatever the items
  // currently look like, corrected names, edited portions, anything
  // the person changed is what gets combined, not the original scan.*/
  }
  const logAllMutation = useMutation({
    mutationFn: async () => {
      const totalGrams = items.reduce((sum, i) => sum + i.portion_grams, 0);
      const totalCalories = items.reduce(
        (sum, i) => sum + (i.calories_per_100g * i.portion_grams) / 100,
        0,
      );
      const totalProtein = items.reduce(
        (sum, i) => sum + (i.protein_g * i.portion_grams) / 100,
        0,
      );
      const totalCarbs = items.reduce(
        (sum, i) => sum + (i.carbs_g * i.portion_grams) / 100,
        0,
      );
      const totalFat = items.reduce(
        (sum, i) => sum + (i.fat_g * i.portion_grams) / 100,
        0,
      );
      const combinedName = items.map((i) => i.name).join(" + ");

      await api.post<ApiResponse<{ log: MealLogEntry }>>("/api/meal-logs", {
        custom_name: combinedName,
        quantity_grams: Math.round(totalGrams),
        calories_per_100g: Math.round((totalCalories / totalGrams) * 100),
        protein_g: Math.round((totalProtein / totalGrams) * 100 * 10) / 10,
        carbs_g: Math.round((totalCarbs / totalGrams) * 100 * 10) / 10,
        fat_g: Math.round((totalFat / totalGrams) * 100 * 10) / 10,
        meal_type: mealType,
        logged_date: getLocalDateStr(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setItems([]);
      toast.success("Logged everything together");
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not log these meals together")),
  });

  const updateItemGrams = (index: number, grams: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, portion_grams: grams } : item,
      ),
    );
  };

  const canRetake = !scanMutation.isPending;

  return (
    <div>
      {usage && (
        <p className="text-[11px] text-cocoa-faded mb-2">
          {usage.remaining} of {usage.limit} scans left today
        </p>
      )}

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={usage?.remaining === 0}
          className="w-full py-8 rounded-2xl border-2 border-dashed border-cocoa/20
            dark:border-dark-white/20 flex flex-col items-center gap-2 text-cocoa-faded
            hover:border-moringa-faded transition-colors disabled:opacity-40 disabled:hover:border-cocoa/20"
        >
          <Camera size={28} />
          <span className="text-sm font-medium">
            {usage?.remaining === 0 ? (
              <p className="text-rose-500">No scans left today</p>
            ) : (
              "Take or upload a photo"
            )}
          </span>
        </button>
      ) : (
        <div className="mb-4">
          <img
            src={previewUrl}
            alt="Selected meal"
            className="w-full max-h-56 object-cover rounded-2xl mb-3"
          />

          {fileTooLarge ? (
            <p className="text-xs text-rose-500 dark:text-rose-700 mb-3">
              Image larger than {MAX_FILE_SIZE_MB}MB, choose a smaller photo
            </p>
          ) : (
            <div className="mb-3">
              <label className="text-xs lg:text-sm font-heading text-cocoa-faded block mb-1">
                Describe it better, optional
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. jollof rice with extra pepper, no plantain"
                maxLength={300}
                rows={2}
                className={`${inputClass} w-full resize-none`}
              />
            </div>
          )}

          {scanMutation.isPending && (
            <p className="text-[11px] text-cocoa-faded mb-2">
              This may take a moment...
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || fileTooLarge}
              className="flex-1 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold disabled:opacity-50
                flex items-center justify-center gap-2"
            >
              {scanMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Scanning...
                </>
              ) : (
                <p className="inline-flex items-center gap-1">
                  <span>Scan with Noura</span>

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={resolvedTheme === "dark" ? "#9CA3AF" : "#E8623C"}
                  >
                    <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
                  </svg>
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                setImageData(null);
                setFileTooLarge(false);
                setDescription("");
                setItems([]);
              }}
              disabled={!canRetake}
              title={
                !canRetake
                  ? "Wait for the current scan to finish first"
                  : undefined
              }
              className="px-4 py-2.5 rounded-xl border border-cocoa/20
                dark:border-dark-white/20 text-sm text-cocoa dark:text-dark-white
                disabled:opacity-40"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="space-y-3 mt-4">
        {items.map((item, index) => {
          const totalCalories = Math.round(
            (item.calories_per_100g * item.portion_grams) / 100,
          );
          const totalProtein =
            Math.round(((item.protein_g * item.portion_grams) / 100) * 10) / 10;
          const totalCarbs =
            Math.round(((item.carbs_g * item.portion_grams) / 100) * 10) / 10;
          const totalFat =
            Math.round(((item.fat_g * item.portion_grams) / 100) * 10) / 10;

          return (
            <div
              key={index}
              className="p-4 rounded-2xl bg-cocoa/5 dark:bg-dark-white/5
                border border-cocoa/10 dark:border-dark-white/10"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                {correctingIndex === index ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={correctionName}
                      onChange={(e) => setCorrectionName(e.target.value)}
                      className={`${inputClass} flex-1`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() =>
                        correctionMutation.mutate({
                          index,
                          name: correctionName.trim(),
                          grams: item.portion_grams,
                        })
                      }
                      disabled={
                        correctionMutation.isPending ||
                        correctionName.trim().length === 0
                      }
                      className="text-xs font-semibold text-moringa
                        dark:text-moringa-faded shrink-0 disabled:opacity-40"
                    >
                      {correctionMutation.isPending ? "..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-cocoa dark:text-dark-white">
                    {item.name}
                  </p>
                )}
                {item.confidence < 0.5 && correctingIndex !== index && (
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full
                    bg-pawpaw/15 text-pawpaw dark:text-black-pawpaw shrink-0"
                  >
                    Double check this
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs lg:text-sm font-heading text-cocoa-faded shrink-0">
                  Portion
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.portion_grams}
                  onChange={(e) =>
                    updateItemGrams(
                      index,
                      parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0,
                    )
                  }
                  className={`${inputClass} w-24`}
                />
                <span className="text-[11px] text-cocoa-faded">g</span>
              </div>

              <p className="text-xs lg:text-sm text-cocoa-faded mb-3">
                {totalCalories} kcal · {totalProtein}g protein · {totalCarbs}g
                carbs · {totalFat}g fat
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => logItemMutation.mutate(item)}
                  disabled={logItemMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-moringa dark:bg-moringa-faded
                    text-surface text-xs font-semibold disabled:opacity-50"
                >
                  Log this
                </button>
                {correctingIndex !== index && (
                  <button
                    type="button"
                    onClick={() => {
                      setCorrectingIndex(index);
                      setCorrectionName(item.name);
                    }}
                    className="px-3 py-2 rounded-lg border border-cocoa/20
                      dark:border-dark-white/20 text-xs text-cocoa dark:text-dark-white"
                  >
                    Not right?
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {items.length > 1 && (
          <button
            type="button"
            onClick={() => logAllMutation.mutate()}
            disabled={logAllMutation.isPending}
            className="w-full py-2.5 rounded-xl border-2 border-moringa
              dark:border-moringa-faded text-moringa dark:text-moringa-faded
              text-sm font-semibold disabled:opacity-50"
          >
            {logAllMutation.isPending
              ? "Logging..."
              : `Log all ${items.length} together`}
          </button>
        )}
      </div>
    </div>
  );
};
