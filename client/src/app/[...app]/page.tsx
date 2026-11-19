import type { Metadata } from "next";
import { SPA_ROUTES } from "@/lib/spaRoutes";
import SpaShell from "./SpaShell";

/*
  Serves the client side app for its known paths only (lib/spaRoutes.ts).
  dynamicParams = false turns every other path into a genuine 404, the
  old Vercel catch all answered 200 with the app shell for any URL.
*/
export const dynamicParams = false;

export const generateStaticParams = () =>
  SPA_ROUTES.map((route) => ({ app: route.split("/") }));

// Signed in screens and auth forms carry no public content, keep them
// out of search results. Public pages are the ones meant to rank.
export const metadata: Metadata = {
  title: { absolute: "Flax" },
  robots: { index: false, follow: false },
};

const AppPage = () => <SpaShell />;

export default AppPage;
