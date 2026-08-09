import { SITE, tel } from "@/content/site";
import type { Locale, Dictionary } from "@/content/i18n";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "@/components/forms/ContactForm";
import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";
import { WhatsAppIcon, PhoneIcon, InstagramIcon, FacebookIcon, ArrowIcon } from "@/components/ui/Icons";

export function ContactPage({ dict }: { dict: Dictionary; locale: Locale }) {
  const c = dict.contact;
  return (
    <>
      <PageHeader kicker={c.heroKicker} title={c.heroTitle} lead={c.heroLead} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Direct lines */}
          <div className="space-y-8">
            <Reveal>
              <Kicker>{c.directTitle}</Kicker>
              <div className="mt-6 space-y-3">
                <a
                  href={buildWaLink(recoveryPrefill(dict.wa))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-4 rounded-[var(--radius)] border border-signal/30 bg-signal/10 p-5 transition-colors hover:bg-signal/15"
                >
                  <span className="flex items-center gap-3">
                    <WhatsAppIcon width={22} height={22} />
                    <span>
                      <span className="block font-mono text-[0.62rem] uppercase tracking-[0.2em] text-sand">
                        {c.whatsappLabel}
                      </span>
                      <span className="block font-display text-2xl text-foam">{SITE.phoneInternationalDisplay}</span>
                    </span>
                  </span>
                  <ArrowIcon className="text-signal transition-transform group-hover:translate-x-1" />
                </a>

                <a
                  href={tel}
                  className="group flex items-center justify-between gap-4 rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-5 transition-colors hover:border-foam/30"
                >
                  <span className="flex items-center gap-3">
                    <PhoneIcon width={22} height={22} />
                    <span>
                      <span className="block font-mono text-[0.62rem] uppercase tracking-[0.2em] text-sand">
                        {c.phoneLabel}
                      </span>
                      <span className="block font-display text-2xl text-foam">{SITE.phoneDisplay}</span>
                    </span>
                  </span>
                  <ArrowIcon className="transition-transform group-hover:translate-x-1" />
                </a>

                <a
                  href={`mailto:${SITE.email}`}
                  className="group flex items-center justify-between gap-4 rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-5 transition-colors hover:border-foam/30"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="grid h-[22px] w-[22px] place-items-center font-mono text-lg">@</span>
                    <span>
                      <span className="block font-mono text-[0.62rem] uppercase tracking-[0.2em] text-sand">
                        {c.emailLabel}
                      </span>
                      <span className="block font-display text-2xl text-foam">{SITE.email}</span>
                    </span>
                  </span>
                  <ArrowIcon className="transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </Reveal>

            <Reveal>
              <Kicker>{c.followTitle}</Kicker>
              <div className="mt-5 flex gap-3">
                <a
                  href={SITE.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-foam/15 px-4 py-3 text-sm text-foam-dim transition-colors hover:border-signal hover:text-foam"
                >
                  <InstagramIcon width={18} height={18} /> {SITE.social.instagramHandle}
                </a>
                <a
                  href={SITE.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook — Underwater Samui Recovery"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-foam/15 px-4 py-3 text-sm text-foam-dim transition-colors hover:border-signal hover:text-foam"
                >
                  <FacebookIcon width={18} height={18} /> Facebook
                </a>
              </div>
            </Reveal>

            <Reveal>
              <Kicker>{c.locationTitle}</Kicker>
              <p className="mt-4 font-display text-3xl text-foam">{SITE.location}</p>
              <p className="mt-2 max-w-sm text-sm text-foam-dim">{c.locationNote}</p>
            </Reveal>
          </div>

          {/* Form */}
          <Reveal delay={80}>
            <div className="rounded-[var(--radius)] border border-foam/10 bg-abyss-2/40 p-6 sm:p-8">
              <Kicker>{c.formKicker}</Kicker>
              <h2 className="mt-4 text-3xl sm:text-4xl">{c.formTitle}</h2>
              <p className="mt-3 text-sm text-foam-dim">{c.formLead}</p>
              <div className="mt-7">
                <ContactForm dict={dict} />
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
