import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { sendSuccess } from "../../shared/response.js";
import { getPublicFoods } from "./public.service.js";

// ---------------------------------------------------------------------------
// Public, unauthenticated, read-only routes. Consumed server side by the
// website to render the SEO food pages. No user data is reachable here.
// ---------------------------------------------------------------------------
export const publicRouter = Router();

// Generous because the website fetches this during builds and cache
// revalidation, many page renders can share one outbound IP. The response
// itself is Redis cached so a burst costs almost nothing.
const publicFoodsLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 300,
  keyPrefix: "public:foods",
});

// GET /api/public/foods
publicRouter.get(
  "/foods",
  publicFoodsLimiter,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const foods = await getPublicFoods();
      // Lets any CDN in front of the API cache it briefly as well.
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
      sendSuccess({ res, data: { foods, count: foods.length } });
    } catch (err) {
      next(err);
    }
  },
);
