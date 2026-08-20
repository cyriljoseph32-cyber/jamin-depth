import { describe, expect, it } from "vitest";
import { agentFor, guessCategory, resolveSpecRole, routingTable, SPEC_ROLES, UNASSIGNED } from "./routing";

describe("agentFor", () => {
  it("route vers des agents qui existent vraiment", () => {
    expect(agentFor("DIVING", "sales")).toBe("reception");
    expect(agentFor("DIVING", "content")).toBe("content");
    expect(agentFor("RUGBY", "marketing")).toBe("marketing");
    expect(agentFor("COCO", "partner")).toBe("partenariats-concierge");
    expect(agentFor("GLOBAL", "operations")).toBe("coco-command");
  });

  it("n'attribue jamais la finance : aucun agent ne touche à l'argent", () => {
    for (const venture of ["COCO", "DIVING", "RUGBY", "GLOBAL"] as const) {
      expect(agentFor(venture, "finance")).toBe(UNASSIGNED);
    }
  });

  it("a un titulaire par défaut pour chaque activité", () => {
    expect(agentFor("RUGBY", "product")).toBe("webmaster");
    expect(agentFor("GLOBAL", "content")).toBe("coco-command");
  });
});

describe("routingTable", () => {
  /**
   * Le garde-fou du fichier : une case vide se traduirait par une tâche
   * assignée à `undefined`, donc à personne, donc oubliée.
   */
  it("ne laisse aucune case sans réponse", () => {
    for (const row of routingTable()) {
      expect(row.agent.length).toBeGreaterThan(0);
    }
  });

  it("ne réserve l'absence de titulaire qu'à la finance", () => {
    const unassigned = routingTable().filter((r) => r.agent === UNASSIGNED);
    expect(unassigned.every((r) => r.category === "finance")).toBe(true);
  });
});

describe("resolveSpecRole", () => {
  it("traduit un rôle métier du mandat vers l'agent réel", () => {
    expect(resolveSpecRole("diving_sales_agent")).toEqual({
      venture: "DIVING",
      category: "sales",
      agent: "reception",
    });
    expect(resolveSpecRole("rugby_growth_agent")?.agent).toBe("marketing");
  });

  it("applique un rôle transverse à l'activité fournie", () => {
    expect(resolveSpecRole("growth_director", "RUGBY")?.agent).toBe("marketing");
    expect(resolveSpecRole("growth_director", "COCO")?.agent).toBe("growth-concierge");
  });

  it("renvoie null sur un rôle inconnu plutôt que d'improviser", () => {
    expect(resolveSpecRole("helmetik_sales_agent")).toBeNull();
    expect(resolveSpecRole("")).toBeNull();
  });

  it("couvre tous les rôles nommés dans le mandat", () => {
    for (const role of Object.keys(SPEC_ROLES)) {
      expect(resolveSpecRole(role)).not.toBeNull();
    }
  });
});

describe("guessCategory", () => {
  it("reconnaît les formulations courantes", () => {
    expect(guessCategory("relancer les leads de juillet")).toBe("sales");
    expect(guessCategory("préparer trois reels Instagram")).toBe("content");
    expect(guessCategory("démarcher un hôtel de Chaweng")).toBe("partner");
    expect(guessCategory("vérifier la facture du stade")).toBe("finance");
    expect(guessCategory("répondre aux deux Français du 26 août")).toBe("support");
  });

  it("retombe sur operations quand rien ne ressort", () => {
    expect(guessCategory("voir ça avec Cyril")).toBe("operations");
  });
});
