import { defineRouting } from "next-intl/routing";

/**
 * Every public URL carries its language: /ne/... and /en/... (SPEC 6.1).
 * Nepali is the default; visitors from Nepal are sent to /ne even when their
 * browser asks for English (see proxy.ts).
 */
export const routing = defineRouting({
  locales: ["ne", "en"],
  defaultLocale: "ne",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
