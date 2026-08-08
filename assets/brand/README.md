# Logo — fichiers et usages

Le dessin d'origine du propriétaire est `logo-master.png` : illustration
couleur sur papier crème. **Aucun trait n'a été redessiné et aucune couleur de
l'illustration n'a été modifiée.** Les fichiers livrés en sont dérivés par
`npm run brand:logo` (voir `scripts/build-logo.mjs`).

Relancer la commande après toute modification du master.

## Ce que le script fait, et ne fait pas

Deux opérations, pas une de plus :

1. **Détourage.** Le papier crème est rendu transparent, pour que le logo se
   pose sur n'importe quel fond au lieu de trimballer un rectangle beige.
2. **Lettrage sur fond sombre.** Le marine du lettrage (`#0b222d`) est
   invisible sur le fond du site (`#05080d`) : dans la variante sombre, et là
   seulement, les trois mots passent en `--color-foam`. La vague, le compas, le
   monogramme et le plongeur ne bougent pas — ils se lisent très bien tels quels.

Le lettrage est isolé par trois tests combinés : deux bandes horizontales
(JAMMIN'S s'arrête à y 445 ; les palmes finissent à y 1082 et DEPTH commence à
1085), un rayon autour du blason, et la couleur elle-même. Sans le rayon, les
contours sombres du plongeur et de la vague seraient emportés avec les mots.

## Palette — c'est le logo qui la donne

Le site ne dicte pas ses couleurs au logo : **c'est l'inverse**. Un clustering
des pixels saturés du dessin sort huit teintes nettes, qui couvrent exactement
les rôles dont l'interface a besoin. Elles sont reportées telles quelles dans le
bloc `@theme` de `src/app/globals.css`, qui fait foi pour tout le site.

| Teinte du logo | Où elle est dans le dessin | Jeton |
|---|---|---|
| `#061f2a` | le marine du lettrage | `--color-blueblack` / `--color-abyss` |
| `#08323c` | teal profond | `--color-abyss-2` |
| `#25676a` | la vague | `--color-petrol` |
| `#ac8431` | l'or du compas et du bloc | `--color-signal-600` |
| `#832e2b` | le rouge du compas | `--color-error` |
| `#276032` | le vert du compas | `--color-deepgreen`, `--color-success` |
| `#d4e1cd` | les rehauts clairs | `--color-foam` |

Deux ajustements, et seulement deux, pour la lisibilité :

- **L'accent** est l'or du logo remonté à `#d9a83f`. À sa valeur dessinée il
  passe le AA (5,5:1) mais éteint nettement les boutons WhatsApp. L'or exact
  reste dans le système, en `--color-signal-600`, au survol.
- **Le rouge et le vert du compas** sont remontés eux aussi : tels que dessinés
  ils sont à 2,2:1 et 2,5:1 sur le fond, donc illisibles en texte.

Chaque paire réellement lue par un visiteur est vérifiée au contraste WCAG AA
par `src/lib/palette.test.ts`, qui lit `globals.css` directement. Modifier une
valeur sans vérifier fait échouer `npm test`.

### Ce que ça règle

L'or du logo **est** désormais l'accent du site. Avant, le jaune des CTA
(`#ffc300`) et l'or du dessin étaient deux jaunes différents qui se
concurrençaient dès qu'ils se croisaient. Il n'y en a plus qu'un.

En contrepartie, le rouge et le vert du compas portent maintenant un sens
fonctionnel — erreur et succès dans les formulaires. C'est le mapping naturel,
mais il faut le savoir : le rouge de la marque voudra dire « quelque chose ne va
pas » ailleurs dans l'interface.

## Quel fichier utiliser

Tous les PNG ci-dessous ont un fond **transparent**, sauf `logo-square`,
`icon-maskable` et `logo-card`.

| Fichier | Pour quoi |
|---|---|
| `public/brand/logo-lockup-light.png` | Le logo complet, tel que dessiné. Sur fond blanc ou crème : **flyers, cartes de visite, papier à en-tête, affiches.** |
| `public/brand/logo-lockup-dark.png` | Le logo complet, lettrage clair. Pied de page du site, slides et supports sur fond noir. |
| `public/brand/logo-badge.png` | Le blason seul, sans lettrage — donc identique quel que soit le fond. En-tête du site, tampon, filigrane, coin de photo. À utiliser dès que le logo descend sous ~80 px : à cette taille sa propre typo n'est plus lisible. |
| `public/brand/logo-lockup-mono-ink.png` | Une seule couleur, sombre. Impression noir et blanc, tampon encreur, gravure, broderie. |
| `public/brand/logo-lockup-mono-foam.png` | Une seule couleur, claire. Sérigraphie sur textile foncé, marquage sur combinaison. |
| `public/brand/logo-square.png` | Carré opaque 512 px. Photo de profil : Google Business, Facebook, Instagram, WhatsApp Business. |
| `public/brand/logo-card.png` | Bandeau 1200×630. Couverture Facebook, visuel d'événement, dossier de presse. |
| `src/app/icon.png`, `src/app/apple-icon.png`, `public/brand/icon-maskable.png` | Favicon, icône iOS, icône Android. Générés, ne pas éditer à la main. |

La carte de partage du site (Open Graph) n'est pas un fichier : elle est composée
à la volée par `src/app/opengraph-image.tsx`, qui incruste le blason à côté du
slogan et du numéro WhatsApp.

### Pourquoi les versions une couleur viennent d'un autre fichier

`logo-master-line.png` est le même logo au trait, également fourni par le
propriétaire. Les versions une couleur en sont tirées, et pas de l'illustration :
celle-ci est faite d'aplats, donc l'aplatir en une seule teinte transforme le
plongeur, la vague et le monogramme en une silhouette pleine — le JD disparaît
purement et simplement. Une version une couleur se dessine, elle ne se déduit pas.

## Zone de protection et taille minimale

- Laisser autour du logo une marge au moins égale à la hauteur du mot `DEPTH`.
- Blason seul : ne pas descendre sous 24 px de côté.
- Verrouillage complet : ne pas descendre sous 80 px de large, sinon
  `PLONGÉE SOUS-MARINE` devient illisible — utiliser le blason à la place.
- Ne pas déformer, ne pas faire pivoter, ne pas ajouter d'ombre portée.

## Limite connue — à traiter par le propriétaire

Le master couleur fait **752 × 1409 px**, et le dessin lui-même 720 × 1030. C'est
confortable pour l'écran, mais **court pour l'impression** : à 300 dpi cela ne
fait qu'environ 6 cm de large. Au-delà d'un flyer A5, le logo se pixellisera.

Pour de l'impression grand format (bâche, kakémono, t-shirt, A4 pleine page),
fournir le **fichier vectoriel d'origine** (`.ai`, `.eps`, `.svg` ou `.pdf`) ou à
défaut un export d'au moins 3000 px de large. Le déposer ici sous le nom
`logo-master.png` et relancer `npm run brand:logo`.

Un export PNG « sur fond transparent » depuis un aperçu ne convient pas : le
damier gris et blanc y est peint dans les pixels, il ne correspond à aucun canal
alpha. Un fichier de ce type a déjà été écarté pour cette raison.

## Point à trancher — orthographe

Le dessin porte **`DEPTH`** (singulier) alors que le site écrit partout
**« Jammin's Depths »** (pluriel, défini dans `src/content/site.ts`). Les deux
apparaissent aujourd'hui côte à côte dans le pied de page. Aucune des deux
graphies n'a été modifiée : c'est une décision de marque, pas une correction
technique. Une fois tranchée, un seul fichier est à toucher — soit le dessin,
soit `SITE.name`.
