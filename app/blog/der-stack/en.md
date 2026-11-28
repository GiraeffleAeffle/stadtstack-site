![The city model from stadtstack.eu: the same square on four layers](/blog/der-stack/modell.webp)

**In short:** Stadtstack is an independent civic lab from Strausberg, a town east of Berlin. I want decisions about a town to rest on facts that anyone can check. So I collect public data for 319 municipalities, make it comparable, and try out how it helps with participation, in everyday life and in a crisis. Some of it runs, much of it is a prototype, some of it didn't work. All of that is in here.

### A question at the door

In February 2026, someone knocked on my door and asked who I'd vote for in Strausberg's mayoral election. I didn't know. Honestly, I didn't know my town very well yet.

So I started researching: who's running, what do the candidates want, what problems do people here actually have? I researched a lot with AI and talked to many people: candidates, members of the town council, people around town.

One thing stuck with me: many decisions, I was told, end up being made from the gut. I understand where that comes from. The documents are scattered, time is short, and the council is made up of volunteers who decide after work. I still think decisions about our town should rest on facts.

### The facts exist. You just can't find them.

Two examples from Strausberg.

Does the town have a heat plan? Yes. The town council adopted it on 21 May 2026. That's on page 4 of the [official gazette 04/2026](https://www.stadt-strausberg.de/wp-content/uploads/2026/06/2026_04_Amtsblatt_SRB.pdf). If you don't know that, you'll search for a long time.

How good is the internet? Gigabit fixed-line internet is available to 82 percent of households. In the group of 15 similar-sized places, the middle value is 97 percent (Federal Network Agency, broadband atlas, as of June 2026).

![Stadtkompass, Strausberg profile: where does the town differ from similar-sized places? Sources: BBSR (INKAR), Federal Network Agency. Structured sources, not independently verified. The dashboard is in German.](/blog/der-stack/abweichungen.webp)

Figures like these are public. They sit with the Federal Network Agency, the statistical offices, council information systems and official gazettes. But they're spread across dozens of portals, tables and PDF attachments. Nobody who serves on a council as a volunteer has the time to piece that together.

Whether 82 percent is a problem isn't for software to decide. That's for the people in town and their council. But the number belongs on the table before a decision is made. That became Stadtstack.

### Why small towns

I live in Strausberg. A friend lives in Röbel on Lake Müritz. And I come from Stimpfach, a place that is much smaller still. I'd like to do this there too one day.

Big cities have data portals, digital departments and consulting budgets. Small municipalities often have none of that, but the same questions: heat planning, solar and wind, housing, schools, transport, budgets. And they're the majority. The three districts I cover so far contain 319 municipalities. Half of them have fewer than about 630 residents, and only 17 have more than 10,000.

### The path: detours that paid off

Stadtstack wasn't designed on a whiteboard. It grew out of experiments, some of them older than the project.

- **ZK Loyalty** comes from a hackathon a few years ago: a loyalty programme for local shops where customers decide for themselves what they reveal. In a civic context it found a new purpose and is now called *Ladenrunde*.
- **The rent deposit** was another earlier idea. It lives on in a different form in *Ledger of Life*.
- **ZK Residency** was the first app I built after getting into this field. The question behind it: how do you prove you live in a town without revealing your address? It became the participation site *Mitmachen*.
- **The Röbel app** was originally built by a friend. I met him as one of the winners of a hackathon, we share similar goals, and we teamed up. I forked his app and kept building on it. The starting point: people complain about their town on Facebook, but to whom? That solves nothing. The idea is a social network for the town. You report a problem and tag the *city AI*. It prepares a sourced proposal that goes to the councillors and the responsible departments, and people get an answer faster. Going forward, this interface is meant to live in *Ledger of Life* and *Mitmachen*.
- **3D maps and a game** built from OpenStreetMap and other open data show what is happening in town, visibly rather than in PDF attachments.

At some point it was clear that all these interfaces need the same thing: reliable knowledge about the town. That's where the idea of a stack with four layers came from.

{{timeline}}

### The stack: four layers, one loop

The model on the homepage shows the same square four times: built, measured, discussed, changed. The layers build on each other, and whatever gets delivered flows back as new knowledge. A town also doesn't have to work everything out alone. If towns can compare themselves, they can see what worked elsewhere.

{{stack}}

### Layer 1 · Infrastructure: what holds, even when something fails?

Everything runs on my own infrastructure rather than with a large cloud provider: rented servers in the EU, a private network and a home server. If towns don't control their own data and tools, their ability to act depends on others.

The second part is preparing for failure. That's no longer hypothetical: in early November 2026, suspected cyberattacks knocked out fridges and freezers in supermarkets across several European countries ([Reuters](https://www.reuters.com/business/retail-consumer/temperature-soars-swedish-grocery-store-freezers-one-store-blames-hackers-2026-11-02), [BBC](https://www.bbc.co.uk/news/articles/cwy8lm1m59mvo)). In September, 5.8 terabytes of data stolen from Berlin's administration were published, possibly including critical-infrastructure data ([ZEIT](https://www.zeit.de/politik/deutschland/2026-09/cyberangriff-berlin-rhysida-hackergruppe-senatsverwaltung-datenleck), [taz](https://taz.de/Fiasko-nach-Hackerangriff-in-Berlin/!6210542)). Material like that can make further attacks easier.

So I tested how short messages and payments can travel from device to device with no internet at all, over long-range radio (LoRa and Reticulum). Each of the 319 municipalities also has a downloadable town pack that works offline. Longer term I'm thinking about radio links between towns and local AI that keeps helping without a network.

> **Status & limits:** The servers and network are in operation. The radio link is a lab test over a single hop, not a citywide network and not a working payment system. Test units have no monetary value.

### Layer 2 · Knowledge: what is happening locally?

This has become the core. I collect public municipal sources and prepare them so that every figure keeps its source and its date.

- **The Stadtkompass** shows a profile for all 319 municipalities in the three districts: population, finances, energy, services, accessibility. It compares each place with similar-sized ones and shows the largest differences.
- **Energy:** about 78,000 installations from the national energy register, updated weekly.
- **Council data:** some 5,500 council papers from 33 municipalities, with decisions where they are recorded.
- **Heat planning:** I looked for evidence in all 319 municipalities. I found one adopted plan (Strausberg), six plans in progress and 22 municipalities where the topic has only been discussed so far. For 290 there is no evidence. That doesn't mean nothing is happening there. It shows how little can be found.
- **Access for AI assistants:** through an open interface (MCP), tools like Claude or ChatGPT can query this data and answer with a source instead of guessing. The same interface will later feed the game, the city AI and participation.

Alongside it there is a smaller, more strictly checked knowledge layer for nine small towns in Brandenburg, Schleswig-Holstein and Mecklenburg-Western Pomerania. Its aim is to trace every statement back to the original document.

> **Status & limits:** AI access is live, read-only and with a personal access key. The Stadtkompass is an internal prototype and not yet public. Its data is labelled "structured source, not independently verified". A rank is not a rating of quality of life.

### Layer 3 · Decisions: who weighs things up?

No software decides here. Decisions stay with people. They should just be better informed.

- **Have your say** (in *Ledger of Life*) collects pros and cons on a topic, shows them as a chart and adds an opinion poll. Topics can connect several towns.
- **The city AI** points to sources instead of speaking for the town.
- **Mitmachen** is an anonymous, advisory poll for Strausberg. Participants have it confirmed once that they live here. After that, the vote itself can no longer be linked to the person.

![Ledger of Life: housing, deposit and weighing things up together (test network)](/blog/der-stack/ledger.webp)
![Mitmachen: advisory, anonymous polling](/blog/der-stack/mitmachen.webp)

> **Status & limits:** Participation in Stadtstack is advisory and doesn't replace official procedures. Mitmachen is still closed: the people who confirm residence are missing.

### Layer 4 · Delivery: what reaches people?

- **Ledger of Life** connects housing, rent deposits and weighing things up together. It adds a map of local places and a Home Node for the home, which keeps the app usable offline.
- **Ladenrunde:** loyalty points for local shops. Customers and businesses find each other, and the points stay encrypted.
- **The game:** with the mascots Mecky in Röbel and Strausi in Strausberg, you explore real streets and real topics, with sources.
- **Mascots:** Japan and Korea show with their *yuru-chara* how much characters help people connect with a place and carry a message. Mecky and Strausi are my small-scale attempt.

![The game with Mecky (Röbel) and Strausi (Strausberg)](/blog/der-stack/spiel.webp)
![Ladenrunde: loyalty points for local shops (test operation)](/blog/der-stack/ladenrunde.webp)

> **Status & limits:** Prototypes and pilots. All blockchain features run on test networks. Test units have no monetary value and create no claims. In Ladenrunde, transactions are currently paused.

### What didn't work

- **Correct isn't yet helpful.** I measure the knowledge layer for the nine small towns with 30 fixed questions. It scores 60 out of 60 on correctness, 46 out of 60 on sourcing, and only 13 out of 60 on usefulness. The answers are right, but too rarely help.
- **The first rebuild failed.** I closed a first attempt at building the data preparation more thoroughly at the end of October without a release. It hit a limit in its architecture. The second attempt is under way.
- **Council data is hard to get.** 33 of 319 municipalities isn't many. For 13 sources, automated retrieval is currently blocked, and access there isn't settled yet.
- **No everyday test yet.** The radio link is a lab test, participation is closed, the loyalty programme is paused. Most of this still has to prove itself with real users.

### What's next

- Finish the checked knowledge layer for the nine small towns, with decisions, objections, funding and operators, and measure it with the same test.
- For each difference, show what similar places decided and funded.
- More council data, and new council papers sorted the same day.
- Grow from nine small towns to 50–300 municipalities.

### Get involved

- **You work in a municipality or administration?** I'm happy to show you your place's profile and hear what is wrong or missing in it.
- **You sit on a council or are active locally?** Tell me which question you'd have liked answered before the last decision.
- **You develop or do research?** You can try the AI access with a personal key.

→ [Contact](/kontakt#en)

*Stadtstack is an independent project and not an official municipal service.*
