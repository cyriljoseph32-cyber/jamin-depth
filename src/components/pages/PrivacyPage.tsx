import { SITE, tel } from "@/content/site";
import type { Locale, Dictionary } from "@/content/i18n";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/ui/Section";
import { buildWaLink } from "@/lib/whatsapp";

export function PrivacyPage({ dict }: { dict: Dictionary; locale: Locale }) {
  const p = dict.privacy;
  return (
    <>
      <PageHeader kicker={p.heroKicker} title={p.heroTitle} lead={p.heroLead} />
      <Section>
        <div className="max-w-2xl space-y-8 text-foam-dim">
          {p.sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-2xl text-foam">{section.title}</h2>
              <p className="mt-3">{section.body}</p>
            </div>
          ))}

          <div>
            <h2 className="text-2xl text-foam">{p.questionsTitle}</h2>
            <p className="mt-3">
              {p.questionsBefore}
              <a
                href={buildWaLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal underline underline-offset-4"
              >
                WhatsApp
              </a>
              {p.questionsBetween}
              <a href={tel} className="text-signal underline underline-offset-4">
                {SITE.phoneInternationalDisplay}
              </a>
              {p.questionsAfter}
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
