import type { ReactNode } from "react";

/*
  Long form text styling for About and the legal pages, in the brand
  palette. Plain Tailwind arbitrary variants, no typography plugin.
*/
export const Prose = ({ children }: { children: ReactNode }) => (
  <div
    className="
      bg-surface dark:bg-black-surface rounded-2xl shadow-sm p-6 md:p-10
      text-sm md:text-[15px] leading-relaxed text-cocoa dark:text-dark-white/90
      [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-lg [&_h2]:md:text-xl
      [&_h2]:text-cocoa [&_h2]:dark:text-dark-white [&_h2]:mt-9 [&_h2]:mb-3 [&_h2:first-child]:mt-0
      [&_h3]:font-heading [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2
      [&_p]:mb-4
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5
      [&_a]:text-moringa [&_a]:dark:text-moringa-faded [&_a]:underline [&_a]:underline-offset-2
      [&_strong]:font-semibold
    "
  >
    {children}
  </div>
);

export const PageHeader = ({ title, lead, updated }: { title: ReactNode; lead?: ReactNode; updated?: string }) => (
  <header className="mb-8">
    <h1 className="font-heading font-bold text-2xl md:text-4xl text-cocoa dark:text-dark-white leading-tight mb-3">
      {title}
    </h1>
    {lead && <p className="text-sm md:text-base text-cocoa dark:text-dark-white/90 leading-relaxed max-w-3xl">{lead}</p>}
    {updated && (
      <p className="text-xs text-cocoa-faded mt-3">
        Last updated:{" "}
        <time dateTime={updated}>
          {new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </time>
      </p>
    )}
  </header>
);
