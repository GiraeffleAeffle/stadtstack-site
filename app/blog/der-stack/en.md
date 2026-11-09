![The city model: four layers, one place](/blog/der-stack/modell.webp)

**In short:** Stadtstack is an independent civic lab from Strausberg, Germany. I'm testing how a town can make better decisions with open data, participation and digital tools – on four layers: infrastructure, knowledge, decisions, delivery. Some of it already runs (sourced AI data access for 319 municipalities); much of it is a prototype or lab demo. This post tells how it started, what I tested, and where the limits are.

### How it started: a question at the door

In February 2026, someone knocked on my door and asked who I'd vote for in Strausberg's mayoral election. I didn't know. Honestly, I didn't know my town very well yet.

So I started researching: who's running, what do they want, what problems do people here actually have? I researched a lot with AI and talked to many people – candidates, members of the town council, people around town.

One thing stuck with me: many decisions, I was told, end up being made from the gut. I understand why – documents are scattered, time is short, volunteers decide after work. But I believe decisions about our towns should rest on facts. And the facts often exist already; they're just hard to find.

That became Stadtstack.

### Why small towns

I live in Strausberg. Röbel on the Müritz is where a friend lives. And I come from Stimpfach, which is much smaller still. Big cities have data portals, digital departments and consulting budgets. Small towns usually have none of that – but the same questions: heat planning, solar and wind, housing, schools, transport, budgets. That's where I want to start, and where I want to go later.

### The path: from old ideas to a stack

Stadtstack wasn't designed on a whiteboard. It grew out of experiments, some older than the project:

- **ZK Loyalty** began at a hackathon a few years ago: a loyalty programme for local shops using zero-knowledge proofs. In a civic context it found a new purpose.
- **The rent deposit** was another earlier idea; it lives on, in a different form, in *Ledger of Life*.
- **ZK Residency** was the first app I built after getting into civic tech: how can you prove you live in a town without revealing more than necessary? It became the participation site *Mitmachen*.
- **The Röbel app** was originally built by a friend. I met him as one of the winners of a hackathon; we share similar goals and teamed up. I forked his app and kept building on it. It started from a simple observation: people complain about their town on Facebook – but to whom? That solves nothing. The idea: a social network for the town where you report a problem and tag the *city AI*. It prepares a sourced proposal for the council and the responsible departments, who can work on it with AI support and get back to people faster. Going forward, this interface is meant to live in *Ledger of Life* and *Mitmachen*.
- **3D maps and a game**, built from OpenStreetMap and other open data, to show what is actually happening in town – visibly, not buried in PDF attachments.

Eventually it was clear that all these interfaces need the same thing: reliable knowledge about the town. That's where the *stack* came from – four layers, with results flowing back into what the town knows.

{{timeline}}

{{stack}}

### Layer 1 · Provide infrastructure
*What carries and connects the town?*

![Layer 01 in the model: infrastructure](/blog/der-stack/ebene-1.webp)

Everything is self-hosted: a Kubernetes cluster (Talos) on Hetzner, a private overlay network (NetBird) and a home server. Data sovereignty isn't a buzzword for me – if towns can't control their own data and tools, their ability to act depends on others.

The second part of this layer is **resilience**. What happens when the internet goes down – in a flood, a blackout, or an attack on critical infrastructure? That's no longer hypothetical: in early November 2026, suspected cyberattacks knocked out fridges and freezers in supermarkets across several European countries ([Reuters](https://www.reuters.com/business/retail-consumer/temperature-soars-swedish-grocery-store-freezers-one-store-blames-hackers-2026-11-02), [BBC](https://www.bbc.co.uk/news/articles/cwy8lm1m59mvo)). In September, 5.8 terabytes of data stolen from Berlin's administration were published, possibly including critical-infrastructure data ([ZEIT](https://www.zeit.de/politik/deutschland/2026-09/cyberangriff-berlin-rhysida-hackergruppe-senatsverwaltung-datenleck), [taz](https://taz.de/Fiasko-nach-Hackerangriff-in-Berlin/!6210542)) – material that can make further attacks easier. In the *Offline Mesh City* I tested how small messages and payments can travel device to device over LoRa radio and Reticulum, with no internet at all. Longer term I'm thinking about mesh links between towns and local AI that keeps working offline.

> **Status & limits:** The cluster and network run Stadtstack in production. The mesh is a one-radio-hop lab demo – not a citywide network, not a working payment system. Test units have no monetary value.

### Layer 2 · Perceive & understand
*What is happening locally, and what does it mean?*

![Layer 02 in the model: knowledge](/blog/der-stack/ebene-2.webp)
![Stadtkompass: the Strausberg town profile from the live layer](/blog/der-stack/stadtkompass.webp)

This has become the core. The **civic data pipeline** collects public municipal sources – council information systems, decisions, budgets, the national register of energy installations, official statistics, OpenStreetMap – and prepares them so that answers stay traceable: with source, date and clear limits.

On top sits an **MCP server**: an interface AI tools can use to read this data. The MCP is the shared layer for everything else – the game, the city AI, dashboards – and it makes towns comparable.

What I tested:
- **Big cities:** 8 cities, about 14,600 records from open interfaces (roadworks, OSM, council systems).
- **Small towns:** a checked knowledge layer for 9 small towns across 3 districts in Brandenburg, Schleswig-Holstein and Mecklenburg-Western Pomerania.
- **A live layer for all 319 municipalities** in those districts: master data, about 78,000 energy installations, council data – now for 44 of 319 municipalities – a six-dimension "Stadtkompass" and offline town packs.
- **A fixed 30-question test:** correctness 60/60, sourcing 46/60, usefulness only 13/60.

That last number is the honest one: correct, sourced answers aren't enough if they don't help. A first pipeline rebuild hit an architectural limit, and I closed it without a release. The second attempt goes deeper: capturing decisions, weighed objections, funding chains and operators reliably – every statement traceable to the original document.

> **Status & limits:** MCP access is live (read-only, personal token). The live layer is labelled "structured source, not independently verified". Usefulness is the open problem. More at [mcp.stadtstack.eu](https://mcp.stadtstack.eu/health).

### Layer 3 · Deliberate & decide
*What do we want to do, and who decides?*

![Layer 03 in the model: decisions](/blog/der-stack/ebene-3.webp)
![Mitmachen: advisory, anonymous polling with a passkey](/blog/der-stack/mitmachen.webp)

This isn't about software making decisions. Decisions stay with people – they should just be better informed.

- **Have your say** (in *Ledger of Life*) collects pros and cons on a topic and shows them as a sunburst, plus an opinion poll. Topics can connect towns.
- **@city-ai** points to sources instead of speaking for the town.
- **Mitmachen** was a participation site for Strausberg with zero-knowledge proof of residence (from *ZK Residency*): you can show you live here without revealing your address.

> **Status & limits:** Participation in Stadtstack is advisory and doesn't replace official procedures. Mitmachen is closed to participation; the site stays online to view.

### Layer 4 · Act & deliver
*How does it become a visible result?*

![Layer 04 in the model: delivery](/blog/der-stack/ebene-4.webp)
![Ledger of Life (testnet)](/blog/der-stack/ledger.webp)
![Ladenrunde: loyalty for local shops (Sepolia testnet)](/blog/der-stack/ladenrunde.webp)
![The game with Mecky (Röbel) and Strausi (Strausberg)](/blog/der-stack/spiel.webp)

- **Ledger of Life** connects housing, rent deposits and weighing things up together, plus a map layer for local places and a Home Node for offline use (Solana testnet).
- **ZK Loyalty / Ladenrunde:** loyalty for local shops, so customers and businesses find each other – without collecting customer data (Sepolia testnet).
- **The game:** the town as a game, a way into Stadtstack without first having to understand blockchain.
- **Mascots:** in Japan and Korea, *yuru-chara* show how much characters help people identify with a place and carry a message. With Mecky and Strausi I'm trying that on a small scale.

> **Status & limits:** Prototypes and pilots. All blockchain features run on testnets; test units have no monetary value and create no claims.

### Across all layers: impact flows back

The heart of the model is the loop: what gets delivered gets measured and flows back into what the town knows. And no town has to figure everything out alone – if towns can compare themselves, they can see what worked elsewhere and move in a better direction together. Rights and trust apply on every layer: privacy, sources, clear limits.

### What I learned

- **The data exists – it just isn't usable.** Almost everything a councillor needs for a decision is published somewhere. The problem is finding it, connecting it, and trusting it.
- **Correct isn't the same as helpful.** 60/60 on correctness, 13/60 on usefulness. That changed my priorities.
- **Being honest about limits is a feature.** Testnet, pilot, lab demo – clearly named builds more trust than any promise.
- **Small towns aren't an edge case.** They're the majority.
- **One shared knowledge layer carries many interfaces.** The game, the city AI and the dashboard need the same foundation.

### What's next

- Finish the sourced knowledge layer for the 9 small towns and make it measurably more useful.
- Council data for more municipalities, new council documents processed the same day.
- Grow from 9 to 50–300 municipalities without recomputing everything each time.
- Town-to-town comparison: energy transition, planning, budgets, demographics.

### Get involved

- **Municipalities and administrations:** if you'd like to see how your town looks in the data, get in touch.
- **Councillors and engaged citizens:** try the MCP access with your AI tool.
- **Developers and researchers:** let's work together.
- **Everyone:** look at the projects and tell me what's missing.

→ [Contact](https://stadtstack.eu/kontakt)

*Stadtstack is an independent project and not an official municipal service.*
