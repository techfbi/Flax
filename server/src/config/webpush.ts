import webpush from "web-push";
import { env } from "./env.js";

// Initialise web-push with VAPID keys once at module load. VAPID (Voluntary Application Server Identification) is the standard
// that proves to the browser push service that push requests genuinely come from our server, not an attacker impersonating it.
webpush.setVapidDetails(
  `mailto:${env.VAPID_EMAIL}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export { webpush };