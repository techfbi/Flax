import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { StreakPanel } from "@/features/home/StreakPanel";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  ApiResponse,
  FullProfile,
  DashboardData,
  WaterData,
  StreakData,
  DietaryStyle,
  HealthGoal,
  BiologicalSex,
  ActivityLevel,
} from "@/types/apiTypes";

/*
  Profile page. Who the user is and what Flax knows about their health,
  in one place, editable in it. Account security (password, delete
  account) and app preferences (theme, notifications) live in Settings
  instead, that split is the familiar one, profile is identity, settings
  is configuration.

  Calorie and water panel stays on the right on desktop, same component
  and same data every other page with it uses, hidden on tablet and
  mobile where the main content needs the width instead.
*/

const DIETARY_STYLES: DietaryStyle[] = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "paleo",
  "halal",
  "kosher",
];
const HEALTH_GOALS: HealthGoal[] = [
  "weight_loss",
  "muscle_gain",
  "weight_gain",
  "maintenance",
  "general_health",
];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extremely_active",
];

const labelize = (value: string) =>
  value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const inputClass =
  "w-full bg-surface dark:bg-black-surface border border-cocoa/20 " +
  "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
  "outline-none text-cocoa dark:text-dark-white " +
  "focus:border-pawpaw dark:focus:border-black-pawpaw";

const sanitizeNumber = (raw: string): string => {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly === "") return "";
  return digitsOnly.replace(/^0+(?=\d)/, "");
};

export const ProfilePage = () => {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useUserProfile();
  const { setUser, user, setAvatarUrl, avatarUrl } = useAuthStore();

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ dashboard: DashboardData }>>(
        "/api/meal-logs/dashboard",
      );
      return data.data.dashboard;
    },
    staleTime: 60 * 1000,
  });
  const { data: waterData } = useQuery({
    queryKey: ["water", "today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await api.get<ApiResponse<WaterData>>(
        `/api/water?date=${today}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
  const { data: streakData } = useQuery({
    queryKey: ["streaks"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ streaks: StreakData }>>("/api/streaks");
      return data.data.streaks;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ---- Identity: name and avatar, small inline edits ----
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarInput, setAvatarInput] = useState("");

  useEffect(() => {
    if (profile) setNameInput(profile.display_name);
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (body: {
      display_name?: string;
      avatar_url?: string | null;
    }) => {
      const { data } = await api.patch<ApiResponse<{ profile: FullProfile }>>(
        "/api/users/profile",
        body,
      );
      return data.data.profile;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["user-profile"], updated);
      if (user) setUser({ ...user, display_name: updated.display_name });
      setAvatarUrl(updated.avatar_url);
      toast.success("Profile updated");
      setEditingName(false);
      setEditingAvatar(false);
    },
    onError: () => toast.error("Could not update profile. Try again."),
  });

  // ---- Health form ----
  const [health, setHealth] = useState({
    region: "",
    dietary_style: "" as DietaryStyle | "",
    health_goal: "" as HealthGoal | "",
    biological_sex: "" as BiologicalSex | "",
    activity_level: "" as ActivityLevel | "",
    height_cm: "",
    weight_kg: "",
    exact_age: "",
  });
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const healthInitialized = useRef(false);

  useEffect(() => {
    if (!profile?.health || healthInitialized.current) return;
    healthInitialized.current = true;
    const h = profile.health;
    setHealth({
      region: h.region ?? "",
      dietary_style: (h.dietary_style as DietaryStyle) ?? "",
      health_goal: (h.health_goal as HealthGoal) ?? "",
      biological_sex: (h.biological_sex as BiologicalSex) ?? "",
      activity_level: (h.activity_level as ActivityLevel) ?? "",
      height_cm: h.height_cm ? String(h.height_cm) : "",
      weight_kg: h.weight_kg ? String(h.weight_kg) : "",
      exact_age: h.exact_age ? String(h.exact_age) : "",
    });
    setAllergies(h.allergies);
    setConditions(h.health_conditions);
  }, [profile]);

  const updateHealthMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch<ApiResponse<{ profile: FullProfile }>>(
        "/api/users/health",
        body,
      );
      return data.data.profile;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["user-profile"], updated);
      toast.success("Health profile updated");
    },
    onError: () => toast.error("Could not update health profile. Try again."),
  });

  const saveHealthForm = () => {
    const body: Record<string, unknown> = {
      allergies,
      health_conditions: conditions,
    };
    if (health.region.trim()) body.region = health.region.trim();
    if (health.dietary_style) body.dietary_style = health.dietary_style;
    if (health.health_goal) body.health_goal = health.health_goal;
    if (health.biological_sex) body.biological_sex = health.biological_sex;
    if (health.activity_level) body.activity_level = health.activity_level;
    if (health.height_cm) body.height_cm = Number(health.height_cm);
    if (health.weight_kg) body.weight_kg = Number(health.weight_kg);
    if (health.exact_age) body.exact_age = Number(health.exact_age);
    updateHealthMutation.mutate(body);
  };

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (!v || allergies.includes(v)) return;
    if (allergies.length >= 20) {
      toast.error("Maximum 20 allergies allowed");
      return;
    }
    setAllergies((prev) => [...prev, v]);
    setAllergyInput("");
  };

  const addCondition = () => {
    const v = conditionInput.trim();
    if (!v || conditions.includes(v)) return;
    if (conditions.length >= 20) {
      toast.error("Maximum 20 conditions allowed");
      return;
    }
    setConditions((prev) => [...prev, v]);
    setConditionInput("");
  };

  // ---- Calorie and water targets, separate mini editors since they
  // have a distinct null means auto calculated semantic ----
  const [calorieInput, setCalorieInput] = useState("");
  const [waterInput, setWaterInput] = useState("");
  useEffect(() => {
    if (profile?.health?.calorie_target)
      setCalorieInput(String(profile.health.calorie_target));
    if (profile?.health?.water_target_ml)
      setWaterInput(String(profile.health.water_target_ml));
  }, [profile]);

  const targetMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch<ApiResponse<{ profile: FullProfile }>>(
        "/api/users/health",
        body,
      );
      return data.data.profile;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["user-profile"], updated);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["water"] });
      toast.success("Target updated");
    },
    onError: () => toast.error("Could not update target. Try again."),
  });

  if (isLoading || !profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const providerLabel =
    profile.provider === "google" ? "Google account" : "Email and password";

  const mainContent = (
    <div className="space-y-5 max-w-2xl">
      {/* Identity card */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-cocoa/10 dark:bg-dark-white/10 flex items-center justify-center">
              {avatarUrl || profile.avatar_url ? (
                <img
                  src={avatarUrl ?? profile.avatar_url ?? ""}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-cocoa dark:text-dark-white">
                  {profile.display_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setAvatarInput(profile.avatar_url ?? "");
                setEditingAvatar(true);
              }}
              aria-label="Edit avatar"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-pawpaw dark:bg-black-pawpaw
                text-surface flex items-center justify-center hover:opacity-90"
            >
              <Pencil size={11} />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={50}
                  className={inputClass}
                  autoFocus
                />
                <button
                  onClick={() =>
                    updateProfileMutation.mutate({
                      display_name: nameInput.trim(),
                    })
                  }
                  disabled={
                    updateProfileMutation.isPending ||
                    nameInput.trim().length < 2
                  }
                  aria-label="Save name"
                  className="text-moringa dark:text-moringa-faded hover:opacity-70 disabled:opacity-40"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => {
                    setNameInput(profile.display_name);
                    setEditingName(false);
                  }}
                  aria-label="Cancel"
                  className="text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-lg text-cocoa dark:text-dark-white truncate">
                  {profile.display_name}
                </h1>
                <button
                  onClick={() => setEditingName(true)}
                  aria-label="Edit name"
                  className="text-cocoa/30 dark:text-dark-white/30 hover:text-cocoa dark:hover:text-dark-white"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <p className="text-sm text-cocoa-faded truncate mt-0.5">
              {profile.email}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cocoa/8 dark:bg-dark-white/8 text-cocoa-faded">
                {providerLabel}
              </span>
              <span className="text-[11px] text-cocoa-faded">
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {editingAvatar && (
          <div className="mt-4 pt-4 border-t border-cocoa/10 dark:border-dark-white/10">
            <label className="text-xs text-cocoa-faded block mb-1">
              Image URL. Direct photo upload is not available yet, paste a link
              to an image for now.
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
              <button
                onClick={() =>
                  updateProfileMutation.mutate({
                    avatar_url: avatarInput.trim() || null,
                  })
                }
                disabled={updateProfileMutation.isPending}
                className="px-4 py-2 rounded-lg bg-moringa dark:bg-moringa-faded text-surface text-sm font-semibold shrink-0"
              >
                Save
              </button>
              <button
                onClick={() => setEditingAvatar(false)}
                className="px-3 py-2 rounded-lg border border-cocoa/20 dark:border-dark-white/20 text-sm text-cocoa dark:text-dark-white shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Health and goals form */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-4">
          Health and goals
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Region
            </label>
            <input
              type="text"
              value={health.region}
              onChange={(e) =>
                setHealth((p) => ({ ...p, region: e.target.value }))
              }
              placeholder="e.g. South West Nigeria"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">Age</label>
            <input
              type="text"
              inputMode="numeric"
              value={health.exact_age}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  exact_age: sanitizeNumber(e.target.value),
                }))
              }
              placeholder={profile.health?.age_range ?? "Your age"}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Dietary style
            </label>
            <select
              value={health.dietary_style}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  dietary_style: e.target.value as DietaryStyle,
                }))
              }
              className={`${inputClass} capitalize`}
            >
              <option value="">Not set</option>
              {DIETARY_STYLES.map((d) => (
                <option key={d} value={d}>
                  {labelize(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Health goal
            </label>
            <select
              value={health.health_goal}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  health_goal: e.target.value as HealthGoal,
                }))
              }
              className={inputClass}
            >
              <option value="">Not set</option>
              {HEALTH_GOALS.map((g) => (
                <option key={g} value={g}>
                  {labelize(g)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Biological sex
            </label>
            <select
              value={health.biological_sex}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  biological_sex: e.target.value as BiologicalSex,
                }))
              }
              className={`${inputClass} capitalize`}
            >
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Activity level
            </label>
            <select
              value={health.activity_level}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  activity_level: e.target.value as ActivityLevel,
                }))
              }
              className={inputClass}
            >
              <option value="">Not set</option>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a} value={a}>
                  {labelize(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Height (cm)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={health.height_cm}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  height_cm: sanitizeNumber(e.target.value),
                }))
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Weight (kg)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={health.weight_kg}
              onChange={(e) =>
                setHealth((p) => ({
                  ...p,
                  weight_kg: sanitizeNumber(e.target.value),
                }))
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* Allergies */}
        <div className="mb-4">
          <label className="text-xs text-cocoa-faded block mb-1.5">
            Allergies
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {allergies.map((a) => (
              <span
                key={a}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs
                  bg-cocoa/8 dark:bg-dark-white/8 text-cocoa dark:text-dark-white
                  border border-cocoa/15 dark:border-dark-white/15"
              >
                {a}
                <button
                  onClick={() =>
                    setAllergies((prev) => prev.filter((x) => x !== a))
                  }
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addAllergy())
              }
              placeholder="Add an allergy and press Enter"
              className={inputClass}
            />
          </div>
        </div>

        {/* Health conditions */}
        <div className="mb-5">
          <label className="text-xs text-cocoa-faded block mb-1.5">
            Health conditions
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {conditions.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs
                  bg-cocoa/8 dark:bg-dark-white/8 text-cocoa dark:text-dark-white
                  border border-cocoa/15 dark:border-dark-white/15"
              >
                {c}
                <button
                  onClick={() =>
                    setConditions((prev) => prev.filter((x) => x !== c))
                  }
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={conditionInput}
              onChange={(e) => setConditionInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addCondition())
              }
              placeholder="Add a condition and press Enter"
              className={inputClass}
            />
          </div>
        </div>

        <button
          onClick={saveHealthForm}
          disabled={updateHealthMutation.isPending}
          className="py-2.5 px-6 rounded-xl bg-moringa dark:bg-moringa-faded
            text-surface text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {updateHealthMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* Targets, separate from the form above since they have their
      own auto calculated vs manual override behavior */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-4">
          Daily targets
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Calorie target
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={calorieInput}
                onChange={(e) =>
                  setCalorieInput(sanitizeNumber(e.target.value))
                }
                className={inputClass}
              />
              <button
                onClick={() =>
                  calorieInput &&
                  targetMutation.mutate({
                    calorie_target: Number(calorieInput),
                  })
                }
                disabled={targetMutation.isPending}
                className="px-3 py-2 rounded-lg bg-moringa dark:bg-moringa-faded text-surface text-xs font-semibold shrink-0"
              >
                Save
              </button>
            </div>
            <button
              onClick={() => targetMutation.mutate({ calorie_target: null })}
              disabled={targetMutation.isPending}
              className="text-[11px] text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white mt-1.5 underline decoration-dotted"
            >
              Reset to auto calculated
            </button>
          </div>

          <div>
            <label className="text-xs text-cocoa-faded block mb-1">
              Water target (ml)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={waterInput}
                onChange={(e) => setWaterInput(sanitizeNumber(e.target.value))}
                className={inputClass}
              />
              <button
                onClick={() =>
                  waterInput &&
                  targetMutation.mutate({ water_target_ml: Number(waterInput) })
                }
                disabled={targetMutation.isPending}
                className="px-3 py-2 rounded-lg bg-moringa dark:bg-moringa-faded text-surface text-xs font-semibold shrink-0"
              >
                Save
              </button>
            </div>
            <button
              onClick={() => targetMutation.mutate({ water_target_ml: null })}
              disabled={targetMutation.isPending}
              className="text-[11px] text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white mt-1.5 underline decoration-dotted"
            >
              Reset to auto calculated
            </button>
          </div>
        </div>
        <p className="text-[11px] text-cocoa-faded mt-3">
          Auto calculated targets use your sex, weight, height, age, activity
          level, and goal above. Set enough of those fields and save for the
          auto calculation to have something to work with.
        </p>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{
          background:
            resolvedTheme === "dark"
              ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
              : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1700px] mx-auto overflow-hidden">
          <PageTopBar title="Profile" showSearch={false} />
          <div className="md:hidden shrink-0">
            <MobileTopNav />
          </div>

          <div className="flex-1 flex min-h-0 gap-8 px-4 md:px-6 lg:px-8 pt-4 md:pt-20 lg:pt-2 pb-6 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto">{mainContent}</div>

            <div className="hidden lg:flex flex-col w-[340px] shrink-0 pt-2 overflow-y-auto">
              <StreakPanel
                streakData={streakData}
                dashData={dashData}
                waterData={waterData}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
