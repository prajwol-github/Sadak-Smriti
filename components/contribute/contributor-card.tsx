import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Contributor } from "@/lib/contributors/schema";

/**
 * A contributor in the /contribute grid: square greyscale photo (or a striped tile with an
 * initial, as on memorial cards), name in both scripts, roles, and their own links.
 * Photos are files on our own server (SPEC 12.2).
 */
export async function ContributorPhoto({ c, size, className = "" }: { c: Contributor; size: number; className?: string }) {
  const locale = (await getLocale()) as "ne" | "en";
  const name = locale === "ne" && c.name.ne ? c.name.ne : c.name.en;
  return c.photo ? (
    <Image src={c.photo} alt="" width={size} height={size} unoptimized className={`grayscale-photo block aspect-square w-full object-cover ${className}`} />
  ) : (
    <span aria-hidden className={`stripes block aspect-square w-full p-3 text-[56px] font-extrabold leading-none text-neutral-500 ${className}`}>
      {Array.from(name)[0]}
    </span>
  );
}

export async function ContributorLinks({ c }: { c: Contributor }) {
  const t = await getTranslations("Contribute");
  const links = [
    c.github && { href: `https://github.com/${c.github}`, label: t("github") },
    c.linkedin && { href: c.linkedin, label: t("linkedin") },
    c.website && { href: c.website, label: t("website") },
  ].filter(Boolean) as { href: string; label: string }[];
  if (!links.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer me" className="inline-flex min-h-11 items-center text-small font-semibold">
            {l.label} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

export async function ContributorCard({ c }: { c: Contributor }) {
  const t = await getTranslations("Contribute");
  const locale = (await getLocale()) as "ne" | "en";
  const name = locale === "ne" && c.name.ne ? c.name.ne : c.name.en;
  const other = locale === "ne" ? c.name.en : c.name.ne;
  return (
    <li className="min-w-0">
      <Link href={`/contribute/${c.handle}`} aria-label={t("openProfile", { name })} className="group block no-underline">
        <span className="block border-2 border-transparent group-hover:border-ink">
          <ContributorPhoto c={c} size={400} />
        </span>
        <span className="mt-3 flex items-baseline gap-2">
          <span className="text-body font-extrabold leading-tight group-hover:underline">{name}</span>
          {c.sample && <span className="tag border border-neutral-500 px-1.5 py-0 text-[10px] text-neutral-700">{t("sample")}</span>}
        </span>
        {other && <span className="block text-small text-neutral-700">{other}</span>}
        <span className="mt-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-neutral-700">
          {c.roles.map((r) => t(`roles.${r}`)).join(" · ")}
        </span>
      </Link>
      <ContributorLinks c={c} />
    </li>
  );
}
