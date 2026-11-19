import Link from "next/link";
import { SITE } from "@/lib/site";

/*
  Plain crawlable links to every public page. Search engines discover
  and weigh pages by internal links, so every public page, including
  the landing page, carries this row.
*/
const FOOTER_LINKS = [
  { label: "Nigerian food calories", href: "/foods/nigeria" },
  { label: "Ghanaian food calories", href: "/foods/ghana" },
  { label: "All foods", href: "/foods" },
  { label: "Calorie calculator", href: "/tools/calorie-calculator" },
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export const PublicFooterLinks = () => (
  <nav aria-label="Footer" className="mb-5">
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
      {FOOTER_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="text-xs md:text-sm text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white transition-colors"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

export const Copyright = () => (
  <p className="text-xs md:text-sm text-cocoa-faded">
    Copyright © {new Date().getFullYear()} {SITE.operator}
  </p>
);
