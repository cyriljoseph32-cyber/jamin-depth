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
  },

  home: {
    heroKicker: "Diving · Underwater Recovery · Koh Samui",
    heroTitle: "Dive the Gulf of Thailand with someone who knows the water.",
    heroSlogan: SITE.slogan,
    heroLead:
      "Personal PADI courses and fun dives out of Koh Samui — to the Gulf of Thailand's best sites like Sail Rock, honest and unhurried. Plus professional underwater recovery when something's gone over the side.",
    recoveryLink: "Lost something in the water? Underwater recovery",
    badges: ["PADI courses", "Fun dives", "Koh Samui"],
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
    galleryKicker: "From the water",
    galleryTitle: "Real dives, real recoveries.",
    galleryNote:
      "Real dives in the Gulf of Thailand — Sail Rock, the Similan Islands and beyond. Nothing here is stock or staged.",
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

export type Dictionary = typeof en;
