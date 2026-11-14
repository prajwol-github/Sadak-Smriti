"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";

/** "नेपाली / EN": the current language in bold; the other one links to the same page (PLAN P0-05). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const item = (code: "ne" | "en", label: string) =>
    code === locale ? (
      <span aria-current="true" className="font-extrabold">{label}</span>
    ) : (
      <Link href={pathname} locale={code} hrefLang={code} lang={code} aria-label={t("switchLanguageLabel")} className="font-normal no-underline opacity-70 hover:opacity-100">
        {label}
      </Link>
    );
  return (
    <span className={`inline-flex min-h-11 items-center gap-1.5 text-small font-semibold ${className}`}>
      {item("ne", "नेपाली")}
      <span aria-hidden>/</span>
      {item("en", "EN")}
    </span>
  );
}
