# Logo — fichiers et usages

Le dessin d'origine du propriétaire est `logo-master.png`. **Aucun trait n'a été
redessiné.** Les fichiers livrés sont le même dessin, recoloré dans la palette du
site par `npm run brand:logo` (voir `scripts/build-logo.mjs`).

Relancer la commande après toute modification du master.

## Palette

Les couleurs sont celles du `@theme` de `src/app/globals.css` :

| Rôle | Jeton | Valeur |
|---|---|---|
| Traits sur fond sombre | `--color-foam` | `#f2f5f4` |
| Traits sur fond clair | `--color-abyss` | `#0a1119` |
| Lavis de la vague (clair) | proche `--color-petrol` | `#125c72` |
| Lavis de la vague (sombre) | petrol éclairci | `#4f93a6` |
| Fond de référence | `--color-blueblack` | `#05080d` |

Le jaune `--color-signal` **n'entre pas** dans le logo : sur ce site il ne signifie
qu'une seule chose, « clique ici ». S'il apparaissait aussi dans le logo, il
cesserait d'être un signal.

## Quel fichier utiliser

Tous les PNG ci-dessous ont un fond **transparent**, sauf `logo-square` et
`logo-card`.

| Fichier | Pour quoi |
|---|---|
| `public/brand/logo-lockup-dark.png` | Le logo complet, sur fond sombre. Pied de page du site, slides, kakémonos sur fond noir. |
| `public/brand/logo-lockup-light.png` | Le logo complet, sur fond blanc ou crème. **Flyers, cartes de visite, papier à en-tête, affiches.** |
| `public/brand/logo-badge-dark.png` | Le blason seul, fond sombre. En-tête du site. À utiliser dès que le logo descend sous ~80 px : à cette taille sa propre typo n'est plus lisible. |
| `public/brand/logo-badge-light.png` | Le blason seul, fond clair. Tampon, filigrane, coin de photo. |
| `public/brand/logo-lockup-mono-ink.png` | Une seule couleur, sombre. Impression noir et blanc, tampon encreur, gravure, broderie, fax. |
| `public/brand/logo-lockup-mono-foam.png` | Une seule couleur, claire. Marquage sur combinaison, sérigraphie sur textile foncé. |
| `public/brand/logo-square.png` | Carré opaque 512 px. Photo de profil : Google Business, Facebook, Instagram, WhatsApp Business. |
| `public/brand/logo-card.png` | Bandeau 1200×630. Couverture Facebook, visuel d'événement, dossier de presse. |
| `src/app/icon.png`, `src/app/apple-icon.png` | Favicon et icône iOS. Générés, ne pas éditer à la main. |

La carte de partage du site (Open Graph) n'est pas un fichier : elle est composée
à la volée par `src/app/opengraph-image.tsx`, qui incruste le blason à côté du
slogan et du numéro WhatsApp.

## Zone de protection et taille minimale

- Laisser autour du logo une marge au moins égale à la hauteur du mot `DEPTH`.
- Blason seul : ne pas descendre sous 24 px de côté.
- Verrouillage complet : ne pas descendre sous 80 px de large, sinon
  `PLONGÉE SOUS-MARINE` devient illisible — utiliser le blason à la place.
- Ne pas déformer, ne pas faire pivoter, ne pas ajouter d'ombre portée.

## Limite connue — à traiter par le propriétaire

Le master fourni fait **547 × 1024 px**, et le dessin lui-même n'en occupe que
516 × 724. C'est confortable pour l'écran, mais **insuffisant pour l'impression** :
à 300 dpi cela ne fait qu'environ 4,4 cm de large. Au-delà d'un flyer A6, le logo
se pixellisera.

Pour de l'impression grand format (bâche, kakémono, t-shirt, A4 pleine page),
fournir le **fichier vectoriel d'origine** (`.ai`, `.eps`, `.svg` ou `.pdf`) ou à
défaut un export d'au moins 3000 px de large. Le déposer ici sous le nom
`logo-master.png` (ou adapter le chemin en tête de `scripts/build-logo.mjs`) et
relancer `npm run brand:logo` : rien d'autre n'est à changer.

## Point à trancher — orthographe

Le dessin porte **`DEPTH`** (singulier) alors que le site écrit partout
**« Jammin's Depths »** (pluriel, défini dans `src/content/site.ts`). Les deux
apparaissent aujourd'hui côte à côte dans le pied de page. Aucune des deux
graphies n'a été modifiée : c'est une décision de marque, pas une correction
technique. Une fois tranchée, un seul fichier est à toucher — soit le dessin,
soit `SITE.name`.
