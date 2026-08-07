/**
 * Provider-agnostic event tracking — zero dependencies.
 *
 * Why not `@vercel/analytics`: it declares optional SvelteKit peer deps that
 * conflict with this project's vite/vitest tree and would force
 * `--legacy-peer-deps` on every install. This wrapper costs nothing, works
 * with whichever provider is actually installed, and no-ops safely when none
 * is — so the call sites never need to change.
 *
 * Supported sinks, in order:
 * - Vercel Web Analytics   → `window.va("event", …)`
 * - GA4 / Google Tag Manager → `window.dataLayer.push(…)`
 * - Plausible              → `window.plausible(…)`
 *
 * SETUP (no secrets in the codebase):
 * - Vercel: enable Web Analytics in the project dashboard. Custom events need
 *   a plan that includes them; page views work on any plan.
 * - GA4/GTM: add the tag via `NEXT_PUBLIC_GTM_ID` in your own snippet.
 * Nothing here reads or requires an API key.
 */

/** The events this site reports. Keep the union closed — typos are silent otherwise. */
export type AnalyticsEvent =
  | "whatsapp_click_hero"
  | "whatsapp_click_offer"
  | "whatsapp_click_floating"
  | "whatsapp_click_nav"
  | "form_submit"
  | "language_switch";

export type AnalyticsProps = Record<string, string | number | boolean>;

interface AnalyticsWindow {
  va?: (event: string, name: string, props?: AnalyticsProps) => void;
  dataLayer?: unknown[];
  plausible?: (name: string, opts?: { props: AnalyticsProps }) => void;
}

/**
 * Report an event. Safe to call anywhere: no-ops during SSR and when no
 * provider is loaded, and never throws into the click handler that called it.
 */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnalyticsWindow;

  try {
    w.va?.("event", event, props);
    w.dataLayer?.push({ event, ...props });
    w.plausible?.(event, { props });
  } catch {
    /* analytics must never break the interaction it is measuring */
  }
}

/** Attribute read by the delegated click listener — see `AnalyticsListener`. */
export const TRACK_ATTR = "data-analytics-event";

/**
 * Spread onto any server-rendered anchor to make it trackable without turning
 * it into a client component:
 *   <a {...trackable("whatsapp_click_hero", { locale })} …>
 */
export function trackable(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  return {
    [TRACK_ATTR]: event,
    "data-analytics-props": JSON.stringify(props),
  };
}
