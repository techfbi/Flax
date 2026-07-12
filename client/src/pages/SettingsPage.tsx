import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Monitor, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { useTheme } from "@/context/ThemeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/apiTypes";
import { useScreenTier } from "@/hooks/useMediaQuery";
import { useSpinSound } from "@/hooks/useSpinSound";

/*
  Settings page. Appearance, notifications, account security, and
  account deletion. Health and identity data live on the Profile page
  instead, this page is configuration, not identity.
*/

// Browsers need the VAPID key as a Uint8Array, not the base64url
// string the server sends. Standard conversion, nothing fancy.
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const inputClass =
  "w-full bg-surface dark:bg-black-surface border border-cocoa/20 " +
  "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
  "outline-none text-cocoa dark:text-dark-white " +
  "focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50";

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
    <h2 className="font-heading font-bold text-sm md:text-base text-cocoa dark:text-dark-white mb-5">
      {title}
    </h2>
    {children}
  </div>
);

export const SettingsPage = () => {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { data: profile } = useUserProfile();
  const { clearAuth } = useAuthStore();
  const tier = useScreenTier();
  const navigate = useNavigate();
  const { enabled: spinSoundEnabled, setEnabled: setSpinSoundEnabled } =
    useSpinSound();
  const showDeleteAccount = import.meta.env.VITE_SHOW_DELETE_ACCOUNT;

  // ---- Notifications ----
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // on mount, ask the browser directly whether a push subscription
  // already exists, rather than assuming it does not. this is the
  // actual source of truth, a locally stored flag can drift out of
  // sync with reality, the browser's own state cannot.
  useEffect(() => {
    const checkPushStatus = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        setPushEnabled(!!subscription);
      } catch {
        // could not determine status, leave it showing as off
      }
    };
    checkPushStatus();
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (!pushEnabled) {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast.error("Push notifications are not supported on this device");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission was not granted");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        const { data } = await api.get<ApiResponse<{ publicKey: string }>>(
          "/api/notifications/vapid-key",
        );
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            data.data.publicKey,
          ) as BufferSource,
        });
        const subJson = subscription.toJSON();
        await api.post("/api/notifications/subscribe", {
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        });
        setPushEnabled(true);
        toast.success("Push notifications enabled");
      } else {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await api.delete("/api/notifications/subscribe", {
            data: { endpoint: subscription.endpoint },
          });
          await subscription.unsubscribe();
        }
        setPushEnabled(false);
        toast.success("Push notifications disabled");
      }
    } catch {
      toast.error(
        "Could not update push notifications. This device may not support them yet.",
      );
    } finally {
      setPushBusy(false);
    }
  };

  // ---- Password change ----
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await api.patch("/api/users/password", pwForm);
    },
    onSuccess: () => {
      toast.success("Password changed. Please log in again.");
      setPwForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      clearAuth();
      navigate("/login", { replace: true });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not change password. Try again.";
      toast.error(message);
    },
  });

  // ---- Delete account ----
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/api/users/account", {
        data: { password: deletePassword },
      });
    },
    onSuccess: () => {
      clearAuth();
      navigate("/", { replace: true });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not delete account. Check your password.";
      toast.error(message);
    },
  });

  const isOAuth = profile?.provider === "google";

  const mainContent = (
    <div className="space-y-5 max-w-2xl mx-auto mt-1 md:mt-0">
      <SectionCard title="Appearance">
        <div className="flex gap-2">
          {[
            { key: "light" as const, label: "Light", icon: Sun },
            { key: "dark" as const, label: "Dark", icon: Moon },
            { key: "system" as const, label: "System", icon: Monitor },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors
                ${
                  theme === opt.key
                    ? "border-pawpaw dark:border-black-pawpaw bg-pawpaw/10 dark:bg-black-pawpaw/10"
                    : "border-cocoa/15 dark:border-dark-white/15"
                }`}
            >
              <opt.icon size={18} className="text-cocoa dark:text-dark-white" />
              <span className="text-xs text-cocoa dark:text-dark-white">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Notifications">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pushEnabled ? (
              <Bell size={18} className="text-cocoa dark:text-dark-white" />
            ) : (
              <BellOff size={18} className="text-cocoa-faded" />
            )}
            <div>
              <p className="text-sm  text-cocoa dark:text-dark-white">
                Push notifications
              </p>
              <p className="text-xs text-cocoa-faded">
                Reminders for water, meals, and streaks
              </p>
            </div>
          </div>
          <button
            onClick={togglePush}
            disabled={pushBusy}
            className={`w-11 h-6 rounded-full relative transition-colors shrink-0
              ${pushEnabled ? "bg-moringa dark:bg-moringa-faded" : "bg-cocoa/20 dark:bg-dark-white/20"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface transition-transform
                ${pushEnabled ? "translate-x-[2px]" : "translate-x-[-22px]"}`}
            />
          </button>
        </div>
      </SectionCard>

      {/* Spin sound toggle */}
      <SectionCard title="Sound">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cocoa dark:text-dark-white">
              Spin sound
            </p>
            <p className="text-xs text-cocoa-faded mt-0.5">
              Play sound effects when spinning for a meal suggestion
            </p>
          </div>
          <button
            onClick={() => setSpinSoundEnabled(!spinSoundEnabled)}
            role="switch"
            aria-checked={spinSoundEnabled}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              spinSoundEnabled
                ? "bg-moringa dark:bg-moringa-faded"
                : "bg-cocoa/20 dark:bg-dark-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                spinSoundEnabled ? "translate-x-[2px]" : "translate-x-[-22px]"
              }`}
            />
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Change password">
        {isOAuth ? (
          <p className="text-sm text-cocoa-faded">
            This account signs in with Google.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Current password"
              value={pwForm.current_password}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, current_password: e.target.value }))
              }
              className={inputClass}
            />
            <input
              type="password"
              placeholder="New password"
              value={pwForm.new_password}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, new_password: e.target.value }))
              }
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pwForm.confirm_password}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, confirm_password: e.target.value }))
              }
              className={inputClass}
            />
            <button
              onClick={() => changePasswordMutation.mutate()}
              disabled={
                changePasswordMutation.isPending ||
                !pwForm.current_password ||
                !pwForm.new_password ||
                !pwForm.confirm_password
              }
              className="py-2.5 px-6 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {changePasswordMutation.isPending
                ? "Changing..."
                : "Change password"}
            </button>
          </div>
        )}
      </SectionCard>

      {showDeleteAccount === "true" && (
        <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
          <h2 className="font-heading font-bold text-sm md:text-base text-rose-500 mb-1">
            Delete account
          </h2>
          <p className="text-xs text-cocoa-faded mb-4">
            This permanently removes your access to Flax. This cannot be undone.
          </p>

          {isOAuth ? (
            <p className="text-sm text-cocoa-faded">
              Google accounts cannot be deleted from here. Contact support to
              remove this account.
            </p>
          ) : !showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="py-2.5 px-6 rounded-xl border border-rose-500 text-rose-500
              text-sm font-medium hover:bg-rose-500/5"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Enter your password to confirm"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending || !deletePassword}
                  className="py-2.5 px-6 rounded-xl bg-rose-500 text-surface
                  text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {deleteAccountMutation.isPending
                    ? "Deleting..."
                    : "Confirm delete"}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeletePassword("");
                  }}
                  className="py-2.5 px-6 rounded-xl border border-cocoa/20 dark:border-dark-white/20
                  text-sm text-cocoa dark:text-dark-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
          <PageTopBar title="Settings" showSearch={false} />
          <div className="md:hidden shrink-0">
            <MobileTopNav />
            {tier === "mobile" && (
              <p className="mt-20 px-5 font-heading font-bold text-base tracking-wide text-cocoa/70 dark:text-dark-white/70 shrink-0">
                Settings
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-5 lg:pt-2 pb-6">
            {mainContent}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
