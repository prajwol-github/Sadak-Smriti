"use client";

import { useRef, useSyncExternalStore } from "react";

/**
 * A horizontal row of cards. Scrolling and snapping are plain CSS, so it works by swipe or
 * scroll without JavaScript; the previous / next buttons appear once JavaScript has loaded
 * (never as dead controls). Motion respects reduced-motion settings.
 */
export function Carousel({ label, previous, next, children }: { label: string; previous: string; next: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  const move = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 lg:scroll-px-8 lg:px-8">
        {children}
      </ul>
      {hydrated && (
        <div className="flex gap-2 px-4 lg:px-8">
          <button type="button" onClick={() => move(-1)} aria-label={previous} className="flex size-11 items-center justify-center border-2 border-ink text-[18px] font-extrabold hover:bg-ink hover:text-bg">
            ←
          </button>
          <button type="button" onClick={() => move(1)} aria-label={next} className="flex size-11 items-center justify-center border-2 border-ink text-[18px] font-extrabold hover:bg-ink hover:text-bg">
            →
          </button>
        </div>
      )}
    </div>
  );
}
