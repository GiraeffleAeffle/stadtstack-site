# Stadtstack · One city, seen four ways

An interactive, bilingual architecture model for cities that share infrastructure, make informed decisions, and learn from outcomes.

Public origin: https://stadtstack.eu. Deployment is owner-controlled; this repository does not claim the new host is already live.

## Explore

- **The same square on four levels.** One city block is shown four times, as a stacked, exploded model: built (infrastructure), measured and understood (knowledge), discussed and decided (decisions), and changed (delivery). A plumb line marks the same square on every level.
- **Follow a relationship.** Select a level or any object in the model. Ink threads with verbs – powers, observes, explains, decides, delivers, evaluates, shares – show what it depends on and what it informs. The card names who is responsible and how rights apply.
- **Follow a story.** Heat protection, emergency preparedness, and housing move step by step through the scene. Measurements and scenarios are labeled differently, decisions stay with people, and outcomes flow back into the city's knowledge.
- **Across all levels.** Rights & trust frame the whole stack; a comparable city and the regional, national, and EU level connect laterally and upward, without becoming extra levels.
- **Look closer** opens the stack at one level; **Whole city** returns to the overview. Arrow keys rotate the model; Escape steps back.
- The original 17 topics remain available in contextual model details and the design notes.

The website is an architecture model. Displayed data, scenarios, and connections are illustrative; it does not connect to live municipal services or implement the proposed city game, S2Vec pipeline, or regulatory processes.

## Develop

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

| File | Responsibility |
| --- | --- |
| `app/stadtstack-content.ts` | German and English content: levels, entities and their kinds, relations with verbs, cross-cutting connections, stories with scene cues, and the 17-topic mapping |
| `app/stadtstack-models.ts` | Procedural city: the shared site plan in four lenses, the comparable city, higher institutions, dimming, and story cues |
| `app/stadtstack-scene.tsx` | Three.js renderer, camera framing, SVG relationship ink, anchored labels, picking, keyboard rotation, and lifecycle |
| `app/stadtstack-experience.tsx` | Page, selection and story state, field card, legend and bilingual Stadtstack family |
| `app/globals.css` | Visual system and responsive layout |

Fonts are self-hosted in `public/fonts` (SIL Open Font License), so visitors' browsers do not contact third-party font servers. The scene renders only while something moves, pauses outside the viewport, respects reduced motion, and shows `public/stadtstack-overview.png` with the same native controls if WebGL is unavailable.

See [the design rationale](docs/overview-proposal.md) for the 17-to-4 mapping and the source for the proposed role of S2Vec. The earlier illustration and its prompt are stored in `docs/concepts/`.

## Publish

`npm run build` runs `next build --webpack` and exports static files to `out/`. The site needs no application server, external fonts or private build values. The image serves the apex and redirects `www` and the Röbel pilot host with a non-root, read-only nginx runtime.

CI validates dependencies, lint, TypeScript and the export. The Image workflow runs for `image-*` tags (or manually), builds linux/amd64 and publishes `ghcr.io/giraeffleaeffle/stadtstack-site`. Pin the printed digest before deployment; empty digests fail rendering deliberately. See [deployment instructions](deploy/README.md). No cluster or DNS mutation is performed by the build.

## Import provenance

The working tree was imported from the owner's OpenAI Sites project (source HEAD `5adde777c814cd07dfcacec7271c9b74af2c1a05`). Source history could not be cloned from its iCloud-backed object storage; the source was left untouched. Copied files were checked byte-for-byte by SHA-256. Sites/Cloudflare tooling is not part of this static-export deployment.
