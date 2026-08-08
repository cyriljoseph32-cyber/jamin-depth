"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Dictionary } from "@/content/i18n";
import {
  validateRecovery,
  hasErrors,
  isLikelySpam,
  type Errors,
  type RecoveryInput,
} from "@/lib/validation";
import { buildWaLink, buildMailto, recoverySummary } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";
import { TextField, TextArea, Honeypot } from "./Field";
import { FormStatus, type Status } from "./FormStatus";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/Icons";

type Field = keyof RecoveryInput | "depth" | "conditions";

export function RecoveryForm({ dict }: { dict: Dictionary }) {
  const C = dict.forms;
  const L = C.labels;
  const P = C.placeholders;

  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    contact: "",
    object: "",
    location: "",
    lostAt: "",
    depth: "",
    conditions: "",
  });
  const [errors, setErrors] = useState<Errors<keyof RecoveryInput>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [waHref, setWaHref] = useState<string | undefined>();
  const [photoName, setPhotoName] = useState<string | undefined>();
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef<number>(Date.now());

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isLikelySpam(honeypot, Date.now() - mountedAt.current)) {
      setStatus("error");
      setStatusMsg(C.spamError);
      return;
    }

    const input: RecoveryInput = {
      name: values.name,
      contact: values.contact,
      object: values.object,
      location: values.location,
      lostAt: values.lostAt,
    };
    const found = validateRecovery(input, C.validation);
    setErrors(found);
    if (hasErrors(found)) {
      setStatus("error");
      setStatusMsg(C.errorGeneric);
      return;
    }

    const summary = recoverySummary(
      { ...input, depth: values.depth, conditions: values.conditions },
      dict.wa,
    );
    const href = buildWaLink(summary);
    setWaHref(href);
    setStatus("success");
    setStatusMsg(undefined);
    track("form_submit", { form: "recovery" });

    // Open WhatsApp in a new tab. If the browser blocks it, the success card
    // exposes the same link as a button.
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  const emailHref = buildMailto(
    `Recovery request — ${values.object || "lost item"}`,
    recoverySummary(
      {
        name: values.name,
        contact: values.contact,
        object: values.object,
        location: values.location,
        lostAt: values.lostAt,
        depth: values.depth,
        conditions: values.conditions,
      },
      dict.wa,
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5">
      <Honeypot value={honeypot} onChange={setHoneypot} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="name"
          label={L.name}
          placeholder={P.name}
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => set("name", e.target.value)}
          copy={C}
        />
        <TextField
          id="contact"
          label={L.contact}
          placeholder={P.contact}
          inputMode="tel"
          value={values.contact}
          error={errors.contact}
          onChange={(e) => set("contact", e.target.value)}
          copy={C}
        />
      </div>

      <TextField
        id="object"
        label={L.object}
        placeholder={P.object}
        value={values.object}
        error={errors.object}
        onChange={(e) => set("object", e.target.value)}
        copy={C}
      />

      <TextField
        id="location"
        label={L.location}
        placeholder={P.location}
        value={values.location}
        error={errors.location}
        onChange={(e) => set("location", e.target.value)}
        copy={C}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="lostAt"
          label={L.lostAt}
          placeholder={P.lostAt}
          value={values.lostAt}
          error={errors.lostAt}
          onChange={(e) => set("lostAt", e.target.value)}
          copy={C}
        />
        <TextField
          id="depth"
          label={L.depth}
          placeholder={P.depth}
          optional
          value={values.depth}
          onChange={(e) => set("depth", e.target.value)}
          copy={C}
        />
      </div>

      <TextArea
        id="conditions"
        label={L.conditions}
        placeholder={P.conditions}
        optional
        rows={3}
        value={values.conditions}
        onChange={(e) => set("conditions", e.target.value)}
        copy={C}
      />

      <div>
        <span className="mb-2 flex items-baseline justify-between gap-2">
          <label htmlFor="photo" className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-sand">
            {L.photo}
          </label>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-sand-dim">
            {C.optional}
          </span>
        </span>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoName(e.target.files?.[0]?.name)}
          className="block w-full text-sm text-foam-dim file:mr-4 file:cursor-pointer file:border file:border-foam/20 file:bg-blueblack file:px-4 file:py-2 file:font-mono file:text-[0.66rem] file:uppercase file:tracking-[0.12em] file:text-foam hover:file:border-signal"
        />
        {photoName ? (
          <p className="mt-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-signal">
            {photoName}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-foam-dim">{C.photoHelp}</p>
      </div>

      <FormStatus status={status} waHref={waHref} message={statusMsg} copy={C} />

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" variant="primary">
          <WhatsAppIcon width={18} height={18} />
          {C.submitRecovery}
        </Button>
        <a
          href={emailHref}
          className="font-mono text-xs uppercase tracking-[0.14em] text-foam-dim underline underline-offset-4 transition-colors hover:text-foam"
        >
          {C.emailFallback}
        </a>
      </div>
    </form>
  );
}
