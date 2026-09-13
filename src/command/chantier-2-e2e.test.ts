import { describe, expect, it } from "vitest";
import { readIngestEvent } from "@/command/ingest";
import { personFromEvent } from "@/command/people";

/** Le parcours réel : ce que CSRA envoie → ce que la base retient. */
describe("bout en bout — CSRA et coco2 vers la fiche unique", () => {
  const ingest = (body: unknown) => {
    const r = readIngestEvent(body);
    if (!r.ok) throw new Error(r.problems.join("; "));
    return personFromEvent(r.event);
  };

  const csra = {
    venture: "RUGBY", agent: "csra-web-form", type: "ACTION", priority: "P1", status: "DONE",
    summary: "Demande d'essai — Kids (4-12)", needs_owner: true, category: "sales",
    contact: { name: "Kelsey", email: "kelsey@exemple.com", phone: "081 234 5678" },
    channel: "site_form", source: "contact-page",
  };

  const whatsapp = {
    venture: "RUGBY", agent: "whatsapp-bot", type: "ACTION", priority: "P1", status: "DONE",
    summary: "Message entrant", needs_owner: true,
    contact: { name: "Kelsey Family", phone: "+66 81 234 5678" },
    channel: "whatsapp",
  };

  it("la même personne sur deux canaux = UNE fiche", () => {
    const a = ingest(csra);
    const b = ingest(whatsapp);
    expect(a?.key).toBe("phone:66812345678");
    expect(b?.key).toBe(a?.key);
  });

  it("un lead coco2 encore déployé sans contact structuré produit quand même une fiche", () => {
    const p = ingest({
      venture: "COCO", agent: "lead-capture", type: "ACTION", priority: "P2", status: "DONE",
      summary: "Nouveau lead hôtel", needs_owner: true,
      details: "id=lead_9 name=Anna email=anna@hotel.com phone=N/A lang=en",
    });
    expect(p?.key).toBe("email:anna@hotel.com");
    expect(p?.venture).toBe("COCO");
  });

  it("un cron ne crée aucune fiche", () => {
    expect(ingest({
      venture: "GLOBAL", agent: "cron", type: "ACTION", priority: "P3", status: "DONE",
      summary: "Brief du matin envoyé", details: "duree=1.2s",
    })).toBeNull();
  });

  it("un contact mal formé est refusé à la porte, pas avalé", () => {
    const r = readIngestEvent({
      venture: "RUGBY", agent: "x", type: "ACTION", priority: "P1", status: "DONE",
      summary: "s", contact: "kelsey@exemple.com",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toMatch(/contact/);
  });
});
