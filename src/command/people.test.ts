import { describe, expect, it } from "vitest";
import { contactFromDetails, personFromEvent } from "./people";
import type { CommandEventInput } from "./types";

/**
 * Le critère de fin du chantier 2, tel qu'il est écrit dans le plan 90 jours :
 * « une personne qui écrit sur WhatsApp puis remplit un formulaire apparaît
 * comme UNE SEULE fiche ». Ces tests le vérifient littéralement.
 */

const base: CommandEventInput = {
  venture: "RUGBY",
  agent: "csra-web-form",
  type: "ACTION",
  priority: "P1",
  status: "DONE",
  summary: "Demande d'essai",
  details: "",
  links: [],
  next_action: "",
  needs_owner: true,
  level: 3,
};

const ev = (over: Partial<CommandEventInput> & Record<string, unknown>): CommandEventInput =>
  ({ ...base, ...over }) as CommandEventInput;

describe("personFromEvent — identité", () => {
  it("UNE seule fiche pour la même personne via WhatsApp puis formulaire", () => {
    const whatsapp = personFromEvent(
      ev({ agent: "whatsapp-bot", contact: { name: "Sarah", phone: "+66 81 234 5678" } }),
    );
    const formulaire = personFromEvent(
      ev({ agent: "csra-web-form", contact: { name: "Sarah M.", phone: "0812345678", email: "sarah@exemple.com" } }),
    );

    // Le formulaire donne le numéro au format local, WhatsApp l'international :
    // c'est LE cas courant à Samui, et il doit produire une seule et même fiche.
    expect(whatsapp?.key).toBe("phone:66812345678");
    expect(formulaire?.key).toBe(whatsapp?.key);
    expect(whatsapp?.channel).toBe("whatsapp");
    expect(formulaire?.channel).toBe("site_form");
  });

  it("le même numéro écrit de trois façons donne une seule clé", () => {
    const keys = ["+66 63 375 3316", "+66633753316", "66-63-375-3316"].map(
      (phone) => personFromEvent(ev({ contact: { phone } }))?.key,
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("l'e-mail dédoublonne quand il n'y a pas de téléphone, insensible à la casse", () => {
    const a = personFromEvent(ev({ contact: { email: "Cyril@Exemple.COM" } }));
    const b = personFromEvent(ev({ contact: { email: "cyril@exemple.com  " } }));
    expect(a?.key).toBe("email:cyril@exemple.com");
    expect(a?.key).toBe(b?.key);
  });

  it("le téléphone prime sur l'e-mail — c'est l'identifiant le plus stable", () => {
    const p = personFromEvent(ev({ contact: { phone: "+66811112222", email: "x@y.com" } }));
    expect(p?.key).toBe("phone:66811112222");
  });
});

describe("personFromEvent — ce qui ne doit créer AUCUNE fiche", () => {
  it("un événement sans coordonnée (un cron qui tourne)", () => {
    expect(personFromEvent(ev({ agent: "cron", details: "job=daily-brief duree=1.2s" }))).toBeNull();
  });

  it("un nom seul — « Marie » n'est pas une identité", () => {
    expect(personFromEvent(ev({ contact: { name: "Marie" } }))).toBeNull();
  });

  it("un téléphone trop court pour être un vrai numéro", () => {
    expect(personFromEvent(ev({ contact: { phone: "1234" } }))).toBeNull();
  });

  it("une chaîne qui ressemble à un e-mail sans en être un", () => {
    expect(personFromEvent(ev({ contact: { email: "pas-une-adresse" } }))).toBeNull();
  });
});

describe("contactFromDetails — le filet pour les émetteurs déjà déployés", () => {
  it("relit le format réellement produit par CSRA en production", () => {
    const details =
      "nom=Kelsey Family · email=kelsey@exemple.com · tel=+66 63 375 3316 · age_enfant=8 · programme=Kids (4-12) · source=contact-page";
    expect(contactFromDetails(details)).toEqual({
      email: "kelsey@exemple.com",
      phone: "+66 63 375 3316",
      name: "Kelsey Family",
    });
  });

  it("relit le format réellement produit par coco2 en production", () => {
    const details = "id=lead_123 name=Anna email=anna@hotel.com phone=N/A lang=en";
    const c = contactFromDetails(details);
    expect(c.email).toBe("anna@hotel.com");
    expect(c.name).toBe("Anna");
    // `N/A` est une absence, pas un numéro.
    expect(c.phone).toBeUndefined();
  });

  it("un événement déployé aujourd'hui produit déjà une fiche, sans redéploiement", () => {
    const p = personFromEvent(ev({ agent: "lead-capture", venture: "COCO", details: "name=Bob email=bob@hotel.com" }));
    expect(p?.key).toBe("email:bob@hotel.com");
    expect(p?.venture).toBe("COCO");
  });

  it("ne devine jamais une adresse au milieu d'une phrase", () => {
    expect(contactFromDetails("le client a mentionné contact@ailleurs.com dans sa question")).toEqual({});
  });

  it("le contrat structuré l'emporte sur les details", () => {
    const p = personFromEvent(
      ev({ contact: { email: "vrai@exemple.com" }, details: "email=ancien@exemple.com" }),
    );
    expect(p?.key).toBe("email:vrai@exemple.com");
  });
});

describe("personFromEvent — canal et provenance", () => {
  it("respecte le canal déclaré par l'émetteur", () => {
    expect(personFromEvent(ev({ channel: "instagram", contact: { handle: "@sarah" } }))?.channel).toBe("instagram");
  });

  it("ignore un canal inventé et retombe sur la déduction", () => {
    expect(personFromEvent(ev({ channel: "pigeon", contact: { email: "a@b.com" } }))?.channel).toBe("site_form");
  });

  it("déduit le canal de l'agent émetteur à défaut", () => {
    expect(personFromEvent(ev({ agent: "chat.js", contact: { email: "a@b.com" } }))?.channel).toBe("site_chat");
  });

  it("garde la provenance pour retrouver le premier point de contact", () => {
    expect(personFromEvent(ev({ source: "contact-page", contact: { email: "a@b.com" } }))?.source).toBe("contact-page");
  });
});
