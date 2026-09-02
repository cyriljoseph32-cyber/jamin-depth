# jamin-depth — notes pour Claude

## Cartographie du code (graphify)

`graphify-out/` contient une cartographie locale et déterministe du code (AST via
tree-sitter, `graphify extract . --code-only` — pas de LLM, rien n'a quitté la machine).
Avant de grepper le code pour une question d'architecture (« qui appelle X », « comment Y
est connecté »), préférer :

```bash
graphify query "<question>"        # sous-graphe ciblé pour une question en langage naturel
graphify explain "<Symbole>"       # voisins + arêtes taguées EXTRACTED/INFERRED d'un nœud
graphify path "<A>" "<B>"          # plus court chemin entre deux concepts
graphify god-nodes                 # fichiers/symboles les plus connectés (hubs)
```

`graphify-out/graph.html` s'ouvre directement dans un navigateur pour une exploration
visuelle. À régénérer après un refactor significatif : `graphify extract . --code-only &&
graphify cluster-only . --no-label` (depuis la racine du dépôt ; nécessite `uv tool install
graphifyy`, CLI [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)).

## Mémoire centrale

La mémoire transverse des projets de Cyril vit dans le dépôt
`cyriljoseph32-cyber/Coconut-Samui-Rugby-Academy`, dossier `brain/memoire/` — la fiche de ce
projet est `brain/memoire/projets/jamin-depth.md`. Au début d'une tâche, la consulter si
elle est accessible (checkout voisin `/home/user/Coconut-Samui-Rugby-Academy/` ou via
GitHub). Après un changement majeur ici, mettre à jour la fiche + `brain/memoire/journal.md`,
ou le signaler à Cyril pour que l'agent `memory` s'en charge.
