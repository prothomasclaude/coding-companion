# Coding Companion — Roadmap

Plan d'amélioration classé par impact décroissant.
Chaque feature est marquée d'un statut : `[ ]` à faire, `[~]` en cours, `[x]` fait.

---

## Phase 1 — Donner vie au sprite (impact max, effort modéré)

### 1.1 `[ ]` Idle aléatoire & micro-animations
Le sprite ne fait actuellement qu'une seule frame en idle. Ajouter plusieurs variantes d'idle qui se déclenchent aléatoirement : bâillement, regard autour de soi, se gratter la tête, s'asseoir.

**Changements :**
- Manifest : ajouter un champ `states.idle.animations[]` (comme working) + `swapInterval`
- `index.html` : réutiliser la logique de swap déjà en place pour `working`
- Sprites : créer les frames additionnelles pour le peon

### 1.2 `[ ]` Clic interactif sur le sprite
Cliquer sur le sprite déclenche une réplique et une animation aléatoire (style pet/tamagotchi).

**Changements :**
- `index.html` : event listener `click` sur `#drag-handle`, distinguer clic vs drag
- Manifest : nouveau pool de lignes `poke` (texte + son)
- Animation : jouer une anim courte (sursaut, salut) puis retour à l'état courant

### 1.3 `[ ]` Animations de transition
Au lieu de couper net entre états, jouer une animation de passage (ex: le peon se lève, attrape son outil, puis commence à travailler).

**Changements :**
- Manifest : champ optionnel `transitions` : `{ "idle→working": "get_up", "working→idle": "put_down" }`
- `index.html` : dans `updateState()`, jouer la transition avant de lancer l'état cible
- Sprites : créer les frames de transition

### 1.4 `[ ]` Réactions contextuelles aux hooks
Étendre le status.json pour transporter un `context` en plus de `state`, permettant au sprite de réagir différemment selon l'action (erreur, commit, test fail, écriture de fichier).

**Changements :**
- `hooks/set-status.sh` : accepter un 2e paramètre optionnel `context` (ex: `error`, `commit`, `test_fail`)
- `status.json` : `{ "state": "working", "context": "error", "timestamp": ... }`
- `main.js` : transmettre le context au renderer
- `index.html` : si un context est présent, jouer une animation/ligne spécifique (sprite triste sur erreur, célébration sur commit)
- Manifest : nouveau champ `contexts` avec animations/lignes dédiées

---

## Phase 2 — Interaction & ambiance (impact élevé, effort modéré)

### 2.1 `[ ]` Réaction au curseur
Le sprite suit la souris des yeux ou s'écarte quand on approche.

**Changements :**
- `index.html` : écouter `mousemove` sur le container, calculer la direction relative
- Sprite : variantes de frames avec yeux dans différentes directions (ou rotation CSS légère)
- Attention : limité sur X11 (`getCursorScreenPoint` non fiable), à implémenter côté renderer uniquement

### 2.2 `[ ]` Horloge interne
Comportement différent selon l'heure : dort la nuit, boit un café le matin, s'étire en fin de journée.

**Changements :**
- `index.html` : vérifier `new Date().getHours()` dans le timer de random bubbles
- Manifest : champ optionnel `timeSlots` avec animations/lignes par tranche horaire
- Sprites : frames de sommeil, café, etc.

### 2.3 `[ ]` Sons contextuels & musique d'ambiance
Petit son de clavier pendant working, ding à finished. Option lo-fi en fond.

**Changements :**
- Sons d'ambiance en boucle pendant `working` (volume bas, loop)
- Ding/chime sur transition `working→finished`
- Option musique lo-fi dans le tray menu (toggle on/off)
- Volume configurable dans `config.json`

### 2.4 `[ ]` Notifications quand inactif
Si Claude finit une tâche et que l'utilisateur est sur une autre fenêtre, afficher une notification système.

**Changements :**
- `main.js` : utiliser `Notification` d'Electron quand `state` passe à `idle` après `working`
- Optionnel : configurable dans le tray menu

---

## Phase 3 — Progression & engagement (impact moyen, effort moyen)

### 3.1 `[ ]` Compteur de sessions & stats
Tracker le nombre de sessions Claude Code, le temps total, le nombre de prompts.

**Changements :**
- Nouveau fichier `stats.json` (gitignored) : `{ sessions: N, totalTime: ms, prompts: N }`
- `main.js` : incrémenter à chaque changement de status
- Affichage dans le tray menu : "Sessions: 42 | Total: 12h"

### 3.2 `[ ]` Streak de jours consécutifs
Compteur de jours consécutifs d'utilisation affiché dans le tray.

**Changements :**
- `stats.json` : champ `lastActiveDate`, `streak`
- `main.js` : mettre à jour au démarrage
- Tray : afficher le streak

### 3.3 `[ ]` Achievements / badges
Débloquer des badges à certains seuils (100 prompts, 10h de coding, premier lundi matin, etc.).

**Changements :**
- Fichier `achievements.json` : définitions des achievements avec conditions
- `stats.json` : liste des achievements débloqués
- Notification + animation spéciale quand un achievement est débloqué
- Tray menu : sous-menu "Achievements" avec la liste

### 3.4 `[ ]` XP & évolution du sprite
Le sprite gagne de l'expérience et change d'apparence au fil du temps.

**Changements :**
- `stats.json` : champ `xp`, `level`
- Manifest : champ optionnel `evolution` avec des skins par niveau
- Le sprite change visuellement (couleur, accessoires) selon le level

---

## Phase 4 — Customisation & communauté (impact moyen, effort élevé)

### 4.1 `[ ]` Thèmes de bulle de dialogue
Styles différents pour la bulle : pixel art, moderne, comic, minimal.

**Changements :**
- CSS : plusieurs classes de thème pour `#speech-bubble`
- Config : champ `bubbleTheme` dans `config.json`
- Config window : sélecteur de thème

### 4.2 `[ ]` Accessoires équipables
Chapeaux, lunettes, objets qu'on peut overlay sur n'importe quel sprite.

**Changements :**
- Dossier `accessories/` avec des PNGs transparents
- `index.html` : 2e `<img>` en overlay positionné selon un anchor point du manifest
- Config window : UI de sélection d'accessoire

### 4.3 `[ ]` Éditeur de sprite pack
UI simple pour créer un pack à partir d'un spritesheet : découpe automatique, preview des anims, export du manifest.

**Changements :**
- Nouvelle fenêtre Electron `editor.html`
- Canvas pour découper un spritesheet en frames
- Preview d'animation en temps réel
- Génération automatique du `manifest.json`

### 4.4 `[ ]` Pack marketplace / community
Script ou UI pour télécharger des sprite packs depuis un repo GitHub.

**Changements :**
- Repo GitHub `coding-companion-packs` avec des packs community
- Commande ou bouton "Browse Packs" dans la config window
- Téléchargement + installation dans `sprites/`

---

## Phase 5 — Intégration avancée (impact moyen, effort élevé)

### 5.1 `[ ]` Hooks Git enrichis
Réaction spécifique au commit, push, merge, rebase.

**Changements :**
- Hooks git (post-commit, post-push) qui écrivent dans `status.json` avec context
- Animations dédiées dans le manifest

### 5.2 `[ ]` Multi-écran
Le sprite peut se déplacer entre les écrans.

**Changements :**
- `main.js` : détecter tous les displays, permettre le drag cross-screen
- Ajuster le clamping de position pour couvrir tous les écrans

### 5.3 `[ ]` Système de plugins
Architecture pour que des tiers ajoutent des comportements custom.

**Changements :**
- Dossier `plugins/` avec un loader
- API exposée : `registerState()`, `registerAnimation()`, `registerTrayItem()`
- Documentation du plugin API

### 5.4 `[ ]` Auto-update
Vérification de nouvelles versions au démarrage.

**Changements :**
- `electron-updater` ou check manuel via GitHub releases API
- Notification dans le tray si une mise à jour est dispo

---

## Phase 6 — Polish technique

### 6.1 `[ ]` Migration vers OffscreenCanvas / WebGL
Pour les effets visuels lourds (particules, aura), passer à un canvas GPU.

### 6.2 `[ ]` Sprite walk-to-position
Au lieu de téléporter, le sprite marche vers sa nouvelle position quand on le drag.

### 6.3 `[ ]` Easter egg mini-jeu
Cliquer X fois rapidement sur le sprite déclenche un mini-jeu caché.

---

> **Prochaine étape suggérée :** Phase 1.1 — Idle aléatoire
