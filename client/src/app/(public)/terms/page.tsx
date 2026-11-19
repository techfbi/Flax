import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, SiteShell } from "@/components/public/SiteShell";
import { PageHeader, Prose } from "@/components/public/Prose";
import { JsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { LEGAL_LAST_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "The terms for using Flax, the AI nutrition and hydration tracker, including eligibility, acceptable use, AI estimates and health disclaimers.",
  path: "/terms",
});

const TermsPage = () => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Terms of Service", path: "/terms" },
  ];
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

  return (
    <SiteShell>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <PageHeader
        title="Terms of Service"
        lead="Please read these terms before using Flax. By creating an account or using Flax you agree to them."
        updated={LEGAL_LAST_UPDATED}
      />

      <Prose>
        <h2>1. About these terms</h2>
        <p>
          These terms are an agreement between you and {SITE.operator}, the operator of Flax
          (useflax.cc). Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your
          data and forms part of these terms.
        </p>

        <h2>2. Not medical advice</h2>
        <p>
          <strong>
            Flax is a general wellness tool. It does not provide medical advice, diagnosis or
            treatment.
          </strong>{" "}
          Calorie and water targets, nutrition values, meal suggestions and anything Noura says are
          general information and estimates only. Always seek the advice of a doctor or registered
          dietitian about a medical condition, pregnancy, an eating disorder, or before making
          significant changes to your diet or exercise. Never ignore professional advice because of
          something you read in Flax. In an emergency, contact your local emergency services.
        </p>

        <h2>3. AI features and estimates</h2>
        <p>
          Noura, meal scanning and nutrition estimates are powered by AI models. AI output can be
          incomplete or wrong, for example it may misidentify a food, misjudge a portion or miss an
          ingredient. Review results before logging them and do not rely on them for allergy
          safety. Food catalogue values are estimates for typical recipes and real dishes vary.
        </p>

        <h2>4. Eligibility and your account</h2>
        <ul>
          <li>You must be at least 16 years old to use Flax.</li>
          <li>Provide accurate information and keep your login details secure.</li>
          <li>You are responsible for activity on your account. Tell us at {SITE.email} if you suspect unauthorised use.</li>
        </ul>

        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>break the law, or use Flax to harm yourself or anyone else;</li>
          <li>try to access other people&apos;s accounts or data, or probe, scan or attack our systems;</li>
          <li>
            abuse the service, for example by automated scraping of the app, bypassing usage limits
            such as the daily meal scan limit, or overloading our servers;
          </li>
          <li>
            try to make Noura produce harmful, unlawful or off topic content, or to reveal its
            internal instructions;
          </li>
          <li>upload content you do not have the right to share, or that is unlawful or offensive.</li>
        </ul>

        <h2>6. Your content</h2>
        <p>
          You keep ownership of what you put into Flax, such as logs, messages and photos. You give
          us permission to store and process it only as needed to provide Flax to you, as described
          in the Privacy Policy.
        </p>

        <h2>7. Our content</h2>
        <p>
          Flax, including its design, software, food catalogue and text, belongs to {SITE.operator}.
          You may use it for your own personal, non commercial purposes. Do not copy, resell or
          republish it without our written permission.
        </p>

        <h2>8. Availability and changes</h2>
        <p>
          Flax is currently free. We work to keep it available and accurate, but it is provided
          &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without guarantees that it will be
          uninterrupted or error free. We may change, add or remove features, or introduce paid
          features in future, and we will give reasonable notice of any change that significantly
          affects you.
        </p>

        <h2>9. Suspension and termination</h2>
        <p>
          You can stop using Flax and delete your account at any time. We may suspend or close an
          account that breaks these terms or puts other users or the service at risk.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, {SITE.operator} is not liable for any indirect or
          consequential loss, or for any loss arising from reliance on nutrition values, targets,
          AI output or suggestions in Flax. Nothing in these terms limits liability that cannot be
          limited by law.
        </p>

        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. We will update the date at the top, and for
          significant changes we will let you know in the app or by email. Continuing to use Flax
          after a change means you accept the updated terms.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria. If you live
          elsewhere you keep any protections the law of your country gives you.
        </p>

        <h2>13. Contact</h2>
        <p>Questions about these terms: {mail}.</p>
      </Prose>
    </SiteShell>
  );
};

export default TermsPage;
