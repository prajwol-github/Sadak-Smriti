"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { submitReport } from "@/app/[locale]/submit/actions";
import { Link } from "@/lib/i18n/navigation";
import { REPORT_LIMITS, REPORT_VEHICLES } from "@/lib/forms/report-constants";
import { INITIAL_REPORT_STATE, type DuplicateView, type ReportState, type ReportValues } from "@/lib/forms/report-state";

/**
 * The crash report form (docs/plans/report-a-crash.md section 3). One page, 5 short sections.
 * A plain <form> posting to a server action: it renders and posts without JavaScript, but the
 * anti-spam check (Cloudflare Turnstile) needs JavaScript, which a <noscript> notice explains.
 */

interface Props {
  districts: { id: string; name: string }[];
  months: readonly string[];
  today: { ad: string; bsYear: number; bsMonth: number; bsDay: number };
  siteKey: string;
  locale: "ne" | "en";
}

const digits = (n: number | string, locale: "ne" | "en") =>
  locale === "ne" ? String(n).replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)]) : String(n);

const inputCls = (bad: boolean) =>
  `h-12 w-full border bg-neutral-100 px-3 text-body text-ink ${bad ? "border-2 border-accent-700" : "border-neutral-500"}`;

/** True only after hydration, so JavaScript-only controls never appear dead without it. */
function useHydrated() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

export function ReportForm({ districts, months, today, siteKey, locale }: Props) {
  const t = useTranslations("Report.form");
  const e = useTranslations("Report.errors");
  const r = useTranslations("Report");
  const vt = useTranslations("Vehicle");
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, INITIAL_REPORT_STATE);

  if (state.status === "saved") return <Thanks state={state} />;

  const values: ReportValues = "values" in state ? state.values : {};
  const errors: Record<string, string> = state.status === "errors" ? state.errors : {};
  const v = (k: string, fallback = "") => (typeof values[k] === "string" ? (values[k] as string) : fallback);
  const err = (k: string) => (errors[k] ? e(errors[k] as never) : null);
  const chosenVehicles = new Set(Array.isArray(values.vehicles) ? values.vehicles : []);
  const years = Array.from({ length: REPORT_LIMITS.years + 1 }, (_, i) => today.bsYear - i);

  const fieldError = (id: string, k: string) =>
    err(k) ? <p id={`${id}-error`} className="mt-1.5 text-small font-semibold text-accent-700">{err(k)}</p> : null;
  const describedBy = (id: string, k: string, hint?: boolean) =>
    [hint ? `${id}-hint` : "", err(k) ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  const refusal = state.status === "refused" ? e(state.reason) : null;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="px-4 py-8 lg:px-8 lg:py-12">
      <div className="max-w-[720px]">
        <h1 className="text-[32px] lg:text-[44px]">{t("heading")}</h1>
        <p className="mt-3 text-body text-neutral-700">{t("intro")}</p>

        {(hasErrors || refusal) && (
          <p role="alert" className="mt-6 border-2 border-accent-700 bg-accent-100 px-4 py-3 text-body font-semibold">
            {refusal ?? t("fixErrors")}
          </p>
        )}

        {/* key: remount after each round trip so fields refill from what was sent */}
        <form key={JSON.stringify(state)} action={action} className="mt-8" noValidate>
          {state.status === "duplicates" && <Duplicates items={state.duplicates} locale={locale} />}

          {/* 1. When */}
          <Section n={1} title={t("whenHeading")}>
            <fieldset>
              <legend className="text-small font-semibold">
                {t("date")} <span className="font-normal text-neutral-700">· {t("required")}</span>
              </legend>
              <div className="mt-2 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                <Select name="bsYear" label={t("year")} defaultValue={v("bsYear", String(today.bsYear))} bad={!!errors.date}>
                  {years.map((y) => <option key={y} value={y}>{digits(y, locale)}</option>)}
                </Select>
                <Select name="bsMonth" label={t("month")} defaultValue={v("bsMonth", String(today.bsMonth))} bad={!!errors.date}>
                  {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
                <Select name="bsDay" label={t("day")} defaultValue={v("bsDay", String(today.bsDay))} bad={!!errors.date}>
                  {Array.from({ length: 32 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{digits(d, locale)}</option>)}
                </Select>
              </div>
              {fieldError("date", "date")}
            </fieldset>
            <details className="mt-3" open={!!v("adDate")}>
              <summary className="cursor-pointer text-small font-semibold underline underline-offset-4">{t("useAd")}</summary>
              <label htmlFor="adDate" className="mt-3 block text-small font-semibold">{t("adDate")}</label>
              <input id="adDate" name="adDate" type="date" max={today.ad} defaultValue={v("adDate")} className={`mt-1.5 ${inputCls(!!errors.date)}`} />
            </details>
            <label htmlFor="time" className="mt-5 block text-small font-semibold">
              {t("time")} <span className="font-normal text-neutral-700">{r("optional")}</span>
            </label>
            <input id="time" name="time" type="time" defaultValue={v("time")} aria-describedby={describedBy("time", "time")} className={`mt-1.5 max-w-[200px] ${inputCls(!!errors.time)}`} />
            {fieldError("time", "time")}
          </Section>

          {/* 2. Where */}
          <Section n={2} title={t("whereHeading")}>
            <label htmlFor="districtId" className="block text-small font-semibold">
              {t("district")} <span className="font-normal text-neutral-700">· {t("required")}</span>
            </label>
            <select id="districtId" name="districtId" required defaultValue={v("districtId")} aria-describedby={describedBy("districtId", "districtId")} className={`mt-1.5 ${inputCls(!!errors.districtId)}`}>
              <option value="">{t("chooseDistrict")}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {fieldError("districtId", "districtId")}
            <label htmlFor="placeName" className="mt-5 block text-small font-semibold">
              {t("placeName")} <span className="font-normal text-neutral-700">{r("optional")}</span>
            </label>
            <p id="placeName-hint" className="text-small text-neutral-700">{t("placeNameHint")}</p>
            <input id="placeName" name="placeName" maxLength={REPORT_LIMITS.placeName} defaultValue={v("placeName")} aria-describedby={describedBy("placeName", "placeName", true)} className={`mt-1.5 ${inputCls(!!errors.placeName)}`} />
            {fieldError("placeName", "placeName")}
          </Section>

          {/* 3. What happened */}
          <Section n={3} title={t("whatHeading")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Counter name="killed" label={t("killed")} hint={r("killedHint")} required={t("required")} defaultValue={v("killed")} error={err("killed")} />
              <Counter name="injured" label={t("injured")} hint={r("injuredHint")} defaultValue={v("injured", "0")} error={err("injured")} />
            </div>
            <fieldset className="mt-6">
              <legend className="text-small font-semibold">
                {t("vehicles")} <span className="font-normal text-neutral-700">{r("optional")}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {REPORT_VEHICLES.map((veh) => (
                  <label key={veh} className="relative">
                    <input type="checkbox" name="vehicles" value={veh} defaultChecked={chosenVehicles.has(veh)} className="peer sr-only" />
                    <span className="flex min-h-11 cursor-pointer items-center border-2 border-ink px-3.5 text-ui font-semibold peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      {vt(veh)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 text-small text-neutral-700">{r("estimateNote")}</p>
          </Section>

          {/* 4. How do you know */}
          <Section n={4} title={t("sourceHeading")}>
            <p className="text-small text-neutral-700">{t("sourceHint")}</p>
            {fieldError("source", "source")}
            <label htmlFor="sourceUrl" className="mt-4 block text-small font-semibold">{t("sourceUrl")}</label>
            <input id="sourceUrl" name="sourceUrl" type="url" inputMode="url" placeholder="https://" maxLength={REPORT_LIMITS.url} defaultValue={v("sourceUrl")} aria-describedby={describedBy("sourceUrl", "sourceUrl")} className={`mt-1.5 ${inputCls(!!errors.sourceUrl || !!errors.source)}`} />
            {fieldError("sourceUrl", "sourceUrl")}
            <label htmlFor="witness" className="mt-5 block text-small font-semibold">{t("witness")}</label>
            <p id="witness-hint" className="text-small text-neutral-700">{t("witnessHint")}</p>
            <textarea id="witness" name="witness" rows={4} maxLength={REPORT_LIMITS.witness} defaultValue={v("witness")} aria-describedby={describedBy("witness", "witness", true)} className={`mt-1.5 min-h-28 w-full border bg-neutral-100 p-3 text-body ${errors.witness || errors.source ? "border-2 border-accent-700" : "border-neutral-500"}`} />
            {fieldError("witness", "witness")}
          </Section>

          {/* 5. Contact (optional) */}
          <Section n={5} title={t("contactHeading")}>
            <label htmlFor="contact" className="block text-small font-semibold">
              {t("contact")} <span className="font-normal text-neutral-700">{r("optional")}</span>
            </label>
            <p id="contact-hint" className="text-small text-neutral-700">{t("contactHint")}</p>
            <input id="contact" name="contact" autoComplete="email" maxLength={REPORT_LIMITS.contact} defaultValue={v("contact")} aria-describedby={describedBy("contact", "contact", true)} className={`mt-1.5 ${inputCls(!!errors.contact)}`} />
            {fieldError("contact", "contact")}
          </Section>

          {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
          <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="border-t-2 border-ink pt-6">
            <noscript>
              <p className="mb-4 border-2 border-ink bg-surface px-4 py-3 text-small font-semibold">{t("noscript")}</p>
            </noscript>
            {siteKey && <Turnstile siteKey={siteKey} locale={locale} />}
            <button type="submit" name="choice" value={state.status === "duplicates" ? "new" : ""} disabled={pending} className="btn btn-primary mt-4 h-12 min-w-[240px] text-body disabled:opacity-60">
              {pending ? t("sending") : t("submit")} {!pending && "→"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-ink pb-8 pt-6">
      <h2 className="flex items-baseline gap-3 text-[22px] lg:text-h3">
        <span aria-hidden className="text-accent-600 tabular">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Select({ name, label, defaultValue, bad, children }: { name: string; label: string; defaultValue: string; bad: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={defaultValue} aria-label={label} className={inputCls(bad)}>{children}</select>
    </label>
  );
}

/** A number field; with JavaScript it gains 44px − / + buttons (the handoff's stepper). */
function Counter({ name, label, hint, required, defaultValue, error }: { name: string; label: string; hint: string; required?: string; defaultValue: string; error: string | null }) {
  const hydrated = useHydrated();
  const ref = useRef<HTMLInputElement>(null);
  const step = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.min(REPORT_LIMITS.count, Math.max(0, (Number(el.value) || 0) + d));
    el.value = String(next);
  };
  const t = useTranslations("Report");
  return (
    <div>
      <label htmlFor={name} className="block text-small font-semibold">
        {label} {required && <span className="font-normal text-neutral-700">· {required}</span>}
      </label>
      <p id={`${name}-hint`} className="text-small text-neutral-700">{hint}</p>
      <div className="mt-1.5 flex items-stretch">
        {hydrated && (
          <button type="button" onClick={() => step(-1)} aria-label={`${t("decrease")}: ${label}`} className="flex size-12 shrink-0 items-center justify-center border-2 border-r-0 border-ink text-[20px] font-extrabold">−</button>
        )}
        <input
          ref={ref} id={name} name={name} type="number" inputMode="numeric" min={0} max={REPORT_LIMITS.count} step={1}
          defaultValue={defaultValue} aria-describedby={`${name}-hint${error ? ` ${name}-error` : ""}`}
          className={`h-12 w-full min-w-0 border-2 bg-neutral-100 px-3 text-center text-[22px] font-extrabold tabular ${error ? "border-accent-700" : "border-ink"}`}
        />
        {hydrated && (
          <button type="button" onClick={() => step(1)} aria-label={`${t("increase")}: ${label}`} className="flex size-12 shrink-0 items-center justify-center border-2 border-l-0 border-ink text-[20px] font-extrabold">+</button>
        )}
      </div>
      {error && <p id={`${name}-error`} className="mt-1.5 text-small font-semibold text-accent-700">{error}</p>}
    </div>
  );
}

function Duplicates({ items, locale }: { items: DuplicateView[]; locale: "ne" | "en" }) {
  const r = useTranslations("Report");
  const t = useTranslations("Report.form");
  return (
    <section aria-labelledby="dup-h" className="mb-8 bg-accent-100 p-5 lg:p-8">
      <p className="label text-accent-800">{r("dupLabel")}</p>
      <h2 id="dup-h" className="mt-1.5 text-[22px] lg:text-h3">{r("dupHeading")}</h2>
      <ul className="mt-4 grid gap-3">
        {items.map((d) => {
          const title = d.title?.[locale === "ne" ? "np" : "en"] ?? d.title?.en ?? null;
          const place = d.place?.[locale === "ne" ? "np" : "en"] ?? d.place?.en ?? null;
          return (
            <li key={d.id} className="border-2 border-ink bg-bg p-4">
              <p className="text-small text-neutral-700">{d.dateLabel[locale]}</p>
              <p className="mt-1 text-body font-extrabold">{d.draft ? t("dupDraft") : title ?? place ?? t("dupDraft")}</p>
              <p className="mt-1 text-small">
                <b className="text-accent-700">{t("dupKilled", { count: digits(d.deaths, locale) })}</b>
                {" · "}{t("dupSources", { n: d.sources, count: digits(d.sources, locale) })}
              </p>
              <button type="submit" name="choice" value={`add:${d.id}`} className="btn btn-secondary mt-3 h-10 min-h-10">{r("dupYes")}</button>
            </li>
          );
        })}
      </ul>
      <button type="submit" name="choice" value="new" className="mt-4 min-h-11 text-ui font-semibold underline underline-offset-4">{r("dupNone")}</button>
    </section>
  );
}

function Thanks({ state }: { state: Extract<ReportState, { status: "saved" }> }) {
  const t = useTranslations("Report.form");
  return (
    <div className="px-4 py-12 lg:px-8 lg:py-16" role="status">
      <div className="max-w-[720px]">
        <h1 className="text-[32px] lg:text-[44px]">{t("thanksHeading")}</h1>
        <p className="mt-3 text-body">{state.kind === "add_source" ? t("thanksAdded") : t("thanksBody")}</p>
        <p className="mt-4 inline-block border-2 border-ink px-4 py-2 font-extrabold tabular">{t("reference", { ref: state.ref })}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="" className="btn btn-primary">{t("another")}</a>
          <Link href="/" className="btn btn-secondary">{t("home")}</Link>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; language?: string }) => string;
      remove: (id: string) => void;
    };
  }
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile, rendered explicitly so a remounted form gets a fresh widget and token. */
function Turnstile({ siteKey, locale }: { siteKey: string; locale: "ne" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    const draw = () => {
      if (ref.current && window.turnstile && !id) id = window.turnstile.render(ref.current, { sitekey: siteKey, language: locale === "ne" ? "ne" : "en" });
    };
    if (window.turnstile) draw();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = TURNSTILE_SRC;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", draw);
    }
    return () => {
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, locale]);
  return <div ref={ref} className="min-h-[65px]" />;
}
