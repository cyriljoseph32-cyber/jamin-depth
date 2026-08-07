import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Dictionary } from "@/content/i18n";

/** Just the slice of copy the fields need — keeps the prop surface small. */
export type FormsCopy = Dictionary["forms"];

const fieldBase =
  "w-full rounded-[var(--radius)] border bg-blueblack/60 px-4 py-3 text-foam placeholder:text-foam-dim/50 outline-none transition-colors focus:border-signal";

function Label({
  htmlFor,
  label,
  optional,
  copy,
}: {
  htmlFor: string;
  label: string;
  optional?: boolean;
  copy: FormsCopy;
}) {
  return (
    <span className="mb-2 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-sand">
        {label}
      </label>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-sand-dim">
        {optional ? copy.optional : copy.required}
      </span>
    </span>
  );
}

export function TextField({
  id,
  label,
  optional,
  error,
  copy,
  ...rest
}: { id: string; label: string; optional?: boolean; error?: string; copy: FormsCopy } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={id} label={label} optional={optional} copy={copy} />
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldBase} ${error ? "border-error" : "border-foam/15"}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  id,
  label,
  optional,
  error,
  copy,
  ...rest
}: { id: string; label: string; optional?: boolean; error?: string; copy: FormsCopy } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <Label htmlFor={id} label={label} optional={optional} copy={copy} />
      <textarea
        id={id}
        name={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldBase} resize-y ${error ? "border-error" : "border-foam/15"}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Visually-hidden honeypot. Real users never see or fill it. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="company">Company (leave blank)</label>
      <input
        id="company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
