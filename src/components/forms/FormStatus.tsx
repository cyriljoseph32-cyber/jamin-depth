import { t } from "@/content/i18n";
import { CheckIcon, WhatsAppIcon } from "@/components/ui/Icons";

export type Status = "idle" | "error" | "success";

/** aria-live status region shared by both forms. */
export function FormStatus({
  status,
  waHref,
  message,
}: {
  status: Status;
  waHref?: string;
  message?: string;
}) {
  if (status === "idle") return null;

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[var(--radius)] border border-signal/40 bg-signal/10 p-5"
      >
        <p className="flex items-center gap-2 font-display text-xl uppercase text-foam">
          <CheckIcon width={20} height={20} />
          {t.forms.successTitle}
        </p>
        <p className="mt-2 text-sm text-foam-dim">{t.forms.successBody}</p>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-signal px-5 py-3 font-mono text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:bg-signal-600"
          >
            <WhatsAppIcon width={16} height={16} />
            {t.forms.successOpenWhatsApp}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-[var(--radius)] border border-signal/50 bg-blueblack p-4"
    >
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-signal">{t.forms.errorTitle}</p>
      <p className="mt-1 text-sm text-foam-dim">{message ?? t.forms.errorGeneric}</p>
    </div>
  );
}
