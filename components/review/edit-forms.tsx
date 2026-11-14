"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addLink, publish, removePersonForm, saveFacts, savePersonForm } from "@/app/[locale]/review/crashes/actions";
import { IDLE, type EditState } from "@/lib/forms/edit-state";

/**
 * The staff crash editor's forms (ADR 0008). Server actions return an EditState; these show the
 * result and the error under each field, and keep what was typed. After a save the page is
 * refreshed, so the `version` props change; the hidden version input follows, and the reason box
 * (keyed by version) clears.
 */

export interface CrashFormData {
  id: string; version: number; titleEn: string; titleNp: string; occurredOn: string; occurredTime: string; placeNameEn: string; placeNameNp: string;
  districtId: string; deaths: number; injured: number | null; vehicles: string[];
}
export interface PersonFormData {
  id: string; version: number; status: string; nameEn: string; nameNp: string; age: number | null; sex: string; roadUser: string;
  hometownText: string; nameVisibility: string; publication: string;
}

const VEHICLES = ["bus", "microbus", "jeep", "car", "truck", "tipper", "tanker", "tractor", "motorcycle", "scooter", "e_rickshaw", "bicycle", "other"] as const;
const ROAD_USERS = ["driver", "passenger", "pedestrian", "rider", "pillion", "cyclist"] as const;
const inputCls = (bad: boolean) => `h-12 w-full border bg-neutral-100 px-3 text-body text-ink ${bad ? "border-2 border-accent-700" : "border-neutral-500"}`;

/** What the person typed if the last save was refused, otherwise the saved value (React 19 resets a form after its action). */
function typed(state: EditState, name: string, fallback: string): string {
  const v = state.values?.[name];
  return v === undefined ? fallback : Array.isArray(v) ? (v[0] ?? fallback) : v;
}
function typedList(state: EditState, name: string, fallback: string[]): string[] {
  const v = state.values?.[name];
  return v === undefined ? fallback : Array.isArray(v) ? v : [v];
}

function useEdit(action: (prev: EditState, fd: FormData) => Promise<EditState>) {
  return useActionState(action, IDLE);
}

function Banner({ state }: { state: EditState }) {
  const t = useTranslations("Edit");
  if (state.status === "saved") return <p role="status" className="mt-4 border-2 border-ink bg-neutral-100 px-4 py-2 text-small font-semibold">{t("saved")}</p>;
  if (state.status === "conflict") return <p role="alert" className="mt-4 border-2 border-accent-700 bg-accent-100 px-4 py-2 text-small font-semibold">{t("conflict")}</p>;
  if (state.status === "refused") return <p role="alert" className="mt-4 border-2 border-accent-700 bg-accent-100 px-4 py-2 text-small font-semibold">{t(`refused.${state.refusal ?? "not_permitted"}` as never)}</p>;
  if (state.status === "invalid") return <p role="alert" className="mt-4 border-2 border-accent-700 bg-accent-100 px-4 py-2 text-small font-semibold">{t("invalidSummary")}</p>;
  return null;
}

function Field({ name, label, state, children, hint }: { name: string; label: string; state: EditState; children: (p: { bad: boolean; describedBy?: string }) => React.ReactNode; hint?: string }) {
  const t = useTranslations("Edit");
  const code = state.status === "invalid" ? state.errors?.[name] : undefined;
  const errId = code ? `${name}-err` : undefined;
  return (
    <label className="block">
      <span className="block text-small font-semibold">{label}</span>
      {children({ bad: !!code, describedBy: errId })}
      {hint && <span className="mt-1 block text-meta text-neutral-700">{hint}</span>}
      {code && <span id={errId} className="mt-1 block text-small font-semibold text-accent-700">{t(`error.${code}` as never)}</span>}
    </label>
  );
}

function ReasonField({ state, version, label }: { state: EditState; version: number; label: string }) {
  return (
    <Field name="reason" label={label} state={state}>
      {({ bad, describedBy }) => (
        <input key={version} name="reason" defaultValue={typed(state, "reason", "")} required minLength={3} maxLength={300} aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`} />
      )}
    </Field>
  );
}

// --- Crash facts ----------------------------------------------------------------------------

export function CrashFactsForm({ crash, districts }: { crash: CrashFormData; districts: { id: string; name: string }[] }) {
  const t = useTranslations("Edit");
  const vt = useTranslations("Vehicle");
  const [state, action, pending] = useEdit(saveFacts);
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, defaultValue?: string | number | null, hint?: string) => (
    <Field name={name} label={label} state={state} hint={hint}>
      {({ bad, describedBy }) => <input name={name} defaultValue={typed(state, name, defaultValue == null ? "" : String(defaultValue))} aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`} {...props} />}
    </Field>
  );
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="crashId" value={crash.id} />
      <input type="hidden" name="version" value={crash.version} />
      <div className="grid gap-4 sm:grid-cols-2">
        {input("titleEn", t("titleEn"), { maxLength: 200 }, crash.titleEn)}
        {input("titleNp", t("titleNp"), { maxLength: 200, lang: "ne" }, crash.titleNp)}
        {input("occurredOn", t("date"), { type: "date", required: true }, crash.occurredOn)}
        {input("occurredTime", t("time"), { type: "time" }, crash.occurredTime)}
        {input("placeNameEn", t("placeEn"), { maxLength: 200 }, crash.placeNameEn)}
        {input("placeNameNp", t("placeNp"), { maxLength: 200, lang: "ne" }, crash.placeNameNp)}
        <Field name="districtId" label={t("district")} state={state}>
          {({ bad, describedBy }) => (
            <select name="districtId" defaultValue={typed(state, "districtId", crash.districtId)} aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {input("deaths", t("deaths"), { inputMode: "numeric", required: true }, crash.deaths)}
          {input("injured", t("injured"), { inputMode: "numeric" }, crash.injured)}
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="text-small font-semibold">{t("vehicles")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {VEHICLES.map((v) => (
            <label key={v} className="cursor-pointer">
              <input type="checkbox" name="vehicles" value={v} defaultChecked={typedList(state, "vehicles", crash.vehicles).includes(v)} className="peer sr-only" />
              <span className="flex min-h-11 items-center border-2 border-ink px-3.5 text-ui font-semibold peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">{vt(v)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 max-w-xl"><ReasonField state={state} version={crash.version} label={t("reason")} /></div>
      <Banner state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary mt-4 h-12 text-body disabled:opacity-60">{pending ? t("saving") : t("save")} →</button>
    </form>
  );
}

// --- Public or draft ------------------------------------------------------------------------

export function PublishForm({ crashId, version, isPublic }: { crashId: string; version: number; isPublic: boolean }) {
  const t = useTranslations("Edit");
  const [state, action, pending] = useEdit(publish);
  return (
    <form action={action} className="mt-3 max-w-xl">
      <input type="hidden" name="crashId" value={crashId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="publish" value={isPublic ? "false" : "true"} />
      <ReasonField state={state} version={version} label={t("reason")} />
      {state.status === "invalid" && state.errors?.publish && <p role="alert" className="mt-2 text-small font-semibold text-accent-700">{t(`error.${state.errors.publish}` as never)}</p>}
      <Banner state={state} />
      <button type="submit" disabled={pending} className={`btn ${isPublic ? "btn-secondary" : "btn-primary"} mt-3 h-11 disabled:opacity-60`}>{isPublic ? t("unpublish") : t("publish")}</button>
    </form>
  );
}

// --- A news link ----------------------------------------------------------------------------

export function AddLinkForm({ crashId, version }: { crashId: string; version: number }) {
  const t = useTranslations("Edit");
  const [state, action, pending] = useEdit(addLink);
  return (
    <form action={action} className="mt-3 max-w-xl">
      <input type="hidden" name="crashId" value={crashId} />
      <Field name="url" label={t("link")} state={state}>
        {({ bad, describedBy }) => <input key={version} name="url" type="url" defaultValue={typed(state, "url", "")} required maxLength={2000} placeholder="https://" aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`} />}
      </Field>
      <div className="mt-3"><ReasonField state={state} version={version} label={t("reason")} /></div>
      <Banner state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary mt-3 h-11 disabled:opacity-60">{t("addLink")}</button>
    </form>
  );
}

// --- A person -------------------------------------------------------------------------------

export function PersonForm({ crashId, person, crashVersion }: { crashId: string; person?: PersonFormData; crashVersion: number }) {
  const t = useTranslations("Edit");
  const rt = useTranslations("RoadUser");
  const [state, action, pending] = useEdit(savePersonForm);
  const p = person;
  const text = (name: string, label: string, def: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field name={name} label={label} state={state}>
      {({ bad, describedBy }) => <input name={name} defaultValue={typed(state, name, def)} aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`} {...props} />}
    </Field>
  );
  const select = (name: string, label: string, def: string, options: [string, string][], optional = false) => (
    <Field name={name} label={label} state={state}>
      {({ bad, describedBy }) => (
        <select name={name} defaultValue={typed(state, name, def)} aria-invalid={bad} aria-describedby={describedBy} className={`mt-1.5 ${inputCls(bad)}`}>
          {optional && <option value="">{t("notSet")}</option>}
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </Field>
  );
  const version = p?.version ?? crashVersion;
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="crashId" value={crashId} />
      {p && <input type="hidden" name="personId" value={p.id} />}
      {p && <input type="hidden" name="version" value={p.version} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {select("status", t("statusField"), p?.status ?? "killed", [["killed", t("personStatus.killed")], ["injured", t("personStatus.injured")], ["uninjured", t("personStatus.uninjured")]])}
        {text("age", t("age"), p?.age == null ? "" : String(p.age), { inputMode: "numeric" })}
        {text("nameEn", t("nameEn"), p?.nameEn ?? "", { maxLength: 120 })}
        {text("nameNp", t("nameNp"), p?.nameNp ?? "", { maxLength: 120, lang: "ne" })}
        {select("sex", t("sex"), p?.sex ?? "", [["female", t("sexOption.female")], ["male", t("sexOption.male")], ["other", t("sexOption.other")]], true)}
        {select("roadUser", t("roadUser"), p?.roadUser ?? "", ROAD_USERS.map((r) => [r, rt(r)] as [string, string]), true)}
        {text("hometownText", t("hometown"), p?.hometownText ?? "", { maxLength: 200 })}
        {select("nameVisibility", t("nameVisibility"), p?.nameVisibility ?? "public", [["public", t("visibility.public")], ["hidden", t("visibility.hidden")]])}
        {select("publication", t("publicationField"), p?.publication ?? "draft", [["draft", t("personPublication.draft")], ["published", t("personPublication.published")]])}
      </div>
      <label className="mt-3 flex items-start gap-2.5 text-small">
        <input type="checkbox" name="familyAskedToShow" defaultChecked={state.values?.familyAskedToShow !== undefined} className="mt-1 size-5 accent-ink" />
        <span>{t("familyAsked")}<span className="block text-meta text-neutral-700">{t("childNote")}</span></span>
      </label>
      <div className="mt-4 max-w-xl"><ReasonField state={state} version={version} label={t("reason")} /></div>
      <Banner state={state} />
      <button type="submit" disabled={pending} className={`btn ${p ? "btn-secondary" : "btn-primary"} mt-3 h-11 disabled:opacity-60`}>{p ? t("savePerson") : t("addPersonButton")}</button>
    </form>
  );
}

export function RemovePersonForm({ crashId, personId, version }: { crashId: string; personId: string; version: number }) {
  const t = useTranslations("Edit");
  const [state, action, pending] = useEdit(removePersonForm);
  return (
    <form action={action} className="mt-3 max-w-xl border-t border-neutral-400 pt-3">
      <input type="hidden" name="crashId" value={crashId} />
      <input type="hidden" name="personId" value={personId} />
      <ReasonField state={state} version={version} label={t("reason")} />
      <p className="mt-1 text-meta text-neutral-700">{t("removeNote")}</p>
      <Banner state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary mt-3 h-10 min-h-10 disabled:opacity-60">{t("remove")}</button>
    </form>
  );
}
