/**
 * Les boucles B, allumables une par une.
 *
 * Le plan 90 jours est catégorique : « Une boucle par semaine, jamais deux. Une
 * boucle qui part de travers doit être identifiable du premier coup. » Tant que
 * cette règle ne tient qu'à la discipline, une session pressée allume tout d'un
 * coup et plus personne ne sait laquelle a envoyé quoi.
 *
 * Elle tient donc au code : chaque boucle a un interrupteur, piloté par une
 * variable d'environnement. Allumer la semaine 5 ne demande aucun déploiement,
 * et éteindre une boucle qui déraille non plus — c'est ce qui compte à 3 h du
 * matin quand des messages partent de travers.
 *
 * Par défaut, TOUT est éteint. Un oubli de configuration laisse le système
 * silencieux, jamais bavard.
 */

export const loops = ["B1", "B2", "B4", "B5", "B6"] as const;
export type Loop = (typeof loops)[number];

export interface LoopSpec {
  readonly id: Loop;
  readonly label: string;
  /** La semaine prévue au plan 90 jours — indicative, pas contraignante. */
  readonly plannedWeek: number;
  /** Ce qui doit être vrai pour considérer la boucle réussie. */
  readonly doneWhen: string;
}

export const LOOP_SPECS: Readonly<Record<Loop, LoopSpec>> = {
  B1: {
    id: "B1",
    label: "Réponse à un lead entrant",
    plannedWeek: 4,
    doneWhen: "10 leads traités, 0 promesse non tenable dans les brouillons",
  },
  B2: {
    id: "B2",
    label: "Relances de cadence",
    plannedWeek: 5,
    doneWhen: "Les échéances tombent seules. 0 relance après un refus",
  },
  B4: {
    id: "B4",
    label: "Contenu quotidien",
    plannedWeek: 6,
    doneWhen: "Un brouillon + visuel chaque matin, publication validée",
  },
  B6: {
    id: "B6",
    label: "Demande d'avis",
    plannedWeek: 7,
    doneWhen: "Branché sur Google Business Profile, premier avis obtenu",
  },
  B5: {
    id: "B5",
    label: "Approches partenaires",
    plannedWeek: 8,
    doneWhen: "Plafond 3/jour respecté, cibles > 70/100 envoyées une par une",
  },
};

/**
 * `LOOPS_ENABLED="B1,B2"`. Tolérant à la casse et aux espaces, strict sur le
 * reste : un identifiant inconnu est ignoré en silence plutôt que d'allumer
 * quelque chose par erreur d'interprétation.
 */
export function enabledLoops(raw: string | undefined = process.env.LOOPS_ENABLED): ReadonlySet<Loop> {
  const on = new Set<Loop>();
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim().toUpperCase();
    if ((loops as readonly string[]).includes(id)) on.add(id as Loop);
  }
  return on;
}

export function isLoopEnabled(loop: Loop, raw?: string): boolean {
  return enabledLoops(raw).has(loop);
}

/** L'état des boucles, tel qu'il s'affiche dans le brief. */
export function loopStatusLines(raw?: string): string[] {
  const on = enabledLoops(raw);
  return loops.map((id) => {
    const spec = LOOP_SPECS[id];
    return `${on.has(id) ? "🟢" : "⚪"} ${id} · ${spec.label}${on.has(id) ? "" : ` — éteinte (S${spec.plannedWeek} au plan)`}`;
  });
}
