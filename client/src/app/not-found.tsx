import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/public/SiteShell";

// Served with a real 404 status for any unknown URL.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const NotFound = () => (
  <SiteShell>
      <div className="text-center py-16">
        <p className="font-heading font-bold text-5xl text-pawpaw dark:text-black-pawpaw mb-3">404</p>
        <h1 className="font-heading font-bold text-xl md:text-2xl text-cocoa dark:text-dark-white mb-3">
          This page doesn&apos;t exist
        </h1>
        <p className="text-sm text-cocoa-faded mb-8">
          The link may be broken or the page may have moved.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 rounded-lg bg-moringa dark:bg-moringa-faded text-surface font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Go to homepage
          </Link>
          <Link
            href="/foods"
            className="px-6 py-3 rounded-lg bg-surface dark:bg-black-surface text-cocoa dark:text-dark-white font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
          >
            Browse food calories
          </Link>
        </div>
      </div>
  </SiteShell>
);

export default NotFound;
