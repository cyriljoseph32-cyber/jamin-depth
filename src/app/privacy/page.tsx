import type { Metadata } from "next";
import { SITE, tel } from "@/content/site";
import { t } from "@/content/i18n";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/ui/Section";
import { buildWaLink } from "@/lib/whatsapp";

export const metadata: Metadata = pageMetadata({
  title: t.meta.privacy.title,
  description: t.meta.privacy.description,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        kicker="Privacy"
        title="Privacy, kept simple."
        lead="We collect as little as possible, and we don't track you around the web. Here's exactly what happens with the information you share."
      />
      <Section>
        <div className="max-w-2xl space-y-8 text-foam-dim">
          <div>
            <h2 className="text-2xl text-foam">What we collect</h2>
            <p className="mt-3">
              Only what you type into the recovery or contact form — your name, a way to reach you, and the
              details of your request. There are no accounts, no logins and no hidden fields.
            </p>
          </div>
          <div>
            <h2 className="text-2xl text-foam">How it&apos;s used</h2>
            <p className="mt-3">
              The form builds a message and opens it in WhatsApp (or your email app) so <em>you</em> send it to
              us directly. Nothing is stored on this website and nothing is sent to a third-party server by the
              form itself. Once you message us, our conversation lives in WhatsApp or email under their own terms.
            </p>
          </div>
          <div>
            <h2 className="text-2xl text-foam">Tracking &amp; cookies</h2>
            <p className="mt-3">
              No advertising trackers and no analytics cookies are set by default. Fonts are self-hosted, so your
              visit isn&apos;t shared with third parties just for loading the page.
            </p>
          </div>
          <div>
            <h2 className="text-2xl text-foam">Photos</h2>
            <p className="mt-3">
              If you pick a photo in the recovery form, it stays on your device — it&apos;s only used to help you
              confirm the right file before you attach it yourself in the chat.
            </p>
          </div>
          <div>
            <h2 className="text-2xl text-foam">Questions</h2>
            <p className="mt-3">
              Reach us any time on{" "}
              <a
                href={buildWaLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal underline underline-offset-4"
              >
                WhatsApp
              </a>{" "}
              or by phone at{" "}
              <a href={tel} className="text-signal underline underline-offset-4">
                {SITE.phoneInternationalDisplay}
              </a>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
