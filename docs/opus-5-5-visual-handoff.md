# Opus 5-5 handoff: make Stadtstack feel like one connected civic system

Prepared 26 September 2026.

## Assignment

Review and substantially elevate the visual and interactive design of Stadtstack. Deliver a working website that makes its underlying relationships understandable through the experience itself. The user wants something visually distinctive, thoughtful, and memorable, with the feeling that all of this belongs to one living city.

**Central idea: one city, understood through its resources, knowledge, collective agency, and the changes it makes in the world.**

Current site: https://stadtstack.eu/#explore

Local project: this repository.

The current implementation has four interactive Three.js scenes, selectable levels and connections, close-up views, German and English explanations, and three example journeys. You have creative freedom over composition, navigation, illustration, typography, materials, transitions, and how the relationships become visible. Carry the work through implementation and verification.

## 1. Inspect the existing experience and its meaning

Open the live page and run the local project. Explore an overview, a selected level, a close-up, each cross-cutting connection, and an example journey on desktop and a phone-sized viewport.

Read these files before designing:

- `docs/overview-proposal.md`: the accepted four-level model, the complete mapping of the original 17 topics, and the reasons for the grouping.
- `app/stadtstack-content.ts`: the current bilingual explanations and example journeys.
- `docs/concepts/stadtstack-four-levels-v2.png`: the illustration the user liked. Its appeal is the coherent city world, spatial clarity, generous platforms, and the relationship between local activity and the surrounding institutions and cities.
- `CONTEXT.md`: definitions when interpreting evidence, rights, ownership, scenarios, comparative places, and democratic responsibility. The four-level proposal takes precedence over earlier organizational suggestions.

The earlier five-area proposal placed too much emphasis on ownership and was superseded. Preserve the accepted balance.

**Done when:** you can explain the system's main feedback loop and identify where the current page makes its relationships visible, where it leaves them to prose, and which visual changes would improve understanding.

## 2. Establish a coherent visual concept

Keep four understandable entry points:

| Entry point | Its role in the whole |
| --- | --- |
| Infrastructure | Places, buildings, energy, networks, radio, local computing, storage, and shared resources make action possible. |
| Observe & understand | Observations become usable knowledge through open data, provenance, spatial analysis, maps, the city game, explanations, and assisting AI. |
| Deliberate & decide | People interpret evidence, express interests, weigh alternatives, and decide through the responsible democratic institutions. |
| Act & deliver | Decisions become work, services, maintained infrastructure, and outcomes that can be evaluated. |

These describe different roles within a connected system. They also provide a manageable way into the original 17 topics. You may reinterpret the literal stacked-platform presentation while retaining these four entry points and the complete subject coverage.

Make the ontology tangible: distinguish **things and places**, **observations and representations**, **people and institutions**, **decisions and actions**, and **outcomes and constraints**. Give their relationships a legible visual language. Use everyday words in the interface; visitors should understand the relationships without learning ontological terminology.

A promising direction is **the same city seen through four connected lenses**. A recognizable place, building, or public space persists as the visitor moves from its physical reality to what is known about it, to a decision affecting it, to a visible change. Spatial continuity can make the concept much stronger than explaining each part separately.

Choose one strong art direction. Explore a crafted civic miniature, editorial illustration, or another spatial language that suits the idea. Give lighting, depth, materials, people, landmarks, typography, and the surrounding page a consistent character. Preserve the warmth and readability the user liked in the illustrated concept, with meaningful detail in close-up views.

**Done when:** you have a short design thesis, a consistent visual grammar for entities and relationships, and a clear account of what a visitor experiences on first arrival and after their first selection.

## 3. Make connection the main interaction

Implement a small set of strong interactions that explain the whole. The following are directions to develop, rather than a mandatory feature checklist:

- **Follow a relationship.** Selecting an object reveals what it depends on, what it informs or enables, and who is responsible. Keep enough surrounding context visible to understand those links. Label relationships with verbs such as observes, explains, informs, decides, implements, evaluates, and shares.
- **Follow one civic story.** Let an example guide attention across the actual 3D scene and its explanations. The current example cards provide content; the scene can embody that content through focused highlights, changing objects, or a guided sequence.
- **Return to the whole.** Overview and detail should feel like movement within the same place. Preserve orientation and offer a clear return path. Use motion to explain a relationship or change of perspective.

For example, a heat-protection journey could connect a hot street → observations and sources → an understandable map or game scenario → residents and institutions weighing options → an agreed intervention → delivery → observed outcomes → the next round of learning. Keep hypothetical scenarios and actual measurements distinguishable.

Make the following relationships visible alongside that core loop:

| Relationship | Meaning to communicate |
| --- | --- |
| Rights, privacy, and trust | They apply throughout the system. Public data can be reused; sensitive information has appropriate access rules. Sources and responsibility remain traceable. |
| Learning between cities | Cities identify relevant comparisons, share evidence and experience, adapt approaches locally, and evaluate again. S2Vec may help find spatial similarities; similarity alone does not establish that an intervention will work elsewhere. |
| Improving higher-level rules | Cities document a regulatory obstacle, consequences, and alternatives, then bring evidence and proposals to the responsible regional, national, or European institutions. Democratic review and feedback remain visible. |

Represent these as relationships with reach and direction. Keep them distinct from additional main levels. Reveal complexity progressively so the first view remains calm and inviting.

**Done when:** a visitor can follow at least one complete example through the scene, see the feedback from outcomes to learning, and understand how another city or a responsible institution connects to it.

## 4. Preserve the user's priorities

- Keep the identity generic: Stadtstack, suitable for many cities. The main graphic should be free of Röbel-specific branding.
- Maintain four primary entry points; retain the original 17 topics in contextual detail and their mapping.
- Keep ownership and financing as supporting infrastructure and housing topics. Tokenization, if mentioned, is an optional mechanism with distinct rights and responsibilities.
- Give open data, evidence-informed decisions, explanatory interfaces, 3D maps, and the city-game concept a visible place in the experience.
- Preserve human agency. Evidence informs choices; people and the appropriate institutions decide. Show uncertainty, interests, and tradeoffs where relevant.
- Preserve German and English, with readable labels in both languages.
- Label the site as an architecture model. Its illustrative scenes do not constitute live municipal data, a working city game, an operational S2Vec integration, or an implemented law-change process.

## 5. Implement, verify, and deliver

Implementation map:

| File | Responsibility |
| --- | --- |
| `app/stadtstack-experience.tsx` | Page, selection state, explanations, connections, and example journeys |
| `app/stadtstack-scene.tsx` | Three.js renderer, camera, picking, controls, animation, and lifecycle |
| `app/stadtstack-models.ts` | Procedural city objects and the four scene groups |
| `app/stadtstack-content.ts` | Bilingual model and example content |
| `app/globals.css` | Visual system and responsive layout |
| `app/layout.tsx` | Metadata |
| `public/stadtstack-overview.png` | Current static overview and WebGL fallback illustration |

Read `package.json` and `README.md` for the current development and validation commands. Use the existing project and preserve unrelated local changes. The previous task's published baseline was commit `90ff60e5143f924fb7e2f20b9b22c2577f881ddc` on 24 September 2026; inspect the current checkout before editing.

Maintain native controls for every action available through the canvas, visible keyboard focus, reduced-motion support, and a useful fallback when WebGL is unavailable. Preserve normal page scrolling on touch devices. Pause unnecessary rendering offscreen and dispose replaced geometry, textures, materials, observers, and controls.

Verify these outcomes:

1. The initial view communicates one connected city and four comprehensible entry points.
2. Selecting a component explains both its role and its relationships; overview context remains recoverable.
3. At least one example visibly traverses the system and closes the learning loop.
4. All four areas and three cross-cutting relationships remain available, with the original 17 topics accounted for.
5. Desktop and narrow phone layouts are legible and operable in both languages, including long labels, direct object selection, close-up views, and keyboard controls.
6. Reduced motion and fallback behavior preserve the meaning. The browser has no new application errors, and the project's lint, type, and production-build checks pass.

Review actual screenshots of the implemented page and selected states before calling the visual work complete. Deliver the finished implementation, a concise explanation of the design choices, and the verification results.

For publication, read the available Sites building/hosting instructions and the project's README. Reuse the existing project identified in `.openai/hosting.json`, preserve the current public audience and Stadtstack address, and publish the exact source state you verified. Report the resulting live URL. If your environment lacks deployment access, leave the tested source and precise publishing steps ready for the owner.

Environment note: this macOS project's dependencies have previously been offloaded by iCloud. If startup waits indefinitely on file reads, inspect file availability and the existing `node_modules` symlink; the prior task restored dependencies to a cache outside Documents.

The final experience should make a visitor think: **“I can see how a place, its information, its people, its decisions, and its future belong together.”**
