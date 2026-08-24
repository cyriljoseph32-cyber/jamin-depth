import { SITE } from "./site";

/**
 * All user-facing copy for the English locale.
 * Externalised so French / Thai dictionaries can be added later without
 * touching components (see i18n.ts). Written native, concise, conversion-first.
 * No invented services, credentials, prices, reviews or guarantees.
 */
export const en = {
  meta: {
    home: {
      title: "Diving in Koh Samui — Courses, Fun Dives & Underwater Recovery",
      description:
        "Dive the Gulf of Thailand from Koh Samui with a local PADI instructor — courses with Discovery Divers, fun dives to Sail Rock and beyond, plus professional underwater recovery when something's lost in the water.",
      keywords: [
        "diving Koh Samui",
        "PADI diving courses Koh Samui",
        "learn to dive Koh Samui",
        "diver Koh Samui",
        "underwater recovery Koh Samui",
        "lost item recovery Koh Samui",
      ],
    },
    baptism: {
      title: "Discover Scuba Diving in Koh Samui — your first dive",
      description:
        "Your first dive in Koh Samui: Discover Scuba Diving over one day, no experience and no certification needed, equipment included. Taught by a PADI instructor, in English or French.",
      keywords: [
        "discover scuba diving Koh Samui",
        "first dive Koh Samui",
        "try diving Koh Samui",
        "beginner diving Koh Samui",
      ],
    },
    recovery: {
      title: "Underwater Recovery — Lost Item Recovery",
      description:
        "Dropped a phone, ring or camera in the sea around Koh Samui? Send the details and we'll assess a possible recovery — from beach, boat or certain waterfall zones.",
      keywords: [
        "underwater recovery Koh Samui",
        "lost item recovery Koh Samui",
        "lost ring recovery",
        "lost phone in sea Koh Samui",
      ],
    },
    diving: {
      title: "Diving in Koh Samui",
      description:
        "Dive the Gulf of Thailand from Koh Samui with a local diver who knows the water. PADI courses with Discovery Divers — Discover Scuba, Open Water and beyond. Honest, personal, respectful of the sea.",
      keywords: [
        "diving Koh Samui",
        "diver Koh Samui",
        "dive Koh Samui",
        "PADI diving courses Koh Samui",
        "learn to dive Koh Samui",
      ],
    },
    about: {
      title: "About the Diver",
      description:
        "A local Koh Samui diver behind Jammin's Depths — underwater recovery and diving, driven by the water and a direct, human way of working.",
      keywords: ["diver Koh Samui", "underwater recovery Koh Samui"],
    },
    contact: {
      title: "Contact — WhatsApp & Phone",
      description:
        "Reach Jammin's Depths in Koh Samui by WhatsApp or phone for underwater recovery and diving. Fast, direct, local.",
      keywords: ["underwater recovery Koh Samui contact", "diver Koh Samui"],
    },
    privacy: {
      title: "Privacy",
      description: "How Jammin's Depths handles the little information you share. No tracking by default.",
    },
  },

  nav: {
    requestRecovery: "Request a Recovery",
    exploreDiving: "Explore Diving",
    askDiving: "Ask about diving",
    whatsapp: "WhatsApp",
    call: "Call",
    menu: "Menu",
    close: "Close",
    /** Link labels for each page, keyed by the route keys in routes.ts. */
    pages: {
      home: "Home",
      diving: "Diving",
      baptism: "Discover Scuba Diving",
      recovery: "Recovery",
      about: "About",
      contact: "Contact",
      privacy: "Privacy",
    },
    skipToContent: "Skip to content",
    fabAria: "Request a recovery on WhatsApp",
    languageLabel: "Language",
    /** Names are written in their own language, as language names should be. */
    languageNames: { fr: "Français", en: "English" },
  },

  /**
   * Photo captions and alt text. These used to sit hardcoded in the components,
   * which meant the French pages captioned their photos in English.
   *
   * Dive-site names come from the owner — none of these files carries GPS, so a
   * site is never inferred from the image.
   */
  media: {
    divers: {
      label: "Safety stop · Chumphon Pinnacle",
      alt: "Four divers holding the mooring line at their safety stop, the surface bright above them, at Chumphon Pinnacle",
    },
    platax: {
      label: "Batfish · Sail Rock",
      alt: "A school of batfish hanging in open blue water at Sail Rock",
    },
    turtle: {
      label: "Hawksbill turtle · Tanote Bay",
      alt: "A hawksbill turtle resting against hard coral on the reef at Tanote Bay",
    },
    fusiliers: {
      label: "Fusiliers · Sail Rock",
      alt: "A school of yellow fusiliers over the reef at Sail Rock",
    },
    reef: {
      label: "Reef life",
      alt: "Colourful nudibranch on the reef in the Gulf of Thailand",
    },
    barracuda: {
      label: "Into the blue",
      alt: "A large school of barracuda in the blue",
    },
    divingCard: {
      label: "Diving · Gulf of Thailand",
      alt: "Three scuba divers in midwater above a reef in the Gulf of Thailand, one giving a hand signal",
    },
  },

  home: {
    heroKicker: "Diving · Underwater Recovery · Koh Samui",
    heroTitle: "Dive the Gulf of Thailand with someone who knows the water.",
    heroSlogan: SITE.slogan,
    heroLead:
      "Personal PADI courses and fun dives out of Koh Samui — to the Gulf of Thailand's best sites like Sail Rock, honest and unhurried. Plus professional underwater recovery when something's gone over the side.",
    recoveryLink: "Lost something in the water? Underwater recovery",
    /** "French spoken" is owner-confirmed — the diver speaks French fluently. */
    badges: ["PADI courses", "Fun dives", "French spoken", "Koh Samui"],
    worldsKicker: "Two worlds, one diver",
    worldsTitle: "Diving when you're ready. Recovery when it matters.",
    recoveryCardTitle: "Underwater Recovery",
    recoveryCardBody:
      "Professional search and recovery of lost objects in the water — from a boat, near a beach, or in certain waterfall zones. Methodical, calm, honest about what's possible.",
    recoveryCardCta: "How recovery works",
    divingCardTitle: "Diving",
    divingCardBody:
      "Accompanied diving with someone who knows this water. A real underwater experience, respectful of the sea — and answers to your questions before you go in.",
    divingCardCta: "Explore diving",
    reassuranceKicker: "Why people call",
    reassuranceTitle: "Panic, meet method.",
    reassuranceItems: [
      {
        title: "A clear process",
        body: "You tell us what, where and when. We assess feasibility honestly before anything gets wet — no false promises.",
      },
      {
        title: "Direct contact",
        body: "You talk to the diver, not a call centre. One message on WhatsApp and the conversation starts.",
      },
      {
        title: "Local intervention",
        body: "Based in Koh Samui and working these waters. Local knowledge is half the recovery.",
      },
    ],
    galleryCta: "Start a recovery request",
    galleryKicker: "From the water",
    galleryTitle: "Real dives, real recoveries.",
    galleryNote:
      "Real dives in the Gulf of Thailand — Sail Rock, Chumphon Pinnacle, Tanote Bay. Nothing here is stock or staged.",
    finalKicker: "Ready when you are",
    finalTitle: "You drop it. We dive for it.",
    finalBody:
      "The sooner we know, the better the odds. Send the details now — it costs nothing to ask.",
  },

  recovery: {
    heroKicker: "Underwater Recovery",
    heroTitle: "Dropped it in the water? Let's get it back.",
    heroLead:
      "Phones, rings, keys, cameras, sunglasses, tools — things go over the side or slip off in a second. Tell us what happened and we'll tell you, honestly, whether a recovery is worth attempting.",
    casesKicker: "What we look for",
    casesTitle: "Common cases",
    cases: [
      {
        title: "Dropped from a boat",
        body: "Over the side while cruising, anchored or boarding. Depth and current shape what's possible.",
      },
      {
        title: "Lost near a beach",
        body: "In the shallows, off a pier or in the surf line where the sand keeps shifting.",
      },
      {
        title: "Gone in the water",
        body: "Slipped off a finger or wrist while swimming, snorkelling or playing in the sea.",
      },
      {
        title: "Certain waterfall zones",
        body: "Some accessible pools and waterfall areas — strictly subject to safety, access and conditions.",
      },
    ],
    honestNote:
      "Straight talk: we can't promise to recover every object. Water moves things, visibility varies, and some spots aren't safe or accessible. We'll always tell you what's realistic before we commit.",
    processKicker: "How it works",
    processTitle: "Four steps, no drama",
    steps: [
      {
        n: "01",
        title: "Contact",
        body: "Message us on WhatsApp with the basics. The faster we hear, the fresher the trail.",
      },
      {
        n: "02",
        title: "Locate & information",
        body: "We gather the details — object, exact spot, time, depth, conditions and a photo if you have one.",
      },
      {
        n: "03",
        title: "Assessment",
        body: "We weigh feasibility, safety and access, then tell you honestly what a recovery attempt looks like.",
      },
      {
        n: "04",
        title: "Possible intervention",
        body: "If it's realistic and safe, we plan and dive. If it isn't, you'll know why — no wasted time.",
      },
    ],
    formKicker: "Recovery request",
    formTitle: "Send the details",
    formLead:
      "Fill this in and we'll open WhatsApp with everything laid out — or send it by email instead. The more precise the location and timing, the better your odds.",
    responsibleNote:
      "Any intervention depends on conditions, safety, site access and any authorisations required. Nothing here is a guarantee of recovery.",
  },

  diving: {
    heroKicker: "Diving · Gulf of Thailand · Koh Samui",
    heroTitle: "Dive the Gulf of Thailand with someone who knows the water.",
    heroLead:
      "Not a conveyor-belt dive centre. A personal, honest way into the Gulf of Thailand's underwater world — diving out of Koh Samui, at your pace and on your questions.",
    experienceKicker: "The experience",
    experienceTitle: "Quiet, close, real.",
    experienceBody:
      "Diving here is about presence — the light coming through the surface, the drop of the blue, the small life you only notice when you slow down. We keep it personal and unhurried, and we meet you where you're at.",
    prepKicker: "Before you go in",
    prepTitle: "Simple preparation",
    prep: [
      {
        title: "Rest and hydrate",
        body: "Arrive rested, well hydrated and sober. Small things make a big difference underwater.",
      },
      {
        title: "Talk it through first",
        body: "Tell us your experience and comfort level. There's no wrong answer — it shapes the dive.",
      },
      {
        title: "Mind the conditions",
        body: "Weather, current and visibility decide the day. We'd rather move a dive than force one.",
      },
    ],
    respectKicker: "Dive with respect",
    respectTitle: "The sea isn't ours to take from.",
    respectBody:
      "Look, don't touch. Take nothing but pictures, leave nothing behind. Keep off the reef, keep your distance from marine life, and let the water stay exactly as wild as it is.",
    ctaTitle: "Curious about diving here?",
    ctaBody: "Ask anything — conditions, experience needed, how a day looks. One message and we'll talk.",

    coursesKicker: "Learn to dive",
    coursesTitle: "PADI courses — with Discovery Divers",
    coursesIntro:
      "Want a certification, not just a taster? Courses run with Discovery Divers Koh Samui — a PADI 5-Star centre and the island's longest-running dive shop (25+ years) — where the diver behind Jammin's Depths teaches. Same water, same honest, unhurried approach.",
    coursesDisclaimer:
      "Courses are booked and run through Discovery Divers. Scuba equipment is included; prices are per person, subject to change and confirmed at booking.",
    coursesCtaLabel: "See courses & prices",
    courseCta: "Ask about this course",
    tripCta: "Ask about this trip",
    coursesPriceFrom: "from",
    certBadge: "Certification",
    noCertBadge: "No certification",
    /**
     * PADI course lineup offered with Discovery Divers Koh Samui.
     * Prices are owner-provided (Discovery Divers' current rates); update the
     * `priceFrom` strings if they change. Specialty is left "on request".
     */
    courses: [
      {
        code: "DSD",
        name: "Discover Scuba Diving",
        cert: false,
        duration: "1 day",
        summary:
          "A guided first breath underwater — no experience and no certification needed. The simplest way to find out if diving is for you.",
        priceFrom: "฿5,850",
      },
      {
        code: "OW",
        name: "Open Water",
        cert: true,
        duration: "3–4 days",
        summary:
          "The core entry-level certification. Learn the skills to plan and make your own dives, over three or four days.",
        priceFrom: "฿17,900",
      },
      {
        code: "AOW",
        name: "Advanced Open Water",
        cert: true,
        duration: "2 days",
        summary:
          "Five adventure dives across two days — including a Deep dive and Underwater Navigation, plus three you choose.",
        priceFrom: "฿13,900",
      },
      {
        code: "SPEC",
        name: "Specialty courses",
        cert: true,
        duration: "Varies",
        summary:
          "Go deeper on what you love — from navigation to deep and more. Ask what's running and we'll point you the right way.",
        priceFrom: undefined as string | undefined,
      },
    ],

    tripsKicker: "Already certified?",
    tripsTitle: "Fun dives & day trips.",
    tripsIntro:
      "Got your card? Jump on the boat with Discovery Divers to the region's best water — the famous Sail Rock pinnacle, Koh Tao and Chumphon — or just come along to snorkel.",
    tripsNote:
      "Prices are per person with Discovery Divers — equipment included, subject to change and confirmed at booking.",
    trips: [
      { name: "Sail Rock", detail: "Fun dive", price: "฿4,550" },
      { name: "Koh Tao", detail: "2 dives", price: "฿4,850" },
      { name: "Chumphon Pinnacle", detail: "Certified divers", price: "฿5,050" },
      { name: "Snorkelling", detail: "All sites", price: "฿2,450" },
    ],
  },

  /**
   * "Why dive with us" — every claim here is verifiable in the repo:
   * the PADI instructor role and Discovery Divers partnership come from
   * site.ts, French is owner-confirmed, and the direct-contact and
   * respect-for-the-sea points restate existing about/diving copy.
   * Do NOT add group sizes, transfers, boats or safety claims — unverified.
   */
  /**
   * Discover Scuba landing page — the highest-volume beginner search.
   * Everything factual on it is pulled from `diving.courses[0]`, the courses
   * disclaimer, `why` and `faq`. The copy below adds framing only, never new
   * facts: no inclusions, transfers, group sizes or swimming requirements.
   */
  baptism: {
    heroKicker: "First dive · Koh Samui",
    heroTitle: "Your first dive in Koh Samui.",
    heroLead:
      "Never breathed underwater before? Discover Scuba Diving is made exactly for that — one day, no experience, no certification, guided from start to finish.",
    whatKicker: "What it is",
    whatTitle: "One day, no prerequisites.",
    includedTitle: "What's confirmed",
    ctaKicker: "Ready to try",
    ctaTitle: "Book your first dive.",
    ctaBody: "Tell us your dates and how many of you there are — we'll take it from there.",
    seeAllCourses: "See all PADI courses",
  },

  why: {
    kicker: "Why dive with us",
    title: "Four reasons, all checkable.",
    lead: "No badges, no invented statistics — only what can actually be verified.",
    items: [
      {
        title: "A PADI instructor",
        body: "Your courses are taught by a PADI instructor at Discovery Divers Koh Samui, not by a rotating seasonal guide.",
      },
      {
        title: "A PADI 5-Star centre",
        body: "Courses and trips run with Discovery Divers — the island's longest-operating dive shop, 25+ years on this water.",
      },
      {
        title: "French and English",
        body: "Book, ask questions and dive in French or English. You're never guessing at a briefing in a language you half-follow.",
      },
      {
        title: "Straight to the diver",
        body: "One WhatsApp message reaches the person who will actually be in the water with you. No agency, no call centre.",
      },
    ],
  },

  /**
   * Real messages from real divers, quoted verbatim from WhatsApp.
   *
   * Two rules govern this block, and both are enforced in code, not by memory:
   *
   * 1. `consent: false` means NOT PUBLISHED. The component renders only entries
   *    with `consent: true`, and the whole section disappears when none has it.
   *    These are private messages: the sender wrote them to the diver, not to
   *    the internet. Flip the flag once you have actually asked the person —
   *    a WhatsApp "ok pour que je le mette sur le site ?" is enough, and it
   *    takes one line each.
   * 2. First names only, and never an address, a date of birth or a phone
   *    number. A testimonial needs a voice, not an identity.
   *
   * `quote` is the sender's own wording, kept as they typed it — including the
   * loose punctuation. Tidying a testimonial into marketing prose is how it
   * stops sounding real.
   */
  /**
   * Surrounding copy only. The quotes themselves live in `testimonials.ts`,
   * deliberately outside the dictionary — see the comment there.
   */
  testimonials: {
    kicker: "In their words",
    title: "What divers wrote afterwards.",
  },

  /**
   * FAQ. `confirmed: false` marks an answer the owner still has to supply —
   * those render a visible [TO CONFIRM] badge and are deliberately EXCLUDED
   * from the FAQPage structured data, so Google never sees a placeholder.
   */
  faq: {
    kicker: "Before you book",
    title: "Beginners' questions.",
    lead: "The things people ask most before a first dive around Koh Samui.",
    toConfirm: "To be confirmed by the owner",
    items: [
      {
        q: "Can I dive if I have never dived before?",
        a: "Yes. Discover Scuba Diving is exactly that — a guided first breath underwater over one day, with no experience and no certification needed. From ฿5,850, scuba equipment included.",
        confirmed: true,
      },
      {
        q: "Do I need to know how to swim?",
        a: "Swimming requirements depend on the course and the day's conditions. Ask on WhatsApp before booking and you'll get a straight answer.",
        confirmed: true,
      },
      {
        q: "What should I bring?",
        a: "Scuba equipment is included with Discovery Divers, so you don't need to rent gear. Bring sun protection, water, and anything personal you like to dive with — ask on WhatsApp if there's anything specific you're unsure about.",
        confirmed: true,
      },
      {
        q: "Where do the dives take place from Koh Samui?",
        a: "Trips run with Discovery Divers to the region's best water: the Sail Rock pinnacle, Koh Tao and Chumphon Pinnacle, plus snorkelling at all sites.",
        confirmed: true,
      },
      {
        q: "How do I book?",
        a: "Message us on WhatsApp with your level, how many of you there are and your dates. Courses and trips are then booked and run through Discovery Divers.",
        confirmed: true,
      },
      {
        q: "What happens if the weather doesn't allow the trip?",
        a: "Weather, current and visibility decide the day, and we'd rather move a dive than force one. If that happens, we sort out a new date or a refund directly with you — no small print, just a conversation.",
        confirmed: true,
      },
      {
        q: "What's the cancellation policy if I need to pull out?",
        a: "Free cancellation up to 24h before departure (a 5% fee applies if you paid by card or PayPal). Under 24h, or a no-show at the meeting point, the trip is charged in full — the space, the gear and the staff's time are already committed. Rescheduling stays possible depending on availability, for ฿2,000 per person.",
        confirmed: true,
      },
      {
        q: "Can I fly right after diving?",
        a: "Never on the same day as a dive. Wait at least 18h before any activity at altitude, flights included — in practice, a flight after 8am the next morning is fine. This is a strict safety rule against decompression sickness, not a suggestion.",
        confirmed: true,
      },
    ],
  },

  /**
   * Recovery FAQ. Same shape as `faq`, so it goes through the same component
   * and the same `faqJsonLd`.
   *
   * Every answer is a rewording of copy already on the recovery page —
   * `honestNote`, `heroLead`, `cases` and the four `steps`. Nothing new is
   * claimed here, which matters twice over: a FAQPage must reflect content
   * visible on the page, and the brief forbids inventing terms.
   */
  faqRecovery: {
    kicker: "Before you ask",
    title: "Recovery questions.",
    lead: "What people want to know before sending a recovery request.",
    toConfirm: "To be confirmed by the owner",
    items: [
      {
        q: "Can you guarantee you'll recover a lost item?",
        a: "No — we can't promise to recover every object. Water moves things, visibility varies, and some spots aren't safe or accessible. We'll always tell you honestly what's realistic before we commit.",
        confirmed: true,
      },
      {
        q: "What kind of items can you recover?",
        a: "Phones, rings, keys, cameras, sunglasses, tools and more — dropped from a boat, lost near a beach, slipped off in the water while swimming or snorkelling, or lost in certain accessible waterfall zones.",
        confirmed: true,
      },
      {
        q: "How does a recovery request work?",
        a: "Four steps: message us on WhatsApp with the basics, we gather the details — object, exact spot, time, depth and conditions — then we weigh feasibility, safety and access, and if it's realistic we plan and dive. If it isn't, you'll know why.",
        confirmed: true,
      },
      {
        q: "How fast should I get in touch after losing something?",
        a: "As soon as you can. The faster we hear, the fresher the trail — currents and shifting sand work against you from the moment it goes in.",
        confirmed: true,
      },
      {
        q: "Where around Koh Samui do you carry out recoveries?",
        a: "From a boat — cruising, anchored or boarding — in the shallows near a beach, off a pier or in the surf line, and in certain accessible waterfall pools. Always subject to safety, access and conditions.",
        confirmed: true,
      },
    ],
  },

  about: {
    heroKicker: "About",
    heroTitle: "A local diver, doing it directly.",
    heroLead:
      "Jammin's Depths is built around one thing: knowing the water around Koh Samui well enough to help — whether that's getting a lost object back or taking you under for the first time.",
    storyTitle: "The short version",
    storyBody:
      "It started the way most of it does around here — time in the water, a love for what's under the surface, and neighbours asking for help when something went overboard. That turned into a service: calm, methodical recovery, and diving shared the honest way. You deal with the diver directly, start to finish.",
    valuesTitle: "How we work",
    values: [
      { title: "Human", body: "Real conversation, no scripts. You talk to the person who dives." },
      { title: "Local", body: "Koh Samui waters, known first-hand. Local knowledge does the heavy lifting." },
      { title: "Honest", body: "We tell you what's possible before we start, not after." },
    ],
    /**
     * Background. The Discovery Divers affiliation below is the owner-provided,
     * verified fact used to feature diving courses. Adjust wording as preferred;
     * add further roles/experience only when confirmed.
     */
    credentialsTitle: "Background",
    credentialsNote:
      "PADI instructor at Discovery Divers Koh Samui — a PADI 5-Star Dive Center and the island's longest-running dive shop. Diving courses are taught and booked through Discovery Divers; underwater recovery is Jammin's Depths' own work.",
    portraitCaption: "The diver · Gulf of Thailand",
  },

  contact: {
    heroKicker: "Contact",
    heroTitle: "Talk to the diver.",
    heroLead:
      "The fastest way to reach us is WhatsApp. Message any time with what happened, or a question about diving — we'll take it from there.",
    directTitle: "Direct lines",
    whatsappLabel: "WhatsApp",
    phoneLabel: "Phone",
    emailLabel: "Email",
    followTitle: "Follow the work",
    locationTitle: "Based in",
    locationNote: "Working the waters around Koh Samui. No walk-in address — everything starts with a message.",
    formKicker: "Send a message",
    formTitle: "Prefer a form?",
    formLead:
      "Write below and we'll open WhatsApp with your message ready to send — or send it by email instead.",
  },

  forms: {
    labels: {
      name: "Your name",
      contact: "Phone / WhatsApp / Email",
      object: "What did you lose?",
      location: "Exact location",
      lostAt: "Approximate date & time",
      depth: "Estimated depth (if known)",
      conditions: "Conditions (current, visibility…)",
      photo: "Photo (optional)",
      message: "Your message",
    },
    placeholders: {
      name: "e.g. Alex",
      contact: "e.g. +66 63 375 3316 or you@email.com",
      object: "e.g. Gold ring, iPhone, GoPro",
      location: "e.g. ~30m off Chaweng pier, north side",
      lostAt: "e.g. Today around 14:00",
      depth: "e.g. Around 4–6 m",
      conditions: "e.g. Calm, sandy bottom, slight current",
      message: "Tell us a little about what you need…",
    },
    optional: "Optional",
    required: "Required",
    photoHelp:
      "A photo really helps. Files can't travel in a WhatsApp link, so pick it here to confirm the right one — then attach it directly in the WhatsApp chat that opens.",
    submitRecovery: "Open WhatsApp with my request",
    submitContact: "Open WhatsApp with my message",
    emailFallback: "Or send by email instead",
    sending: "Preparing your message…",
    successTitle: "Ready to send",
    successBody:
      "We've opened WhatsApp with your details. If it didn't open, use the button below.",
    successOpenWhatsApp: "Open WhatsApp",
    errorTitle: "Something needs a look",
    errorGeneric: "Please check the highlighted fields and try again.",
    spamError: "Submission blocked. If this is a mistake, please contact us on WhatsApp directly.",
    /** Per-field messages. Passed into the validators so they follow the locale. */
    validation: {
      name: "Please tell us your name.",
      contactRequired: "A phone, WhatsApp or email is required.",
      contactInvalid: "Enter a valid phone/WhatsApp or email.",
      object: "What did you lose?",
      location: "Where did it happen? Be as precise as you can.",
      lostAt: "Roughly when did it happen?",
      message: "Add a short message.",
      messageShort: "A little more detail helps us help you.",
    },
  },

  /** On-site assistant. Kept out of the component so it translates like the rest. */
  chat: {
    launcherLabel: "Ask",
    open: "Open the assistant",
    close: "Close the assistant",
    conversation: "Conversation",
    typing: "Assistant is typing",
    inputPlaceholder: "Ask about recovery or diving…",
    send: "Send message",
    greeting:
      "Hi — I'm the Jammin's Depths assistant. Lost something in the water around Koh Samui, or curious about diving? Ask me anything, and I'll point you the right way.",
    suggestions: ["I lost something in the sea", "How does recovery work?", "Tell me about diving here"],
    notConfigured:
      "The assistant isn't configured yet. Reach us on WhatsApp and we'll help you directly.",
    unreachable: "Sorry — I couldn't reach the assistant. Please try WhatsApp and we'll help right away.",
    failed:
      "Sorry — something went wrong. Please try again, or reach us on WhatsApp and we'll help right away.",
    interrupted:
      "\n\nSorry — I hit a snag. Please try again, or reach us on WhatsApp and we'll help right away.",
  },

  /**
   * Text that ends up *inside* the WhatsApp message the visitor sends.
   * Localised too — a French visitor must not send an English message.
   */
  wa: {
    recoveryIntro: "Hello Jammin's Depths, I need underwater recovery assistance in Koh Samui, Thailand.",
    recoveryPrefill:
      "Hello Jammin's Depths, I need underwater recovery assistance in Koh Samui, Thailand. Object: [object]. Location: [location]. Lost on: [date/time].",
    divingPrefill: "Hello Jammin's Depths, I'd like to ask about diving in Koh Samui, Thailand.",
    coursePrefill:
      "Hello Jammin's Depths, I'd like information about the {course} course in Koh Samui. I am [beginner/certified], we are [X] people and we're available on [date].",
    tripPrefill:
      "Hello Jammin's Depths, I'd like information about the {trip} dive trip from Koh Samui. I am [beginner/certified], we are [X] people and we're available on [date].",
    contactIntro: "Hello Jammin's Depths,",
    labels: {
      name: "Name",
      contact: "Contact",
      object: "Object",
      location: "Location",
      lostAt: "Lost on",
      depth: "Estimated depth",
      conditions: "Conditions",
    },
  },

  /** Moved out of the page component so it can be translated like everything else. */
  privacy: {
    heroKicker: "Privacy",
    heroTitle: "Privacy, kept simple.",
    heroLead:
      "We collect as little as possible, and we don't track you around the web. Here's exactly what happens with the information you share.",
    sections: [
      {
        title: "What we collect",
        body: "Only what you type into the recovery or contact form — your name, a way to reach you, and the details of your request. There are no accounts, no logins and no hidden fields.",
      },
      {
        title: "How it's used",
        body: "The form builds a message and opens it in WhatsApp (or your email app) so you send it to us directly. Nothing is stored on this website and nothing is sent to a third-party server by the form itself. Once you message us, our conversation lives in WhatsApp or email under their own terms.",
      },
      {
        title: "Tracking & cookies",
        body: "No advertising trackers and no analytics cookies are set by default. Fonts are self-hosted, so your visit isn't shared with third parties just for loading the page.",
      },
      {
        title: "AI assistant",
        body: "The optional chat assistant sends your messages to our AI provider (Anthropic) purely to generate a reply — nothing more. The conversation is kept only in your browser for the current session and is cleared when you close the tab; it isn't saved on our servers. Please don't share sensitive personal details in the chat — for a real request, message us on WhatsApp.",
      },
      {
        title: "Photos",
        body: "If you pick a photo in the recovery form, it stays on your device — it's only used to help you confirm the right file before you attach it yourself in the chat.",
      },
    ],
    questionsTitle: "Questions",
    /** Split around the two inline links rendered by the page. */
    questionsBefore: "Reach us any time on ",
    questionsBetween: " or by phone at ",
    questionsAfter: ".",
  },

  notFound: {
    kicker: "Error 404",
    title: "This dive came up empty.",
    body: "The page you're after isn't here — like a ring that drifted off the map. Let's get you back to solid ground.",
    cta: "Back to the surface",
  },

  footer: {
    blurb: "Diving and underwater recovery in Koh Samui, Thailand. Direct, local, methodical.",
    rights: "All rights reserved.",
    builtNote: "Media slots are ready for authentic photos and clips.",
  },
} as const;

/**
 * `en` is `as const`, so every string in it is a *literal* type. A second
 * dictionary could never satisfy that. `Widen` relaxes the literals back to
 * their primitives while preserving the exact shape — so `fr.ts` is checked
 * key-for-key against English without being forced to repeat English strings.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : T extends object
          ? { [K in keyof T]: Widen<T[K]> }
          : T;

export type Dictionary = Widen<typeof en>;
