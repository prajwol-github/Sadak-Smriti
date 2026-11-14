"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmCode, startSetup } from "@/app/[locale]/account/two-factor/actions";
import type { TwoFactorState } from "@/lib/auth/two-factor-state";

/**
 * Setting up and confirming the authenticator app (ADR 0006). Two server actions: startSetup
 * returns the QR code, the key and the backup codes once; confirmCode checks a code and opens
 * the review area.
 */
export function TwoFactorForm({ hasApp, locale }: { hasApp: boolean; locale: string }) {
  const t = useTranslations("TwoFactor");
  const [setup, start, starting] = useActionState(startSetup, { step: hasApp ? "code" : "start" } as TwoFactorState);
  const [check, confirm, confirming] = useActionState(confirmCode, { step: "code" } as TwoFactorState);

  if (setup.step === "start") {
    return (
      <>
        <h1 className="text-[32px] lg:text-[44px]">{t("setupTitle")}</h1>
        <p className="mt-3 text-body text-neutral-700">{t("setupIntro")}</p>
        {setup.error && <Alert>{t("error")}</Alert>}
        <form action={start} className="mt-8">
          <button type="submit" disabled={starting} className="btn btn-primary h-12 min-w-[240px] text-body disabled:opacity-60">{t("start")} →</button>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[32px] lg:text-[44px]">{setup.step === "scan" ? t("setupTitle") : t("title")}</h1>
      {setup.step === "scan" && setup.qr && (
        <section className="mt-6">
          <p className="text-body">{t("scan")}</p>
          <Qr rows={setup.qr} label={t("qrLabel")} />
          <p className="label mt-4 text-neutral-700">{t("key")}</p>
          <p className="break-all font-mono text-body font-semibold">{setup.secret?.match(/.{1,4}/g)?.join(" ")}</p>
          {setup.backupCodes && (
            <div className="mt-6 border-2 border-ink p-4">
              <h2 className="text-h4">{t("backupTitle")}</h2>
              <p className="mt-1 text-small text-neutral-700">{t("backupNote")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-body">
                {setup.backupCodes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
      <p className="mt-6 text-body text-neutral-700">{t("codeIntro")}</p>
      {check.error && <Alert>{t(check.error === "wrong" ? "wrongCode" : check.error === "locked" ? "locked" : "error")}</Alert>}
      <form action={confirm} className="mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="block text-small font-semibold">{t("codeLabel")}</span>
          <input
            name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required
            className="mt-1.5 h-12 w-40 border border-neutral-500 bg-neutral-100 px-3 font-mono text-[22px] tracking-[0.2em] text-ink"
          />
        </label>
        <button type="submit" disabled={confirming} className="btn btn-primary h-12 text-body disabled:opacity-60">{t("confirm")} →</button>
      </form>
    </>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-6 border-2 border-accent-700 bg-accent-100 px-4 py-3 text-body font-semibold">{children}</p>;
}

/** The QR code as SVG squares, with a quiet zone of 4 modules. Always dark on white for scanners. */
function Qr({ rows, label }: { rows: string[]; label: string }) {
  const n = rows.length + 8;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} className="mt-4 block size-56 bg-white" shapeRendering="crispEdges">
      {rows.flatMap((row, r) => [...row].map((m, c) => (m === "1" ? <rect key={`${r}-${c}`} x={c + 4} y={r + 4} width={1} height={1} fill="#000" /> : null)))}
    </svg>
  );
}
