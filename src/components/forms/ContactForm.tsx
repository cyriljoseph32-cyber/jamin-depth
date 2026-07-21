"use client";

import { useRef, useState, type FormEvent } from "react";
import { t } from "@/content/i18n";
import {
  validateContact,
  hasErrors,
  isLikelySpam,
  type Errors,
  type ContactInput,
} from "@/lib/validation";
import { buildWaLink, buildMailto, contactSummary } from "@/lib/whatsapp";
import { TextField, TextArea, Honeypot } from "./Field";
import { FormStatus, type Status } from "./FormStatus";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/Icons";

export function ContactForm() {
  const L = t.forms.labels;
  const P = t.forms.placeholders;

  const [values, setValues] = useState<ContactInput>({ name: "", contact: "", message: "" });
  const [errors, setErrors] = useState<Errors<keyof ContactInput>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [waHref, setWaHref] = useState<string | undefined>();
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef<number>(Date.now());

  function set(field: keyof ContactInput, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isLikelySpam(honeypot, Date.now() - mountedAt.current)) {
      setStatus("error");
      setStatusMsg(t.forms.spamError);
      return;
    }

    const found = validateContact(values);
    setErrors(found);
    if (hasErrors(found)) {
      setStatus("error");
      setStatusMsg(t.forms.errorGeneric);
      return;
    }

    const href = buildWaLink(contactSummary(values));
    setWaHref(href);
    setStatus("success");
    setStatusMsg(undefined);
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  const emailHref = buildMailto(
    `Message from ${values.name || "the website"}`,
    contactSummary(values),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5">
      <Honeypot value={honeypot} onChange={setHoneypot} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="c-name"
          label={L.name}
          placeholder={P.name}
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <TextField
          id="c-contact"
          label={L.contact}
          placeholder={P.contact}
          inputMode="tel"
          value={values.contact}
          error={errors.contact}
          onChange={(e) => set("contact", e.target.value)}
        />
      </div>

      <TextArea
        id="c-message"
        label={L.message}
        placeholder={P.message}
        rows={5}
        value={values.message}
        error={errors.message}
        onChange={(e) => set("message", e.target.value)}
      />

      <FormStatus status={status} waHref={waHref} message={statusMsg} />

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" variant="primary">
          <WhatsAppIcon width={18} height={18} />
          {t.forms.submitContact}
        </Button>
        <a
          href={emailHref}
          className="font-mono text-xs uppercase tracking-[0.14em] text-foam-dim underline underline-offset-4 transition-colors hover:text-foam"
        >
          {t.forms.emailFallback}
        </a>
      </div>
    </form>
  );
}
