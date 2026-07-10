import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { useScreenTier } from "@/hooks/useMediaQuery";
import { useTheme } from "@/context/ThemeContext";

/*
  Notifications page, mobile only. Tablet and desktop already have the
  bell dropdown in the header for this, a whole page there would be
  redundant, so this redirects home if it's ever opened above mobile
  width.
*/
export const NotificationsPage = () => {
  const tier = useScreenTier();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (tier !== "mobile") navigate("/", { replace: true });
  }, [tier, navigate]);

  if (tier !== "mobile") return null;

  return (
    <AppLayout>
      <div
        className="min-h-screen"
        style={{
          background:
            resolvedTheme === "dark"
              ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
              : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <MobileTopNav />
        <div className="pt-20 px-4">
          <h1 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-6">
            Notifications
          </h1>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-cocoa-faded">No notifications yet</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationsPage;
