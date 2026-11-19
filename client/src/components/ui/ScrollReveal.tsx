"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

/*
  Fades and rises a block into view the first time it crosses into
  the viewport while scrolling. Runs once per element, scrolling back
  up and down again does not replay it, a landing page that keeps
  re-triggering on every scroll direction change reads as gimmicky
  rather than deliberate.

  Skips the animation entirely under prefers-reduced-motion, content
  is just there with no transition.

  Server rendering: the server cannot know the reduced motion setting,
  so the first client render must match the server (animated markup)
  or React hydration leaves the server's opacity: 0 in place and the
  content never shows. The plain, non animated version is swapped in
  only after mount, which is a normal update, not a hydration mismatch.
  The text itself is always present in the HTML, so crawlers read it
  whether or not any animation ever runs.
*/
const useSkipAnimation = (): boolean => {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted && !!reduceMotion;
};

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const ScrollReveal = ({
  children,
  delay = 0,
  className,
}: ScrollRevealProps) => {
  const skip = useSkipAnimation();

  if (skip) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.4, 0, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

/*
  Wraps a set of siblings, cards in a grid, numbered steps, so they
  reveal one after another instead of all at once. Use ScrollRevealGroup
  on the parent and ScrollRevealItem on each direct child, the group
  itself does not animate, it only tells its children when to start
  and how far apart to stagger.
*/
export const ScrollRevealGroup = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const skip = useSkipAnimation();

  if (skip) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.7 } },
      }}
    >
      {children}
    </motion.div>
  );
};

export const ScrollRevealItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const skip = useSkipAnimation();

  if (skip) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.85, ease: [0.4, 0, 0.2, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
};
