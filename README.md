# Stadtstack · Stadt gemeinsam ausprobieren

A mobile-first overview of the owner's current city projects, with explicit pilot status, test-network boundaries and public links. Updated 10 October 2026.

Live at https://stadtstack.eu since 30 September 2026, on the owner's Talos cluster (Helm release `stadtstack-site`). `www.stadtstack.eu` redirects to the apex and `roebel.stadtstack.eu` to the Röbel pilot apps.

## Explore

- Ledger of Life: housing/deposits on Solana, Have your say, cross-city topics, sourced city AI, loyalty map and offline Home Node.
- ZK Loyalty: local-shop pilot on Sepolia.
- The game, and the unchanged closed participation site.
- Ledger Lite / Gnosis mesh: a one-radio-hop LoRa/Reticulum lab demo, not a citywide payment network.
- Civic data pipeline and verified hosted MCP at `https://mcp.stadtstack.eu/mcp`: protected personal-token, read-only access, not native OAuth or a ready-made ChatGPT connector. The card links the public health endpoint.

All blockchain units are test units without monetary value or rights. Participation is advisory. This is not an official municipal service.

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
| `app/page.tsx` | Current project overview and public links |
| `app/projects.css` | Mobile-first project cards in the existing Stadtstack typography and palette |
| `app/stadtstack-content.ts` | German and English content: levels, entities and their kinds, relations with verbs, cross-cutting connections, stories with scene cues, and the 17-topic mapping |
| `app/stadtstack-models.ts` | Procedural city: the shared site plan in four lenses, the comparable city, higher institutions, dimming, and story cues |
| `app/stadtstack-scene.tsx` | Three.js renderer, camera framing, SVG relationship ink, anchored labels, picking, keyboard rotation, and lifecycle |
| `app/stadtstack-experience.tsx` | Earlier illustrative architecture model, retained as source/design reference, not mounted on the homepage |
| `app/globals.css` | Visual system and responsive layout |

Fonts are self-hosted in `public/fonts` (SIL Open Font License), so visitors' browsers do not contact third-party font servers. The current homepage does not load the earlier Three.js scene.

See [the design rationale](docs/overview-proposal.md) for the 17-to-4 mapping and the source for the proposed role of S2Vec. The earlier illustration and its prompt are stored in `docs/concepts/`.

## Publish

`npm run build` runs `next build --webpack` and exports static files to `out/`. The site needs no application server, external fonts or private build values. The image serves the apex and redirects `www` and the Röbel pilot host with a non-root, read-only nginx runtime.

CI validates dependencies, lint, TypeScript and the export. The Image workflow runs for `image-*` tags (or manually), builds linux/amd64 and publishes `ghcr.io/giraeffleaeffle/stadtstack-site`. Pin the printed digest before deployment; empty digests fail rendering deliberately. See [deployment instructions](deploy/README.md). No cluster or DNS mutation is performed by the build.

## Import provenance

The working tree was imported from the owner's OpenAI Sites project (source HEAD `5adde777c814cd07dfcacec7271c9b74af2c1a05`). Source history could not be cloned from its iCloud-backed object storage; the source was left untouched. Copied files were checked byte-for-byte by SHA-256. Sites/Cloudflare tooling is not part of this static-export deployment.
