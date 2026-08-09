"use client";

import { useEffect } from "react";
import { track, TRACK_ATTR, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

/**
 * One delegated click listener for the whole document.
 *
 * This is why the conversion CTAs can stay server components: instead of
 * wrapping every WhatsApp link in a client component, links carry
 * `data-analytics-event` (see `trackable()`) and this single listener reports
 * them. Zero per-link JavaScript, and it keeps working for links rendered
 * after mount.
 */
export function AnalyticsListener() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      const el = target?.closest?.(`[${TRACK_ATTR}]`);
      if (!el) return;

      const event = el.getAttribute(TRACK_ATTR) as AnalyticsEvent | null;
      if (!event) return;

      let props: AnalyticsProps = {};
      try {
        props = JSON.parse(el.getAttribute("data-analytics-props") ?? "{}") as AnalyticsProps;
      } catch {
        /* malformed props must not stop the event */
      }
      track(event, props);
    }

    // Capture phase: the event is recorded even if a handler stops propagation.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
