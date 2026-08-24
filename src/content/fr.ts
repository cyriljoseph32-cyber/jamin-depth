import type { Dictionary } from "./en";

/**
 * Dictionnaire français — la locale par défaut du site.
 *
 * Traduction fidèle de `en.ts` : aucun service, tarif, brevet, avis ni
 * garantie n'est ajouté ici. Les noms de brevets PADI (Discover Scuba Diving,
 * Open Water, Advanced Open Water) restent en anglais : ce sont les
 * dénominations officielles internationales, y compris en France.
 *
 * Les titres et descriptions sont rédigés en français natif, pas traduits mot
 * à mot, avec les mots-clés locaux placés naturellement.
 */
export const fr: Dictionary = {
  meta: {
    home: {
      title: "Plongée à Koh Samui — Baptême, brevets PADI et récupération sous-marine",
      description:
        "Plongez dans le golfe de Thaïlande au départ de Koh Samui avec un moniteur PADI francophone : baptême, brevets avec Discovery Divers, sorties à Sail Rock, et récupération d'objets perdus sous l'eau.",
      keywords: [
        "plongée Koh Samui",
        "baptême plongée Koh Samui",
        "plongée francophone Koh Samui",
        "cours de plongée Koh Samui",
        "moniteur plongée français Koh Samui",
        "récupération sous-marine Koh Samui",
      ],
    },
    baptism: {
      title: "Baptême de plongée à Koh Samui — votre première plongée",
      description:
        "Votre première plongée à Koh Samui : baptême Discover Scuba Diving sur une journée, sans expérience ni brevet, matériel inclus. Encadré par un moniteur PADI francophone.",
      keywords: [
        "baptême plongée Koh Samui",
        "première plongée Koh Samui",
        "plongée débutant Koh Samui",
        "essayer la plongée Koh Samui",
      ],
    },
    recovery: {
      title: "Récupération sous-marine — Objets perdus dans l'eau",
      description:
        "Téléphone, bague ou appareil photo tombé dans la mer autour de Koh Samui ? Décrivez-nous la situation et nous évaluerons honnêtement si une récupération est envisageable.",
      keywords: [
        "récupération sous-marine Koh Samui",
        "objet perdu mer Koh Samui",
        "bague perdue dans la mer",
        "téléphone tombé dans l'eau Koh Samui",
      ],
    },
    diving: {
      title: "Plongée à Koh Samui — Baptême et brevets PADI",
      description:
        "Plongée à Koh Samui dans le golfe de Thaïlande avec un plongeur local francophone. Baptême, Open Water, Advanced : brevets PADI avec Discovery Divers. Honnête, personnel, respectueux de la mer.",
      keywords: [
        "plongée Koh Samui",
        "baptême plongée Koh Samui",
        "cours de plongée Koh Samui",
        "plongée francophone Koh Samui",
        "brevet PADI Koh Samui",
      ],
    },
    about: {
      title: "Le plongeur",
      description:
        "Le plongeur francophone derrière Jammin's Depths à Koh Samui : plongée et récupération sous-marine, avec une manière de travailler directe et humaine.",
      keywords: ["plongeur francophone Koh Samui", "plongée Koh Samui", "récupération sous-marine Koh Samui"],
    },
    contact: {
      title: "Contact — WhatsApp et téléphone",
      description:
        "Contactez Jammin's Depths à Koh Samui par WhatsApp ou téléphone pour une plongée ou une récupération sous-marine. Rapide, direct, en français.",
      keywords: ["contact plongée Koh Samui", "plongeur francophone Koh Samui"],
    },
    privacy: {
      title: "Confidentialité",
      description:
        "Comment Jammin's Depths traite le peu d'informations que vous partagez. Aucun traçage par défaut.",
    },
  },

  nav: {
    requestRecovery: "Demander une récupération",
    exploreDiving: "Découvrir la plongée",
    askDiving: "Poser une question",
    whatsapp: "WhatsApp",
    call: "Appeler",
    menu: "Menu",
    close: "Fermer",
    pages: {
      home: "Accueil",
      diving: "Plongée",
      baptism: "Baptême de plongée",
      recovery: "Récupération",
      about: "Le plongeur",
      contact: "Contact",
      privacy: "Confidentialité",
    },
    skipToContent: "Aller au contenu",
    fabAria: "Demander une récupération sur WhatsApp",
    languageLabel: "Langue",
    languageNames: { fr: "Français", en: "English" },
  },

  media: {
    divers: {
      label: "Palier de sécurité · Chumphon Pinnacle",
      alt: "Quatre plongeurs au palier de sécurité, accrochés au bout de mouillage, la surface éclairée au-dessus d'eux, à Chumphon Pinnacle",
    },
    platax: {
      label: "Banc de platax · Sail Rock",
      alt: "Un banc de platax en pleine eau, dans le bleu, à Sail Rock",
    },
    turtle: {
      label: "Tortue imbriquée · Tanote Bay",
      alt: "Une tortue imbriquée posée contre le corail dur du récif, à Tanote Bay",
    },
    fusiliers: {
      label: "Fusiliers · Sail Rock",
      alt: "Un banc de fusiliers jaunes au-dessus du récif, à Sail Rock",
    },
    reef: {
      label: "Vie du récif",
      alt: "Nudibranche coloré sur le récif, dans le golfe de Thaïlande",
    },
    barracuda: {
      label: "Vers le bleu",
      alt: "Un grand banc de barracudas dans le bleu",
    },
    divingCard: {
      label: "Plongée · Golfe de Thaïlande",
      alt: "Trois plongeurs en pleine eau au-dessus d'un récif du golfe de Thaïlande, l'un faisant un signe de la main",
    },
  },

  home: {
    heroKicker: "Plongée · Récupération sous-marine · Koh Samui",
    heroTitle: "La plongée à Koh Samui, avec quelqu'un qui connaît ces eaux.",
    heroSlogan: "Vous l'avez perdu. On plonge le chercher.",
    heroLead:
      "Baptêmes, brevets PADI et sorties plongée au départ de Koh Samui — vers les plus beaux sites du golfe de Thaïlande comme Sail Rock. En français, sans précipitation. Et la récupération d'objets tombés à l'eau quand il le faut.",
    recoveryLink: "Vous avez perdu quelque chose dans l'eau ? Récupération sous-marine",
    badges: ["Brevets PADI", "Sorties plongée", "Accueil en français", "Koh Samui"],
    worldsKicker: "Deux mondes, un plongeur",
    worldsTitle: "La plongée quand vous êtes prêt. La récupération quand ça compte.",
    recoveryCardTitle: "Récupération sous-marine",
    recoveryCardBody:
      "Recherche et récupération d'objets perdus dans l'eau — depuis un bateau, près d'une plage, ou dans certaines zones de cascades. Méthodique, calme, honnête sur ce qui est possible.",
    recoveryCardCta: "Comment ça se passe",
    divingCardTitle: "Plongée",
    divingCardBody:
      "Plonger accompagné par quelqu'un qui connaît ces eaux. Une vraie expérience sous-marine, respectueuse de la mer — et des réponses à vos questions avant de descendre.",
    divingCardCta: "Découvrir la plongée",
    reassuranceKicker: "Pourquoi on nous appelle",
    reassuranceTitle: "À la panique, on répond méthode.",
    reassuranceItems: [
      {
        title: "Une démarche claire",
        body: "Vous nous dites quoi, où et quand. On évalue honnêtement la faisabilité avant de mettre un pied à l'eau — aucune fausse promesse.",
      },
      {
        title: "Contact direct",
        body: "Vous parlez au plongeur, pas à un standard. Un message WhatsApp et la conversation démarre.",
      },
      {
        title: "Intervention locale",
        body: "Basé à Koh Samui et dans ces eaux au quotidien. La connaissance du terrain fait la moitié du travail.",
      },
    ],
    galleryCta: "Faire une demande de récupération",
    galleryKicker: "Prises sous l'eau",
    galleryTitle: "De vraies plongées, de vraies récupérations.",
    galleryNote:
      "De vraies plongées dans le golfe de Thaïlande — Sail Rock, Chumphon Pinnacle, Tanote Bay. Rien ici n'est une banque d'images ni une mise en scène.",
    finalKicker: "Quand vous voulez",
    finalTitle: "Vous l'avez perdu. On plonge le chercher.",
    finalBody:
      "Plus tôt on le sait, meilleures sont les chances. Envoyez les détails maintenant — demander ne coûte rien.",
  },

  recovery: {
    heroKicker: "Récupération sous-marine",
    heroTitle: "Tombé à l'eau ? On va le chercher.",
    heroLead:
      "Téléphones, bagues, clés, appareils photo, lunettes, outils — il suffit d'une seconde pour que ça passe par-dessus bord. Racontez-nous ce qui s'est passé et nous vous dirons honnêtement si une récupération vaut la peine d'être tentée.",
    casesKicker: "Ce qu'on recherche",
    casesTitle: "Cas fréquents",
    cases: [
      {
        title: "Tombé d'un bateau",
        body: "Par-dessus bord en navigation, au mouillage ou à l'embarquement. La profondeur et le courant décident de ce qui est possible.",
      },
      {
        title: "Perdu près d'une plage",
        body: "Dans le peu profond, depuis un ponton ou dans la zone de vagues où le sable ne cesse de bouger.",
      },
      {
        title: "Disparu dans l'eau",
        body: "Glissé d'un doigt ou d'un poignet en nageant, en faisant du snorkeling ou en jouant dans la mer.",
      },
      {
        title: "Certaines zones de cascades",
        body: "Certains bassins et zones de cascades accessibles — strictement sous réserve de sécurité, d'accès et de conditions.",
      },
    ],
    honestNote:
      "Soyons clairs : nous ne pouvons pas promettre de retrouver chaque objet. L'eau déplace les choses, la visibilité varie, et certains endroits ne sont ni sûrs ni accessibles. Nous vous dirons toujours ce qui est réaliste avant de nous engager.",
    processKicker: "Comment ça marche",
    processTitle: "Quatre étapes, sans drame",
    steps: [
      {
        n: "01",
        title: "Contact",
        body: "Écrivez-nous sur WhatsApp avec l'essentiel. Plus vite on le sait, plus la piste est fraîche.",
      },
      {
        n: "02",
        title: "Localisation & infos",
        body: "On rassemble les détails — objet, endroit précis, heure, profondeur, conditions et une photo si vous en avez une.",
      },
      {
        n: "03",
        title: "Évaluation",
        body: "On pèse la faisabilité, la sécurité et l'accès, puis on vous dit honnêtement à quoi ressemblerait une tentative.",
      },
      {
        n: "04",
        title: "Intervention éventuelle",
        body: "Si c'est réaliste et sûr, on planifie et on plonge. Sinon, vous saurez pourquoi — pas de temps perdu.",
      },
    ],
    formKicker: "Demande de récupération",
    formTitle: "Envoyez les détails",
    formLead:
      "Remplissez ceci et nous ouvrirons WhatsApp avec tout récapitulé — ou envoyez-le par e-mail. Plus le lieu et l'heure sont précis, meilleures sont vos chances.",
    responsibleNote:
      "Toute intervention dépend des conditions, de la sécurité, de l'accès au site et des autorisations éventuellement nécessaires. Rien ici ne constitue une garantie de récupération.",
  },

  diving: {
    heroKicker: "Plongée · Golfe de Thaïlande · Koh Samui",
    heroTitle: "La plongée à Koh Samui, avec quelqu'un qui connaît ces eaux.",
    heroLead:
      "Pas un centre de plongée à la chaîne. Une façon personnelle et honnête de découvrir le monde sous-marin du golfe de Thaïlande — au départ de Koh Samui, à votre rythme et selon vos questions.",
    experienceKicker: "L'expérience",
    experienceTitle: "Calme, proche, vrai.",
    experienceBody:
      "Plonger ici, c'est une question de présence — la lumière qui traverse la surface, le bleu qui s'ouvre, la petite vie qu'on ne remarque qu'en ralentissant. On reste personnel et sans précipitation, et on s'adapte à là où vous en êtes.",
    prepKicker: "Avant de descendre",
    prepTitle: "Préparation simple",
    prep: [
      {
        title: "Reposé et hydraté",
        body: "Arrivez reposé, bien hydraté et à jeun d'alcool. Les petits détails changent tout sous l'eau.",
      },
      {
        title: "On en parle d'abord",
        body: "Dites-nous votre expérience et votre niveau d'aisance. Il n'y a pas de mauvaise réponse — ça façonne la plongée.",
      },
      {
        title: "Attention aux conditions",
        body: "Météo, courant et visibilité décident de la journée. On préfère décaler une plongée que la forcer.",
      },
    ],
    respectKicker: "Plonger avec respect",
    respectTitle: "La mer n'est pas à prendre.",
    respectBody:
      "On regarde, on ne touche pas. On ne ramène que des photos, on ne laisse rien derrière soi. On reste au-dessus du récif, à distance de la vie marine, et on laisse l'eau exactement aussi sauvage qu'elle est.",
    ctaTitle: "Envie de plonger ici ?",
    ctaBody:
      "Demandez ce que vous voulez — conditions, niveau requis, déroulé d'une journée. Un message et on en parle.",

    coursesKicker: "Apprendre à plonger",
    coursesTitle: "Brevets PADI — avec Discovery Divers",
    coursesIntro:
      "Envie d'un brevet, pas seulement d'un essai ? Les formations se déroulent avec Discovery Divers Koh Samui — centre PADI 5 étoiles et plus ancien club de l'île (plus de 25 ans) — où enseigne le plongeur de Jammin's Depths. Même eau, même approche honnête et sans précipitation.",
    coursesDisclaimer:
      "Les formations sont réservées et encadrées par Discovery Divers. Matériel de plongée inclus ; tarifs par personne, susceptibles d'évoluer et confirmés à la réservation.",
    coursesCtaLabel: "Voir les formations et tarifs",
    courseCta: "Demander pour cette formation",
    tripCta: "Demander pour cette sortie",
    coursesPriceFrom: "à partir de",
    certBadge: "Brevet",
    noCertBadge: "Sans brevet",
    courses: [
      {
        code: "DSD",
        name: "Discover Scuba Diving",
        cert: false,
        duration: "1 jour",
        summary:
          "Le baptême de plongée : vos premières respirations sous l'eau, encadrées. Aucune expérience ni brevet requis. La façon la plus simple de savoir si la plongée est faite pour vous.",
        priceFrom: "฿5,850",
      },
      {
        code: "OW",
        name: "Open Water",
        cert: true,
        duration: "3–4 jours",
        summary:
          "Le brevet de base, celui qui ouvre tout. Apprenez à planifier et réaliser vos propres plongées, en trois ou quatre jours.",
        priceFrom: "฿17,900",
      },
      {
        code: "AOW",
        name: "Advanced Open Water",
        cert: true,
        duration: "2 jours",
        summary:
          "Cinq plongées d'aventure sur deux jours — dont une plongée profonde et une d'orientation sous-marine, plus trois de votre choix.",
        priceFrom: "฿13,900",
      },
      {
        code: "SPEC",
        name: "Spécialités",
        cert: true,
        duration: "Variable",
        summary:
          "Approfondissez ce qui vous plaît — de l'orientation à la plongée profonde et bien plus. Demandez ce qui tourne en ce moment.",
        priceFrom: undefined,
      },
    ],

    tripsKicker: "Déjà breveté ?",
    tripsTitle: "Sorties plongée et excursions.",
    tripsIntro:
      "Vous avez votre carte ? Montez sur le bateau avec Discovery Divers vers les plus belles eaux de la région — le célèbre pinacle de Sail Rock, Koh Tao et Chumphon — ou venez simplement faire du snorkeling.",
    tripsNote:
      "Tarifs par personne avec Discovery Divers — matériel inclus, susceptibles d'évoluer et confirmés à la réservation.",
    trips: [
      { name: "Sail Rock", detail: "Exploration", price: "฿4,550" },
      { name: "Koh Tao", detail: "2 plongées", price: "฿4,850" },
      { name: "Chumphon Pinnacle", detail: "Plongeurs brevetés", price: "฿5,050" },
      { name: "Snorkeling", detail: "Tous les sites", price: "฿2,450" },
    ],
  },

  baptism: {
    heroKicker: "Première plongée · Koh Samui",
    heroTitle: "Votre baptême de plongée à Koh Samui.",
    heroLead:
      "Vous n'avez jamais respiré sous l'eau ? Le baptême Discover Scuba Diving est fait exactement pour ça — une journée, sans expérience, sans brevet, encadré du début à la fin.",
    whatKicker: "En quoi ça consiste",
    whatTitle: "Une journée, aucun prérequis.",
    includedTitle: "Ce qui est confirmé",
    ctaKicker: "Prêt à essayer",
    ctaTitle: "Réservez votre baptême.",
    ctaBody: "Dites-nous vos dates et combien vous êtes — on s'occupe du reste.",
    seeAllCourses: "Voir toutes les formations PADI",
  },

  why: {
    kicker: "Pourquoi plonger avec nous",
    title: "Quatre raisons, toutes vérifiables.",
    lead: "Pas de badges, pas de statistiques inventées — uniquement ce qui peut être vérifié.",
    items: [
      {
        title: "Un moniteur PADI",
        body: "Vos formations sont enseignées par un moniteur PADI chez Discovery Divers Koh Samui, pas par un guide saisonnier de passage.",
      },
      {
        title: "Un centre PADI 5 étoiles",
        body: "Formations et sorties se déroulent avec Discovery Divers — le plus ancien club de l'île, plus de 25 ans sur ces eaux.",
      },
      {
        title: "En français comme en anglais",
        body: "Réservez, posez vos questions et plongez en français. Vous ne subissez jamais un briefing dans une langue que vous suivez à moitié.",
      },
      {
        title: "Directement au plongeur",
        body: "Un message WhatsApp atteint la personne qui sera réellement dans l'eau avec vous. Pas d'agence, pas de standard.",
      },
    ],
  },

  /**
   * Habillage seulement. Les citations vivent dans `testimonials.ts`,
   * volontairement hors du dictionnaire — voir le commentaire là-bas.
   */
  testimonials: {
    kicker: "Ce qu'ils en disent",
    title: "Les mots des plongeurs, après coup.",
  },

  faq: {
    kicker: "Avant de réserver",
    title: "Questions de débutants.",
    lead: "Ce qu'on nous demande le plus avant une première plongée autour de Koh Samui.",
    toConfirm: "À confirmer par le propriétaire",
    items: [
      {
        q: "Puis-je plonger si je n'ai jamais plongé ?",
        a: "Oui. Le baptême Discover Scuba Diving est fait pour ça — vos premières respirations sous l'eau, encadrées, sur une journée, sans expérience ni brevet requis. À partir de ฿5,850, matériel de plongée inclus.",
        confirmed: true,
      },
      {
        q: "Faut-il savoir nager ?",
        a: "Les exigences de nage dépendent de la formation et des conditions du jour. Posez la question sur WhatsApp avant de réserver, vous aurez une réponse claire.",
        confirmed: true,
      },
      {
        q: "Que dois-je apporter ?",
        a: "Le matériel de plongée est inclus avec Discovery Divers, vous n'avez donc rien à louer. Prévoyez une protection solaire, de l'eau et ce que vous aimez avoir sur vous en plongée — et demandez sur WhatsApp si vous hésitez sur un point précis.",
        confirmed: true,
      },
      {
        q: "Où se déroulent les sorties au départ de Koh Samui ?",
        a: "Les sorties se font avec Discovery Divers vers les plus belles eaux de la région : le pinacle de Sail Rock, Koh Tao et Chumphon Pinnacle, plus le snorkeling sur tous les sites.",
        confirmed: true,
      },
      {
        q: "Comment réserver ?",
        a: "Écrivez-nous sur WhatsApp avec votre niveau, le nombre de personnes et vos dates. Les formations et sorties sont ensuite réservées et encadrées par Discovery Divers.",
        confirmed: true,
      },
      {
        q: "Que se passe-t-il si la météo ne permet pas la sortie ?",
        a: "La météo, le courant et la visibilité décident de la journée, et nous préférons décaler une plongée que la forcer. Le cas échéant, on convient d'une nouvelle date ou d'un remboursement directement avec vous — pas de petites lignes, juste une conversation.",
        confirmed: true,
      },
      {
        q: "Quelle est la politique d'annulation si je me désiste ?",
        a: "Annulation gratuite jusqu'à 24h avant le départ (frais de 5% si vous avez payé par carte ou PayPal). En dessous de 24h, ou en cas d'absence au point de rendez-vous, la sortie est facturée en totalité — la place, le matériel et le temps du staff sont déjà mobilisés. Un report reste possible selon les disponibilités, moyennant ฿2,000 par personne.",
        confirmed: true,
      },
      {
        q: "Puis-je prendre l'avion juste après avoir plongé ?",
        a: "Jamais le jour même d'une plongée. Comptez au moins 18h avant toute activité en altitude, vol compris — en pratique, un vol pris après 8h le lendemain matin convient. C'est une règle de sécurité stricte contre les accidents de décompression, pas une simple recommandation.",
        confirmed: true,
      },
    ],
  },

  faqRecovery: {
    kicker: "Avant de nous écrire",
    title: "Questions sur la récupération.",
    lead: "Ce qu'on nous demande avant d'envoyer une demande de récupération.",
    toConfirm: "À confirmer par le propriétaire",
    items: [
      {
        q: "Garantissez-vous de retrouver l'objet ?",
        a: "Non — nous ne pouvons pas promettre de récupérer chaque objet. L'eau déplace les choses, la visibilité varie, et certains endroits ne sont ni sûrs ni accessibles. Nous vous dirons toujours honnêtement ce qui est réaliste avant de nous engager.",
        confirmed: true,
      },
      {
        q: "Quels objets pouvez-vous récupérer ?",
        a: "Téléphones, bagues, clés, appareils photo, lunettes de soleil, outils et bien d'autres — tombés d'un bateau, perdus près d'une plage, glissés du doigt ou du poignet en nageant ou en snorkeling, ou perdus dans certaines zones de cascade accessibles.",
        confirmed: true,
      },
      {
        q: "Comment se déroule une demande ?",
        a: "En quatre étapes : vous nous écrivez sur WhatsApp avec l'essentiel, nous rassemblons les détails — objet, endroit exact, heure, profondeur et conditions — puis nous évaluons la faisabilité, la sécurité et l'accès. Si c'est réaliste, on planifie et on plonge. Sinon, vous saurez pourquoi.",
        confirmed: true,
      },
      {
        q: "Faut-il nous contacter rapidement ?",
        a: "Le plus vite possible. Plus tôt nous sommes prévenus, plus la piste est fraîche — les courants et le sable qui bouge jouent contre vous dès la seconde où l'objet part à l'eau.",
        confirmed: true,
      },
      {
        q: "Où intervenez-vous autour de Koh Samui ?",
        a: "Depuis un bateau — en route, au mouillage ou à l'embarquement —, dans les petits fonds près d'une plage, au bout d'un ponton ou dans la zone de vagues, et dans certaines vasques de cascade accessibles. Toujours sous réserve de la sécurité, de l'accès et des conditions.",
        confirmed: true,
      },
    ],
  },

  about: {
    heroKicker: "Le plongeur",
    heroTitle: "Un plongeur local, en direct.",
    heroLead:
      "Jammin's Depths repose sur une seule chose : connaître assez bien les eaux de Koh Samui pour pouvoir aider — qu'il s'agisse de récupérer un objet perdu ou de vous emmener sous l'eau pour la première fois.",
    storyTitle: "La version courte",
    storyBody:
      "Ça a commencé comme presque tout ici — du temps passé dans l'eau, un attachement à ce qu'il y a sous la surface, et des voisins qui demandent un coup de main quand quelque chose passe par-dessus bord. C'est devenu un métier : de la récupération calme et méthodique, et la plongée partagée honnêtement. Vous traitez directement avec le plongeur, du début à la fin.",
    valuesTitle: "Notre façon de travailler",
    values: [
      { title: "Humain", body: "Une vraie conversation, sans script. Vous parlez à la personne qui plonge." },
      {
        title: "Local",
        body: "Les eaux de Koh Samui, connues de première main. La connaissance du terrain fait le gros du travail.",
      },
      { title: "Honnête", body: "On vous dit ce qui est possible avant de commencer, pas après." },
    ],
    credentialsTitle: "Parcours",
    credentialsNote:
      "Moniteur PADI chez Discovery Divers Koh Samui — centre de plongée PADI 5 étoiles et plus ancien club de l'île. Les formations sont enseignées et réservées via Discovery Divers ; la récupération sous-marine est l'activité propre de Jammin's Depths.",
    portraitCaption: "Le plongeur · Golfe de Thaïlande",
  },

  contact: {
    heroKicker: "Contact",
    heroTitle: "Parlez au plongeur.",
    heroLead:
      "Le plus rapide, c'est WhatsApp. Écrivez à tout moment, en français, pour raconter ce qui s'est passé ou poser une question sur la plongée — on prend le relais.",
    directTitle: "Lignes directes",
    whatsappLabel: "WhatsApp",
    phoneLabel: "Téléphone",
    emailLabel: "E-mail",
    followTitle: "Suivre le travail",
    locationTitle: "Basé à",
    locationNote:
      "Nous travaillons dans les eaux autour de Koh Samui. Pas d'adresse d'accueil — tout commence par un message.",
    formKicker: "Envoyer un message",
    formTitle: "Vous préférez un formulaire ?",
    formLead:
      "Écrivez ci-dessous et nous ouvrirons WhatsApp avec votre message prêt à partir — ou envoyez-le par e-mail.",
  },

  forms: {
    labels: {
      name: "Votre nom",
      contact: "Téléphone / WhatsApp / E-mail",
      object: "Qu'avez-vous perdu ?",
      location: "Lieu exact",
      lostAt: "Date et heure approximatives",
      depth: "Profondeur estimée (si connue)",
      conditions: "Conditions (courant, visibilité…)",
      photo: "Photo (facultatif)",
      message: "Votre message",
    },
    placeholders: {
      name: "ex. Alex",
      contact: "ex. +66 63 375 3316 ou vous@email.com",
      object: "ex. Bague en or, iPhone, GoPro",
      location: "ex. ~30 m au large du ponton de Chaweng, côté nord",
      lostAt: "ex. Aujourd'hui vers 14h00",
      depth: "ex. Environ 4 à 6 m",
      conditions: "ex. Calme, fond de sable, léger courant",
      message: "Dites-nous en quelques mots ce dont vous avez besoin…",
    },
    optional: "Facultatif",
    required: "Requis",
    photoHelp:
      "Une photo aide beaucoup. Les fichiers ne peuvent pas voyager dans un lien WhatsApp : sélectionnez-la ici pour confirmer la bonne, puis joignez-la directement dans la conversation WhatsApp qui s'ouvre.",
    submitRecovery: "Ouvrir WhatsApp avec ma demande",
    submitContact: "Ouvrir WhatsApp avec mon message",
    emailFallback: "Ou envoyer par e-mail",
    sending: "Préparation de votre message…",
    successTitle: "Prêt à envoyer",
    successBody:
      "Nous avons ouvert WhatsApp avec vos informations. Si rien ne s'est ouvert, utilisez le bouton ci-dessous.",
    successOpenWhatsApp: "Ouvrir WhatsApp",
    errorTitle: "Quelque chose à vérifier",
    errorGeneric: "Merci de vérifier les champs signalés et de réessayer.",
    spamError:
      "Envoi bloqué. S'il s'agit d'une erreur, contactez-nous directement sur WhatsApp.",
    validation: {
      name: "Indiquez-nous votre nom.",
      contactRequired: "Un téléphone, WhatsApp ou e-mail est nécessaire.",
      contactInvalid: "Saisissez un téléphone/WhatsApp ou un e-mail valide.",
      object: "Qu'avez-vous perdu ?",
      location: "Où cela s'est-il passé ? Soyez le plus précis possible.",
      lostAt: "À peu près quand cela s'est-il passé ?",
      message: "Ajoutez un court message.",
      messageShort: "Un peu plus de détail nous aidera à vous aider.",
    },
  },

  chat: {
    launcherLabel: "Poser une question",
    open: "Ouvrir l'assistant",
    close: "Fermer l'assistant",
    conversation: "Conversation",
    typing: "L'assistant écrit",
    inputPlaceholder: "Une question sur la plongée ou une récupération…",
    send: "Envoyer le message",
    greeting:
      "Bonjour — je suis l'assistant de Jammin's Depths. Vous avez perdu quelque chose dans l'eau autour de Koh Samui, ou vous êtes curieux de plonger ? Posez votre question, je vous oriente.",
    suggestions: [
      "J'ai perdu quelque chose en mer",
      "Comment se passe une récupération ?",
      "Parlez-moi de la plongée ici",
    ],
    notConfigured:
      "L'assistant n'est pas encore configuré. Écrivez-nous sur WhatsApp et nous vous répondrons directement.",
    unreachable:
      "Désolé — je n'ai pas pu joindre l'assistant. Passez par WhatsApp, nous vous aiderons tout de suite.",
    failed:
      "Désolé — quelque chose s'est mal passé. Réessayez, ou écrivez-nous sur WhatsApp et nous vous aiderons tout de suite.",
    interrupted:
      "\n\nDésolé — j'ai rencontré un souci. Réessayez, ou écrivez-nous sur WhatsApp et nous vous aiderons tout de suite.",
  },

  wa: {
    recoveryIntro:
      "Bonjour Jammin's Depths, j'ai besoin d'aide pour une récupération sous-marine à Koh Samui, en Thaïlande.",
    recoveryPrefill:
      "Bonjour Jammin's Depths, j'ai besoin d'aide pour une récupération sous-marine à Koh Samui, en Thaïlande. Objet : [objet]. Lieu : [lieu]. Perdu le : [date/heure].",
    divingPrefill:
      "Bonjour, je souhaite avoir des informations pour une plongée à Koh Samui. Je suis [débutant/breveté], nous sommes [X] personnes et nous serons disponibles le [date].",
    coursePrefill:
      "Bonjour, je souhaite avoir des informations pour la formation {course} à Koh Samui. Je suis [débutant/breveté], nous sommes [X] personnes et nous serons disponibles le [date].",
    tripPrefill:
      "Bonjour, je souhaite avoir des informations pour la sortie {trip} au départ de Koh Samui. Je suis [débutant/breveté], nous sommes [X] personnes et nous serons disponibles le [date].",
    contactIntro: "Bonjour Jammin's Depths,",
    labels: {
      name: "Nom",
      contact: "Contact",
      object: "Objet",
      location: "Lieu",
      lostAt: "Perdu le",
      depth: "Profondeur estimée",
      conditions: "Conditions",
    },
  },

  privacy: {
    heroKicker: "Confidentialité",
    heroTitle: "La confidentialité, simplement.",
    heroLead:
      "Nous collectons le minimum et nous ne vous suivons pas sur le web. Voici exactement ce qui arrive aux informations que vous partagez.",
    sections: [
      {
        title: "Ce que nous collectons",
        body: "Uniquement ce que vous saisissez dans le formulaire de récupération ou de contact — votre nom, un moyen de vous joindre et les détails de votre demande. Pas de compte, pas d'identifiant, pas de champ caché.",
      },
      {
        title: "Comment c'est utilisé",
        body: "Le formulaire compose un message et l'ouvre dans WhatsApp (ou votre application e-mail) pour que vous nous l'envoyiez vous-même. Rien n'est stocké sur ce site et le formulaire n'envoie rien à un serveur tiers. Une fois que vous nous écrivez, la conversation vit dans WhatsApp ou votre messagerie, selon leurs propres conditions.",
      },
      {
        title: "Traçage et cookies",
        body: "Aucun traceur publicitaire ni cookie de mesure d'audience n'est déposé par défaut. Les polices sont auto-hébergées : votre visite n'est pas partagée avec des tiers du simple fait du chargement de la page.",
      },
      {
        title: "Assistant IA",
        body: "L'assistant de discussion facultatif transmet vos messages à notre fournisseur d'IA (Anthropic) dans le seul but de générer une réponse — rien de plus. La conversation reste uniquement dans votre navigateur pour la session en cours et disparaît à la fermeture de l'onglet ; elle n'est pas conservée sur nos serveurs. Merci de ne pas y partager de données personnelles sensibles — pour une vraie demande, écrivez-nous sur WhatsApp.",
      },
      {
        title: "Photos",
        body: "Si vous sélectionnez une photo dans le formulaire de récupération, elle reste sur votre appareil — elle sert seulement à vous aider à confirmer le bon fichier avant que vous ne le joigniez vous-même dans la conversation.",
      },
    ],
    questionsTitle: "Questions",
    questionsBefore: "Écrivez-nous à tout moment sur ",
    questionsBetween: " ou par téléphone au ",
    questionsAfter: ".",
  },

  notFound: {
    kicker: "Erreur 404",
    title: "Cette plongée n'a rien donné.",
    body: "La page que vous cherchez n'est pas ici — comme une bague qui a dérivé hors de la carte. Retournons en terrain connu.",
    cta: "Remonter à la surface",
  },

  footer: {
    blurb: "Plongée et récupération sous-marine à Koh Samui, en Thaïlande. Direct, local, méthodique.",
    rights: "Tous droits réservés.",
    builtNote: "Les emplacements média sont prêts pour de vraies photos et vidéos.",
  },
};
