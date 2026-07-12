import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { StreakPanel } from "@/features/home/StreakPanel";
import { AvatarPickerModal } from "@/features/profile/AvatarPickerModal";
import { PrivacyNote } from "@/features/profile/PrivacyNote";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type {
  ApiResponse,
  FullProfile,
  DashboardData,
  WaterData,
  StreakData,
  DietaryStyle,
  HealthGoal,
  ActivityLevel,
} from "@/types/apiTypes";
import { useScreenTier } from "@/hooks/useMediaQuery";

/*
  Region and biological sex are shown but never editable here. Both
  feed the auto calculation for calorie and water targets, and both
  were set once at onboarding, letting them change silently later
  would move numbers the person already trusts with no record of why.
  Same reasoning the calendar caveat below is built on.

  Calorie and water panel stays on the right on desktop, same
  component and same data every other page with it uses. Hidden on
  tablet and mobile where the main content needs the width instead,
  and the main content centers itself either way.
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
  "focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50 ";

const sanitizeNumber = (raw: string): string => {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly === "") return "";
  return digitsOnly.replace(/^0+(?=\d)/, "");
};

// Plain label over value row, used for the collapsed health view and
// for the always locked fields inside the edit form (region, sex).
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="font-heading text-xs lg:text-sm font-semibold text-cocoa dark:text-dark-white mb-0.5">
      {label}
    </p>
    <p className="text-sm text-cocoa-faded">{value}</p>
  </div>
);

export const ProfilePage = () => {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useUserProfile();
  const { setUser, user, setAvatarUrl, avatarUrl } = useAuthStore();
  const tier = useScreenTier();

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

  // ---- Identity: name inline edit, avatar via preset picker ----
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

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
      setShowAvatarPicker(false);
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Could not update profile. Try again."),
      ),
  });

  // ---- Health form, collapsed behind an edit icon. Region and
  // biological sex are read only everywhere, never part of the
  // editable state or the save payload. ----
  const [editingHealth, setEditingHealth] = useState(false);
  const [health, setHealth] = useState({
    dietary_style: "" as DietaryStyle | "",
    health_goal: "" as HealthGoal | "",
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
      dietary_style: (h.dietary_style as DietaryStyle) ?? "",
      health_goal: (h.health_goal as HealthGoal) ?? "",
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
      setEditingHealth(false);
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Could not update health profile. Try again."),
      ),
  });

  const saveHealthForm = () => {
    // region and biological_sex are intentionally never included here,
    // they are locked fields, see the note at the top of this file.
    const body: Record<string, unknown> = {
      allergies,
      health_conditions: conditions,
    };
    if (health.dietary_style) body.dietary_style = health.dietary_style;
    if (health.health_goal) body.health_goal = health.health_goal;
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

  // ---- Targets, collapsed behind an edit icon, own mini editors since
  // they have a distinct null means auto calculated semantic ----
  const [editingTargets, setEditingTargets] = useState(false);
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
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Could not update target. Try again."),
      ),
  });

  // Only the true first load, with nothing cached yet, gets a full
  // page spinner. After that this page trusts whatever React Query
  // has, even offline, same as every other page in the app.
  if (isLoading && !profile) {
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
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
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
            <div className="flex flex-col items-center justify-center h-[30rem] md:h-[16rem] gap-2 text-center px-6">
              <p className="text-sm text-cocoa-faded">
                Couldn't load your profile. Check your connection.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const mainContent = (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Identity card */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] lg:w-[150px] lg:h-[150px] rounded-full overflow-hidden bg-cocoa/10 dark:bg-dark-white/10 flex items-center justify-center">
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
              onClick={() => setShowAvatarPicker(true)}
              aria-label="Edit avatar"
              className="absolute -bottom-[-10px] -right-1 w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-pawpaw dark:bg-black-pawpaw
                text-surface flex items-center justify-center hover:opacity-90"
            >
              <Pencil size={13} />
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
            <div className="flex flex-col mt-1.5">
              <span className="text-[12px] text-cocoa-faded truncate">
                {profile.email}
              </span>
              <span className="text-[10px] text-cocoa-faded">
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AvatarPickerModal
        open={showAvatarPicker}
        biologicalSex={profile.health?.biological_sex}
        currentUrl={profile.avatar_url}
        onSelect={(url) => updateProfileMutation.mutate({ avatar_url: url })}
        onClose={() => setShowAvatarPicker(false)}
      />

      {/* Health and goals, collapsed until edit is tapped */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white">
            Health and goals
          </h2>
          <button
            onClick={() => setEditingHealth((v) => !v)}
            aria-label="Edit health and goals"
            className="text-cocoa/40 dark:text-dark-white/40 hover:text-cocoa dark:hover:text-dark-white"
          >
            {!editingHealth ? <Pencil size={15} /> : "Cancel"}
          </button>
        </div>

        {!editingHealth ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow
                label="Region"
                value={
                  profile.health?.region
                    ? labelize(profile.health.region)
                    : "Not set"
                }
              />
              <InfoRow
                label="Age"
                value={
                  profile.health?.exact_age
                    ? String(profile.health.exact_age)
                    : (profile.health?.age_range ?? "Not set")
                }
              />
              <InfoRow
                label="Biological sex"
                value={
                  profile.health?.biological_sex
                    ? labelize(profile.health.biological_sex)
                    : "Not set"
                }
              />
              <InfoRow
                label="Dietary style"
                value={
                  profile.health?.dietary_style
                    ? labelize(profile.health.dietary_style)
                    : "Not set"
                }
              />
              <InfoRow
                label="Health goal"
                value={
                  profile.health?.health_goal
                    ? labelize(profile.health.health_goal)
                    : "Not set"
                }
              />
              <InfoRow
                label="Activity level"
                value={
                  profile.health?.activity_level
                    ? labelize(profile.health.activity_level)
                    : "Not set"
                }
              />
              <InfoRow
                label="Height"
                value={
                  profile.health?.height_cm
                    ? `${profile.health.height_cm} cm`
                    : "Not set"
                }
              />
              <InfoRow
                label="Weight"
                value={
                  profile.health?.weight_kg
                    ? `${profile.health.weight_kg} kg`
                    : "Not set"
                }
              />
            </div>
            <InfoRow
              label="Allergies"
              value={allergies.length ? allergies.join(", ") : "None added"}
            />
            <InfoRow
              label="Health conditions"
              value={conditions.length ? conditions.join(", ") : "None added"}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <InfoRow
                label="Region"
                value={profile.health?.region || "Not set"}
              />
              <InfoRow
                label="Biological sex"
                value={
                  profile.health?.biological_sex
                    ? labelize(profile.health.biological_sex)
                    : "Not set"
                }
              />
              <div>
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
                  Age
                </label>
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
                <p className="text-[10px] text-cocoa-faded mt-1">
                  Input exact age to get more accurate calorie and water targets
                </p>
              </div>
              <div>
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
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
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
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
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
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
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
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
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
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

            <div className="mb-4">
              <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1.5">
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

            <div className="mb-5">
              <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1.5">
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

            <button
              onClick={saveHealthForm}
              disabled={updateHealthMutation.isPending}
              className="py-2.5 px-6 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {updateHealthMutation.isPending ? "Saving..." : "Save changes"}
            </button>
            <div className="mt-5">
              <p className=" text-xs lg:text-sm text-cocoa-faded block mb-1.5">
                <b>Notes:</b> Changing either your age, height, weight, health
                goal, or activity level will change your auto calculated calorie
                and water targets. If you have manually set targets, they will
                remain unchanged.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Targets, collapsed until edit is tapped, shows current
      effective value first either way */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white">
            Daily targets
          </h2>
          <button
            onClick={() => setEditingTargets((v) => !v)}
            aria-label="Edit targets"
            className="text-cocoa/40 dark:text-dark-white/40 hover:text-cocoa dark:hover:text-dark-white"
          >
            {!editingTargets ? <Pencil size={15} /> : "Cancel"}
          </button>
        </div>

        <div className="flex flex-col gap-6 mb-4">
          <InfoRow
            label="Calories"
            value={
              profile.health?.calorie_target
                ? `${profile.health.calorie_target} kcal, ${profile.health.calorie_target_is_manual ? "manually set" : "auto calculated"}`
                : "Not set"
            }
          />
          <InfoRow
            label="Water"
            value={
              profile.health?.water_target_ml
                ? `${profile.health.water_target_ml} ml, ${profile.health.water_target_is_manual ? "manually set" : "auto calculated"}`
                : "Not set"
            }
          />
        </div>

        {editingTargets && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
                  Calorie target (kcal)
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
                  onClick={() =>
                    targetMutation.mutate({ calorie_target: null })
                  }
                  disabled={targetMutation.isPending}
                  className="text-[11px] text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white mt-1.5 underline decoration-dotted"
                >
                  Reset to auto calculated
                </button>
              </div>

              <div>
                <label className="font-heading text-xs lg:text-sm text-cocoa-faded block mb-1">
                  Water target (ml)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waterInput}
                    onChange={(e) =>
                      setWaterInput(sanitizeNumber(e.target.value))
                    }
                    className={inputClass}
                  />
                  <button
                    onClick={() =>
                      waterInput &&
                      targetMutation.mutate({
                        water_target_ml: Number(waterInput),
                      })
                    }
                    disabled={targetMutation.isPending}
                    className="px-3 py-2 rounded-lg bg-moringa dark:bg-moringa-faded text-surface text-xs font-semibold shrink-0"
                  >
                    Save
                  </button>
                </div>
                <button
                  onClick={() =>
                    targetMutation.mutate({ water_target_ml: null })
                  }
                  disabled={targetMutation.isPending}
                  className="text-[11px] text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white mt-1.5 underline decoration-dotted"
                >
                  Reset to auto calculated
                </button>
              </div>
            </div>
            <p className="text-[11px] text-cocoa-faded mt-3">
              Auto calculated targets use your sex, weight, height, age,
              activity level, and goal above. Set enough of those fields and
              save for the auto calculation to have something to work with.
            </p>
          </>
        )}
      </div>
      <PrivacyNote />
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

          <div className="flex-1 flex min-h-0 gap-8 px-4 md:px-6 lg:px-8 md:pt-4 lg:pt-2 pb-6 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto">
              {tier === "mobile" && (
                <p className="mt-20 pb-5 px-2 font-heading font-bold text-base tracking-wide text-cocoa/70 dark:text-dark-white/70 shrink-0">
                  Profile
                </p>
              )}
              {mainContent}
            </div>

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
