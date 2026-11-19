import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNavbar } from "./PublicNavbar";
import { Copyright, PublicFooterLinks } from "./PublicFooterLinks";

/*
  Layout for every public content page that is not the landing page:
  foods, tools, about and legal. Same brand gradient, navbar style and
  colors as the landing page, so the site reads as one product.
*/
/*
  The brand gradient is painted on the page itself, not on a separate
  strip, so there is no edge anywhere: it ends on exactly the page color
  (#F6F1E7 light, #171410 dark) and then simply continues as that color.
*/
export const SiteShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-off-white dark:bg-dark-bg bg-page-gradient dark:bg-page-gradient-dark bg-no-repeat bg-[length:100%_900px] font-body flex flex-col">
    <PublicNavbar variant="site" />
    <main id="main" className="flex-1 w-full max-w-5xl mx-auto px-5 md:px-8 pt-28 md:pt-36 pb-16">
      {children}
    </main>
    <footer className="py-10 px-6 text-center border-t border-cocoa/5 dark:border-dark-white/5">
      <PublicFooterLinks />
      <Copyright />
    </footer>
  </div>
);

export const Breadcrumbs = ({ items }: { items: { name: string; path: string }[] }) => (
  <nav aria-label="Breadcrumb" className="mb-5">
    <ol className="flex flex-wrap items-center gap-1.5 text-xs text-cocoa-faded">
      {items.map((item, i) => (
        <li key={item.path} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {i === items.length - 1 ? (
            <span aria-current="page" className="text-cocoa dark:text-dark-white font-medium">
              {item.name}
            </span>
          ) : (
            <Link href={item.path} className="hover:underline underline-offset-2">
              {item.name}
            </Link>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export const SignupCta = ({
  title = "Track this the easy way",
  body = "Log Nigerian and West African dishes in seconds, scan your plate with Noura, and hit your calorie and water goals. Free.",
}: {
  title?: string;
  body?: string;
}) => (
  <section className="mt-12 bg-moringa dark:bg-moringa-faded/50 rounded-2xl p-8 text-center">
    <h2 className="font-heading font-bold text-lg md:text-2xl text-surface mb-2">{title}</h2>
    <p className="text-xs md:text-sm text-surface/80 max-w-xl mx-auto mb-6 leading-relaxed">{body}</p>
    <Link
      href="/register"
      className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-pawpaw dark:bg-black-pawpaw text-surface font-semibold text-sm hover:opacity-90 transition-opacity"
    >
      Get started free
    </Link>
  </section>
);
