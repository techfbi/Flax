import { useState } from "react";
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

/*
  Settings page. Appearance, notifications, account security, and
  account deletion. Health and identity data live on the Profile page
  instead, this page is configuration, not identity.
*/

const inputClass =
  "w-full bg-surface dark:bg-black-surface border border-cocoa/20 " +
  "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
  "outline-none text-cocoa dark:text-dark-white " +
  "focus:border-pawpaw dark:focus:border-black-pawpaw";

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
    <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-4">
      {title}
    </h2>
    {children}
  </div>
);

export const SettingsPage = () => {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { data: profile } = useUserProfile();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  // ---- Notifications ----
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!pushEnabled) {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast.error("Push notifications are not supported in this browser");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission was not granted");
          return;
        }
        // NOTE: this expects a service worker registered at /sw.js.
        // That file does not exist in the client yet, so this will
        // throw until one is added. Flagging this rather than
        // pretending it already works, tell me if you want it built.
        const registration = await navigator.serviceWorker.register("/sw.js");
        const { data } = await api.get<ApiResponse<{ publicKey: string }>>(
          "/api/notifications/vapid-key",
        );
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: data.data.publicKey,
        });
        await api.post("/api/notifications/subscribe", subscription);
        setPushEnabled(true);
        toast.success("Push notifications enabled");
      } else {
        await api.delete("/api/notifications/subscribe");
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
    <div className="space-y-5 max-w-2xl">
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
              <p className="text-sm font-medium text-cocoa dark:text-dark-white">
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
                ${pushEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Password">
        {isOAuth ? (
          <p className="text-sm text-cocoa-faded">
            This account signs in with Google, so there is no Flax password to
            change.
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

      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5 border border-rose-500/20">
        <h2 className="font-heading font-bold text-base text-rose-500 mb-1">
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
              text-sm font-semibold hover:bg-rose-500/5"
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
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-20 lg:pt-2 pb-6">
            {mainContent}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
