"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top loading progress bar that provides instant visual feedback when switching pages.
 * Styled with Sadak Smriti's Modernist accent red (--color-accent).
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigatingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.documentElement.removeAttribute("data-navigating");
    };
  }, []);

  const completeProgress = useCallback(() => {
    if (!navigatingRef.current && !visible) return;
    navigatingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setProgress(100);
    completeTimerRef.current = setTimeout(() => {
      setVisible(false);
      document.documentElement.removeAttribute("data-navigating");
      completeTimerRef.current = setTimeout(() => {
        setProgress(0);
      }, 250);
    }, 150);
  }, [visible]);

  const startProgress = useCallback(() => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    navigatingRef.current = true;
    document.documentElement.setAttribute("data-navigating", "true");
    setVisible(true);
    setProgress(25);

    // Incrementally crawl forward while waiting for the new route
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        return prev + (85 - prev) * 0.25;
      });
    }, 200);

    // Fallback: reset after 10s if navigation stalls or cancels
    timeoutRef.current = setTimeout(() => {
      completeProgress();
    }, 10000);
  }, [completeProgress]);

  // Complete navigation when pathname or query parameters change
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // Left click only
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // Non-modified click only

      const target = (e.target as Element | null)?.closest("a");
      if (!target || !(target instanceof HTMLAnchorElement)) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;

      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(target.href, window.location.href);

        // Same-origin only
        if (targetUrl.origin !== currentUrl.origin) return;

        // Same path and query (only hash differs) -> skip
        if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
          return;
        }

        startProgress();
      } catch {
        // If URL parsing fails, ignore
      }
    };

    const handlePopState = () => {
      startProgress();
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, [startProgress]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease",
      }}
    >
      <div
        className="h-full bg-accent"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease-out",
          boxShadow: "0 0 8px var(--color-accent), 0 0 2px var(--color-accent)",
        }}
      />
    </div>
  );
}
