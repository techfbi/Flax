import type { MetadataRoute } from "next";
import { PRIVATE_PATHS } from "@/lib/spaRoutes";
import { SITE } from "@/lib/site";

/*
  Every crawler, search engines and AI answer engines alike, may read
  the public site. Only the private app areas and the API are excluded.
  /login and /register stay crawlable so engines can see their noindex.
*/
const robots = (): MetadataRoute.Robots => ({
  rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
  sitemap: `${SITE.url}/sitemap.xml`,
});

export default robots;
