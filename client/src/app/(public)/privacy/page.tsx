import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, SiteShell } from "@/components/public/SiteShell";
import { PageHeader, Prose } from "@/components/public/Prose";
import { JsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { LEGAL_LAST_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Flax collects, uses, stores and protects your personal and health data, which service providers process it, and the choices and rights you have.",
  path: "/privacy",
});

/*
  Written from what the code actually does. Keep it accurate when
  features change: data collected, processors, retention, deletion.
*/
const PrivacyPage = () => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Privacy Policy", path: "/privacy" },
  ];
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

  return (
    <SiteShell>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <PageHeader
        title="Privacy Policy"
        lead="Your health data is personal. This policy explains what Flax collects, why, who processes it, and the control you have over it."
        updated={LEGAL_LAST_UPDATED}
      />

      <Prose>
        <h2>Who we are</h2>
        <p>
          Flax (useflax.cc) is operated by {SITE.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). We
          are responsible for the personal data described in this policy. Contact us about privacy
          at any time at {mail}.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>We collect what is needed to track your nutrition and hydration and to run your account.</li>
          <li>We never sell your data and do not use it for advertising.</li>
          <li>
            Your data is processed only by the service providers needed to run Flax, such as hosting,
            databases, email and the AI models behind Noura, listed below.
          </li>
          <li>Flax does not use advertising or third party analytics trackers.</li>
        </ul>

        <h2>What we collect</h2>
        <h3>Account information</h3>
        <ul>
          <li>Your email address and display name.</li>
          <li>
            Your password, stored only as a secure one way hash, never in readable form. If you sign
            in with Google, we receive your name, email address and Google account identifier
            instead, and no password is stored.
          </li>
          <li>The avatar you choose, your time zone, and when you last signed in.</li>
        </ul>
        <h3>Health and profile information you provide</h3>
        <ul>
          <li>
            Region, dietary style, health goal, allergies, health conditions, biological sex,
            activity level, height, weight, age range or exact age, and your calorie and water
            targets, including a history of target changes so past days are judged fairly.
          </li>
        </ul>
        <h3>What you log and do in the app</h3>
        <ul>
          <li>Meals, portions and nutrition values, water entries, and your streaks.</li>
          <li>Meal suggestions you spin, like or flag, and the pantry items you add.</li>
          <li>Your conversations with Noura (the most recent 200 messages are kept, you can clear them at any time).</li>
          <li>Feedback you send us, and in app notifications we send you.</li>
          <li>If you enable push notifications, the push subscription details your browser provides.</li>
        </ul>
        <h3>Meal photos</h3>
        <p>
          When you scan a meal, the photo and any description you add are sent to our AI providers
          to identify the food and estimate its nutrition. Flax does not store the photo after the
          scan, only the results you choose to log.
        </p>
        <h3>Technical information</h3>
        <p>
          Like most websites, our servers record basic request information such as IP address,
          browser type, the page requested and time, which we use for security, abuse prevention
          (for example rate limiting) and troubleshooting.
        </p>

        <h2>How we use your data</h2>
        <ul>
          <li>To provide Flax: calculate your targets, record your logs, show your progress and streaks.</li>
          <li>
            To personalise Noura and meal suggestions, for example so suggestions respect your
            allergies and goal.
          </li>
          <li>
            To send service emails: verification codes, password resets, a welcome email, and a
            reminder email if you have been inactive for a while. To send in app and, if you allow
            it, push notifications such as hydration reminders.
          </li>
          <li>To keep Flax secure, prevent abuse and fix problems.</li>
        </ul>
        <p>
          We process your data to perform our agreement with you (providing the service), with your
          consent where you give it (for example health information you choose to enter, push
          notifications), and for our legitimate interests in keeping Flax secure and working.
        </p>

        <h2>Service providers that process your data</h2>
        <p>
          We use the following providers to run Flax. They process data on our behalf, only for the
          purpose of providing their service to us:
        </p>
        <ul>
          <li><strong>Vercel</strong> — hosts the Flax website.</li>
          <li><strong>Render</strong> — hosts the Flax application server.</li>
          <li><strong>Neon</strong> — database for your account, profile and logs.</li>
          <li><strong>MongoDB</strong> — database for the food catalogue and your Noura chat history.</li>
          <li><strong>A managed Redis provider</strong> — short lived caching and rate limiting.</li>
          <li>
            <strong>Groq</strong> and <strong>Google (Gemini)</strong> — AI models that power Noura:
            chat replies, meal suggestions, nutrition estimates and meal photo analysis. To answer
            you personally, relevant profile details (such as your goal, dietary style, allergies,
            targets and pantry items) and your recent messages are included in requests to these
            models.
          </li>
          <li><strong>Resend</strong> — sends Flax emails.</li>
          <li><strong>Google</strong> — sign in with Google, if you choose it.</li>
          <li><strong>Axiom</strong> — server logs used for monitoring and troubleshooting.</li>
          <li>
            <strong>Your browser&apos;s push service</strong> (for example Google, Apple or
            Mozilla) — delivers push notifications if you enable them.
          </li>
        </ul>
        <p>
          These providers may store or process data in countries other than your own, including the
          United States and the European Union. Where that happens we rely on the safeguards those
          providers offer for international transfers.
        </p>

        <h2>Cookies and browser storage</h2>
        <p>
          Flax uses one essential cookie: a secure, http only sign in cookie that keeps you logged in
          for up to 7 days. It cannot be read by scripts and is only sent to our sign in endpoints.
          Flax also stores a few preferences in your browser, such as your theme, whether you are
          signed in on this device, and unsent drafts. We do not use advertising or tracking
          cookies.
        </p>

        <h2>How long we keep data</h2>
        <ul>
          <li>Your account data is kept while your account is active.</li>
          <li>Unfinished sign ups are deleted automatically after 3 days.</li>
          <li>Expired and revoked sign in sessions are cleaned up automatically.</li>
          <li>
            When you delete your account in Settings, it is deactivated immediately, all sessions
            are signed out and it is no longer accessible. To have your data permanently erased,
            email {mail} and we will delete it. If you signed up with Google, email us to delete
            your account.
          </li>
        </ul>

        <h2>Your choices and rights</h2>
        <p>
          You can view and update your profile and health details in the app at any time, clear
          your Noura chat history, delete logs, and turn push notifications off. Depending on where
          you live, including under the Nigeria Data Protection Act 2023 and the EU and UK GDPR, you
          may also have the right to access a copy of your data, correct it, have it erased,
          restrict or object to processing, withdraw consent, and receive your data in a portable
          format. Email {mail} to make a request. You also have the right to complain to your data
          protection authority, such as the Nigeria Data Protection Commission.
        </p>

        <h2>Security</h2>
        <p>
          Passwords are hashed, sign in tokens are short lived and rotated, sign in cookies are
          http only and secure, and all traffic is encrypted in transit. No system is perfectly
          secure, but we work hard to protect your data and will notify you and the relevant
          authorities of a breach where the law requires.
        </p>

        <h2>Children</h2>
        <p>
          Flax is not intended for anyone under 16, and we do not knowingly collect data from
          children under 16. If you believe a child has created an account, contact us and we will
          delete it.
        </p>

        <h2>Health information disclaimer</h2>
        <p>
          Flax provides general nutrition and hydration information and estimates. It is not a
          medical service and is not a substitute for advice from a doctor or registered dietitian.
          See the <Link href="/terms">Terms of Service</Link>.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as Flax changes. We will update the date at the top, and for
          significant changes we will let you know in the app or by email.
        </p>

        <h2>Contact</h2>
        <p>
          {SITE.operator}, operator of Flax. Email: {mail}.
        </p>
      </Prose>
    </SiteShell>
  );
};

export default PrivacyPage;
