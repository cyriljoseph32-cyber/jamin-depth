import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";
import type { Dictionary } from "@/content/i18n";
import { WhatsAppIcon } from "@/components/ui/Icons";

/**
 * Persistent WhatsApp action. Fixed bottom-right, respects safe-area insets,
 * and never overlaps the main content (pages reserve bottom padding).
 * Works on desktop and mobile — a normal anchor to wa.me.
 */
export function WhatsAppFab({ dict }: { dict: Dictionary }) {
  return (
    <a
      href={buildWaLink(recoveryPrefill(dict.wa))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={dict.nav.fabAria}
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-signal py-3 pl-3 pr-4 text-ink shadow-lg shadow-black/40 transition-transform duration-200 hover:scale-[1.03] focus-visible:scale-[1.03]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span
          aria-hidden
          className="sonar-ring absolute inset-0 rounded-full bg-ink/20"
        />
        <WhatsAppIcon width={22} height={22} />
      </span>
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em]">
        WhatsApp
      </span>
    </a>
  );
}
