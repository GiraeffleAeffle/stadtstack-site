export type Language = "de" | "en";
export type Copy = Record<Language, string>;
export type LayerId = 1 | 2 | 3 | 4;
export type ConnectionId = "trust" | "exchange" | "rules";
export type ExampleId = "heat" | "resilience" | "housing";
export type Kind = "place" | "observation" | "people" | "decision" | "outcome";
export type EntityId =
  | "square"
  | "buildings"
  | "energy"
  | "network"
  | "compute"
  | "sensors"
  | "openData"
  | "map"
  | "analysis"
  | "assembly"
  | "proposal"
  | "council"
  | "ruleCase"
  | "administration"
  | "works"
  | "change"
  | "evaluation"
  | "neighbor"
  | "higher";
export type Tone =
  | "enables"
  | "observes"
  | "informs"
  | "decides"
  | "delivers"
  | "learns"
  | "shares"
  | "rules";
export type Link = readonly [EntityId, EntityId];

/** What the scene shows while a story step (or the resting overview) is active. */
export type SceneCue = {
  /** Plate 01: how strongly the paved square radiates heat (0–1). */
  heat: number;
  /** Plate 02: heat readings before or after the intervention. */
  measured: "before" | "after";
  /** Plate 02: hypothetical shade trees, drawn as a scenario. */
  scenario: boolean;
  /** Plate 03: option cards lie on the table. */
  options: boolean;
  /** Plate 03: the council has decided. */
  decided: boolean;
  /** Plate 04: progress of trees and shade on the square (0–1). */
  delivered: number;
  /** Plate 04: the square is measured again. */
  evaluated: boolean;
  /** Plate 01: the new trees have become part of the foundation. */
  foundation: boolean;
  /** Plate 01: radio mast and battery carry messages during an outage. */
  radio: boolean;
  /** Plate 02: verified reports on the shared map. */
  reports: boolean;
  /** Plate 04: warnings go out; the community center opens as an assistance point. */
  warning: boolean;
  /** Plate 02: a housing option for the vacant lot, drawn as a scenario. */
  housingScenario: boolean;
  /** Plate 03: the housing proposal lies on the table. */
  housingProposal: boolean;
  /** Plate 04: progress of the new housing on the vacant lot (0–1). */
  construction: number;
};

export const c = (de: string, en: string): Copy => ({ de, en });

export const family = {
  title: c("Die Stadtstack-Familie", "The Stadtstack family"),
  nav: c("Familie", "Family"),
  cards: [
    {
      id: "stadtstack",
      title: c("Stadtstack · Stadtmodell", "Stadtstack · city model"),
      badge: c("Architekturmodell · illustrativ", "Architecture model · illustrative"),
      description: c(
        "Diese Seite: ein Architekturmodell für Städte, die gemeinsam handeln und aus Ergebnissen lernen.",
        "This page: an architecture model for cities that act together and learn from results.",
      ),
      href: "#explore",
      linkLabel: c("Zum Stadtmodell", "Explore the city model"),
    },
    {
      id: "ledger",
      title: c("Ledger of Life", "Ledger of Life"),
      badge: c("Testnetzwerke", "Test networks"),
      description: c(
        "Finde ein Zuhause, sichere die Kaution, behalte dein Vermögen, gestalte deine Stadt mit — ein persönliches Ledger auf Testnetzwerken; Test-Token haben keinen Wert.",
        "Find a home, secure the deposit, keep your assets, help build your city — a personal ledger on test networks; test tokens have no value",
      ),
      href: "https://ledger.stadtstack.eu",
      linkLabel: c("Ledger of Life öffnen", "Open Ledger of Life"),
    },
    {
      id: "roebel",
      title: c("Röbel · Pilot-Apps", "Röbel · pilot apps"),
      badge: c("Pilot · Staging", "Pilot · Staging"),
      description: c(
        "Pilot-Apps für Röbel — kein offizieller Dienst der Stadt.",
        "Pilot apps for Röbel — not an official town service.",
      ),
      href: "https://roebel.stadtstack.eu",
      linkLabel: c("Pilot-Apps öffnen", "Open pilot apps"),
    },
  ],
};

export const restingCue: SceneCue = {
  heat: 0.55,
  measured: "before",
  scenario: false,
  options: true,
  decided: false,
  delivered: 1,
  evaluated: false,
  foundation: false,
  radio: false,
  reports: false,
  warning: false,
  housingScenario: false,
  housingProposal: false,
  construction: 0.55,
};

export const kinds: Record<Kind, { label: Copy; hint: Copy }> = {
  place: {
    label: c("Orte & Dinge", "Places & things"),
    hint: c("Was es gibt", "What exists"),
  },
  observation: {
    label: c("Messungen & Darstellungen", "Observations & representations"),
    hint: c("Was wir darüber wissen – und woher", "What we know about it – and how"),
  },
  people: {
    label: c("Menschen & Institutionen", "People & institutions"),
    hint: c("Wer mitredet und wer zuständig ist", "Who takes part and who is responsible"),
  },
  decision: {
    label: c("Entscheidungen & Handlungen", "Decisions & actions"),
    hint: c("Was beschlossen und getan wird", "What is decided and done"),
  },
  outcome: {
    label: c("Wirkungen & Grenzen", "Outcomes & constraints"),
    hint: c("Was sich ändert – und was im Weg steht", "What changes – and what stands in the way"),
  },
};

export const layers: {
  id: LayerId;
  color: string;
  title: Copy;
  short: Copy;
  question: Copy;
  lens: Copy;
  description: Copy;
  features: { title: Copy; body: Copy }[];
  blocks: Copy[];
  entities: EntityId[];
}[] = [
  {
    id: 1,
    color: "#4f9a3e",
    title: c("Infrastruktur bereitstellen", "Build the foundation"),
    short: c("Infrastruktur", "Infrastructure"),
    question: c(
      "Was trägt und verbindet die Stadt?",
      "What supports and connects the city?",
    ),
    lens: c("gebaut", "as built"),
    description: c(
      "Orte, Energie, verlässliche Netze und lokale Rechenleistung schaffen die Grundlage. Die Stadt kann ihre wichtigen Aufgaben vor Ort erfüllen und auch bei Störungen handlungsfähig bleiben.",
      "Places, energy, dependable networks, and local computing form the foundation. The city can run essential services locally and remain capable during disruption.",
    ),
    features: [
      {
        title: c("Orte & Energie", "Places & energy"),
        body: c(
          "Gebäude, öffentliche Räume, Solaranlagen und Speicher werden zu gemeinsam nutzbaren Ressourcen.",
          "Buildings, public spaces, solar installations, and storage become resources the community can use.",
        ),
      },
      {
        title: c("Verbunden bleiben", "Stay connected"),
        body: c(
          "Breitband und Funk ergänzen sich. Für wichtige Nachrichten gibt es Wege, die auch bei einem Internetausfall funktionieren.",
          "Broadband and radio complement each other, with alternative routes for essential messages during internet outages.",
        ),
      },
      {
        title: c("Vor Ort rechnen", "Compute locally"),
        body: c(
          "Lokale Server, Speicher und geteilte Kapazitäten tragen die Dienste. Nutzung, Eigentum und Finanzierung sind klar geregelt.",
          "Local servers, storage, and shared capacity support services, with clear rules for use, ownership, and funding.",
        ),
      },
    ],
    blocks: [
      c("Gebäude & Energie-Gemeingüter", "Buildings & energy commons"),
      c("Breitband · WLAN · Freifunk", "Broadband · Wi-Fi · community networks"),
      c("Mesh · Funk · Ausfallkommunikation", "Mesh · radio · fallback communication"),
      c("Lokale Server & Speicher", "Local servers & storage"),
      c("Compute Commons", "Compute commons"),
    ],
    entities: ["square", "buildings", "energy", "network", "compute"],
  },
  {
    id: 2,
    color: "#1b98b1",
    title: c("Wahrnehmen & verstehen", "Observe & understand"),
    short: c("Wissen", "Knowledge"),
    question: c(
      "Was passiert vor Ort, und was bedeutet es?",
      "What is happening here, and what does it mean?",
    ),
    lens: c("gemessen & verstanden", "as measured & understood"),
    description: c(
      "Beobachtungen und offene Daten werden zu verständlichem Stadtwissen. Menschen können Zusammenhänge erkunden, Annahmen hinterfragen und mögliche Veränderungen ausprobieren.",
      "Observations and open data become understandable knowledge about the city. People can explore patterns, question assumptions, and examine possible changes.",
    ),
    features: [
      {
        title: c("Eine überprüfbare Datenbasis", "A verifiable evidence base"),
        body: c(
          "Messwerte, Verwaltungsdaten und lokale Beobachtungen behalten ihre Quellen, ihren Zeitbezug und ihre Unsicherheiten.",
          "Measurements, administrative data, and local observations retain their sources, dates, and uncertainties.",
        ),
      },
      {
        title: c("Viele Zugänge zum gleichen Wissen", "Many ways into the same knowledge"),
        body: c(
          "Offene Daten, 3D-Karten, ein Stadtspiel und verständliche Erklärungen machen Zusammenhänge zugänglich. Messwerte und Szenarien bleiben unterscheidbar.",
          "Open data, 3D maps, a city game, and clear explanations make patterns accessible. Observations remain distinct from simulated scenarios.",
        ),
      },
      {
        title: c("Unterstützende Intelligenz", "Intelligence that assists"),
        body: c(
          "Räumliche Modelle und KI helfen beim Einordnen. Sie zeigen Möglichkeiten; Menschen prüfen die Ergebnisse und behalten die Verantwortung.",
          "Spatial models and AI help interpret information. They reveal possibilities; people check the results and retain responsibility.",
        ),
      },
    ],
    blocks: [
      c("Sensorik & lokale Beobachtungen", "Sensing & local observations"),
      c("Open Data & dokumentierte Schnittstellen", "Open data & documented interfaces"),
      c("PostGIS · S2/H3 · S2Vec", "PostGIS · S2/H3 · S2Vec"),
      c("3D-Karten · Stadtspiel · Erklärungen", "3D maps · city game · explanations"),
      c("Civic Inference Gateway", "Civic Inference Gateway"),
    ],
    entities: ["sensors", "openData", "map", "analysis"],
  },
  {
    id: 3,
    color: "#e19a12",
    title: c("Beraten & entscheiden", "Deliberate & decide"),
    short: c("Entscheidungen", "Decisions"),
    question: c(
      "Was wollen wir tun, und wer entscheidet?",
      "What should we do, and who decides?",
    ),
    lens: c("beraten & entschieden", "as discussed & decided"),
    description: c(
      "Eine gemeinsame Faktenbasis macht die Diskussion nachvollziehbar. Menschen bringen Anliegen ein, wägen Alternativen ab und entscheiden in den zuständigen demokratischen Verfahren.",
      "A shared evidence base makes the discussion understandable. People raise concerns, weigh alternatives, and decide through the appropriate democratic processes.",
    ),
    features: [
      {
        title: c("Informiert miteinander beraten", "Deliberate with evidence"),
        body: c(
          "Versammlungen, Karten und Szenarien helfen, Auswirkungen zu verstehen. Auch lokale Erfahrungen und unterschiedliche Interessen haben ihren Platz.",
          "Meetings, maps, and scenarios help people understand consequences, alongside local experience and different interests.",
        ),
      },
      {
        title: c("Verantwortung sichtbar machen", "Make responsibility visible"),
        body: c(
          "Aus einem Anliegen wird ein Vorschlag und gegebenenfalls ein Beschluss. Zuständigkeit, Begründung und nächste Schritte bleiben auffindbar.",
          "An issue becomes a proposal and, where agreed, a decision. Responsibility, reasoning, and next steps remain visible.",
        ),
      },
      {
        title: c("Regelhindernisse begründen", "Document regulatory obstacles"),
        body: c(
          "Was vor Ort nicht lösbar ist, wird mit Evidenz, Alternativen und einem Änderungsvorschlag an die verantwortliche politische Ebene adressiert.",
          "Issues that cannot be resolved locally are documented with evidence, alternatives, and a reform proposal for the responsible political level.",
        ),
      },
    ],
    blocks: [
      c("Versammlungen · Kair/Meld", "Meetings · Kair/Meld"),
      c("Anliegen → Vorschlag → Beschluss", "Issue → proposal → decision"),
      c("Evidenz & dokumentierte Abwägung", "Evidence & documented deliberation"),
      c("Demokratische Zuständigkeit", "Democratic responsibility"),
      c("Vorschläge zur Regeländerung", "Proposals for regulatory change"),
    ],
    entities: ["assembly", "proposal", "council", "ruleCase"],
  },
  {
    id: 4,
    color: "#df5536",
    title: c("Handeln & umsetzen", "Act & deliver"),
    short: c("Umsetzung", "Delivery"),
    question: c(
      "Wie wird daraus ein sichtbares Ergebnis?",
      "How does a decision become a visible result?",
    ),
    lens: c("verändert", "as changed"),
    description: c(
      "Beschlüsse werden zu Aufgaben, öffentlichen Diensten und konkreten Vorhaben. Fortschritt und Wirkung werden nachvollziehbar. Die Erfahrungen verbessern die nächste Entscheidung.",
      "Decisions become tasks, public services, and concrete projects. Progress and impact can be checked, and experience improves the next decision.",
    ),
    features: [
      {
        title: c("Vom Beschluss zum Auftrag", "From decision to action"),
        body: c(
          "Verwaltung und ausführende Stellen erhalten klare Aufgaben. Menschen sehen, wer zuständig ist und wie das Vorhaben vorankommt.",
          "Administration and delivery teams receive clear tasks. People can see who is responsible and how the project is progressing.",
        ),
      },
      {
        title: c("Betrieb gehört dazu", "Operation is part of delivery"),
        body: c(
          "Ein Dienst braucht langfristig Zuständigkeit, Pflege und verlässliche Ressourcen. Das gilt für einen Schutzraum ebenso wie für eine Datenschnittstelle.",
          "A service needs ongoing responsibility, maintenance, and reliable resources, whether it is a shelter or a data interface.",
        ),
      },
      {
        title: c("Wirkung prüfen & weiterlernen", "Evaluate impact & keep learning"),
        body: c(
          "Erwartungen werden mit beobachteten Ergebnissen verglichen. Was funktioniert, was offen bleibt und was geändert werden muss, fließt zurück ins Stadtwissen.",
          "Expectations are compared with observed outcomes. What works, what remains uncertain, and what needs to change feeds back into the city’s knowledge.",
        ),
      },
    ],
    blocks: [
      c("Verwaltung & öffentliche Dienste", "Administration & public services"),
      c("openDesk · OParl · Open311", "openDesk · OParl · Open311"),
      c("Aufträge · Status · Ergebnisse", "Tasks · status · outcomes"),
      c("Betrieb & Instandhaltung", "Operation & maintenance"),
      c("Wirkungsprüfung & Rückmeldung", "Impact evaluation & feedback"),
    ],
    entities: ["administration", "works", "change", "evaluation"],
  },
];

export const entities: Record<
  EntityId,
  {
    layer: LayerId | null;
    kind: Kind;
    name: Copy;
    role: Copy;
    responsible: Copy;
    /** How rights, privacy, and traceability apply here. */
    trust?: Copy;
  }
> = {
  square: {
    layer: 1,
    kind: "place",
    name: c("Der Platz", "The square"),
    role: c(
      "Ein öffentlicher Platz, den alle nutzen – und der Ort, den du auf allen vier Ebenen wiederfindest.",
      "A public square everyone uses – and the place you will find again on all four levels.",
    ),
    responsible: c(
      "Die Stadt, vertreten durch Grünflächen- und Tiefbauamt",
      "The city, through its parks and public works departments",
    ),
  },
  buildings: {
    layer: 1,
    kind: "place",
    name: c("Gebäude & Flächen", "Buildings & land"),
    role: c(
      "Rathaus, Bürgerhaus, Wohnhäuser und eine Brachfläche. Eigentum, Nutzung, Mitsprache und Finanzierung sind getrennte Fragen mit eigenen Regeln.",
      "Town hall, community center, homes, and a vacant lot. Ownership, use, say in decisions, and financing are separate questions with their own rules.",
    ),
    responsible: c(
      "Stadt, Genossenschaften und private Eigentümer – je nach Gebäude",
      "The city, cooperatives, and private owners – depending on the building",
    ),
    trust: c(
      "Eigentum, Nutzung und Mitsprache sind getrennt geregelt",
      "Ownership, use, and say are defined separately",
    ),
  },
  energy: {
    layer: 1,
    kind: "place",
    name: c("Solardach & Speicher", "Solar roof & storage"),
    role: c(
      "Strom vom Dach des Bürgerhauses, gespeichert für den Abend und den Notfall.",
      "Power from the community center roof, stored for the evening and for emergencies.",
    ),
    responsible: c(
      "Stadtwerke oder Energiegenossenschaft",
      "Municipal utility or energy cooperative",
    ),
  },
  network: {
    layer: 1,
    kind: "place",
    name: c("Netze & Funk", "Networks & radio"),
    role: c(
      "Glasfaser und WLAN für den Alltag, Mesh-Funk für den Ernstfall. Wichtige Nachrichten kommen auch bei einem Internetausfall an.",
      "Fiber and Wi-Fi for everyday use, mesh radio for emergencies. Essential messages still get through when the internet is down.",
    ),
    responsible: c(
      "Stadtwerke, Freifunk-Initiativen und Katastrophenschutz",
      "Utility, community network groups, and civil protection",
    ),
  },
  compute: {
    layer: 1,
    kind: "place",
    name: c("Lokale Server", "Local servers"),
    role: c(
      "Rechenleistung und Speicher vor Ort, gemeinsam mit Nachbarkommunen genutzt. Daten bleiben unter kommunaler Kontrolle.",
      "Computing and storage on site, shared with neighboring municipalities. Data stays under municipal control.",
    ),
    responsible: c(
      "Kommunale IT, gemeinsam mit Nachbarkommunen",
      "Municipal IT, together with neighboring municipalities",
    ),
    trust: c(
      "Daten bleiben vor Ort; Zugriffe sind geregelt und protokolliert",
      "Data stays local; access is controlled and logged",
    ),
  },
  sensors: {
    layer: 2,
    kind: "observation",
    name: c("Messpunkte", "Sensors"),
    role: c(
      "Messen Temperatur, Luft und Wasserstände – ergänzt durch Beobachtungen von Menschen vor Ort. Jede Angabe trägt Quelle, Zeitpunkt und Unsicherheit.",
      "Measure temperature, air, and water levels – alongside observations from people on the ground. Every value carries its source, time, and uncertainty.",
    ),
    responsible: c(
      "Stadtwerke und Umweltamt; Beiträge aus der Bürgerschaft",
      "Utility and environmental office; contributions from residents",
    ),
    trust: c(
      "Zusammengefasste Messwerte, keine Personendaten",
      "Aggregated readings, no personal data",
    ),
  },
  openData: {
    layer: 2,
    kind: "observation",
    name: c("Offene Daten", "Open data"),
    role: c(
      "Eine gemeinsame, überprüfbare Datenbasis mit dokumentierten Schnittstellen und klaren Nutzungsrechten. Geschützte Daten bleiben geschützt.",
      "A shared, verifiable evidence base with documented interfaces and clear reuse rights. Protected data stays protected.",
    ),
    responsible: c("Datenstelle der Stadtverwaltung", "The city’s data office"),
    trust: c(
      "Offen mit Lizenz, Quelle und Datum",
      "Open with license, source, and date",
    ),
  },
  map: {
    layer: 2,
    kind: "observation",
    name: c("3D-Karte & Stadtspiel", "3D map & city game"),
    role: c(
      "Verschiedene Zugänge zu denselben Daten: Karte, Spiel, Erklärung, Tabelle. Messwerte und Szenarien sind klar unterschieden.",
      "Different ways into the same data: map, game, explanation, table. Measurements and scenarios are clearly distinguished.",
    ),
    responsible: c(
      "Stadtverwaltung mit Bildungs- und Beteiligungspartnern",
      "City administration with education and participation partners",
    ),
    trust: c(
      "Messwert und Szenario sind gekennzeichnet",
      "Measurement and scenario are labeled",
    ),
  },
  analysis: {
    layer: 2,
    kind: "observation",
    name: c("Räumliche Analyse & KI", "Spatial analysis & AI"),
    role: c(
      "Räumliche Modelle und unterstützende KI helfen beim Einordnen und beim Finden vergleichbarer Orte. Sie zeigen Möglichkeiten; Menschen prüfen und entscheiden.",
      "Spatial models and assisting AI help interpret information and find comparable places. They show possibilities; people check and decide.",
    ),
    responsible: c(
      "Kommunale IT; Fachleute und Öffentlichkeit prüfen die Ergebnisse",
      "Municipal IT; experts and the public review the results",
    ),
    trust: c(
      "Modelle und Grenzen sind dokumentiert; Menschen prüfen",
      "Models and limits are documented; people review",
    ),
  },
  assembly: {
    layer: 3,
    kind: "people",
    name: c("Versammlung", "Assembly"),
    role: c(
      "Anwohnende, Initiativen und Fachleute bringen Erfahrungen und Interessen ein – vor Ort und online. Widerspruch gehört dazu.",
      "Residents, initiatives, and experts bring in experience and interests – in person and online. Disagreement is part of it.",
    ),
    responsible: c(
      "Einwohnerinnen und Einwohner, Initiativen, Ortsbeiräte",
      "Residents, initiatives, and neighborhood councils",
    ),
    trust: c(
      "Beiträge sind öffentlich, Identitäten geschützt",
      "Contributions are public, identities protected",
    ),
  },
  proposal: {
    layer: 3,
    kind: "decision",
    name: c("Vorschläge & Abwägung", "Proposals & trade-offs"),
    role: c(
      "Aus einem Anliegen werden Alternativen mit Kosten, Nutzen, Risiken und offenen Fragen. Die Abwägung wird dokumentiert.",
      "An issue becomes alternatives with costs, benefits, risks, and open questions. The weighing-up is documented.",
    ),
    responsible: c(
      "Antragstellende, Verwaltung und Ausschüsse",
      "Proposers, administration, and committees",
    ),
  },
  council: {
    layer: 3,
    kind: "people",
    name: c("Gemeinderat", "Municipal council"),
    role: c(
      "Das gewählte Gremium entscheidet – informiert durch Evidenz und Beteiligung, verantwortlich gegenüber der Bürgerschaft.",
      "The elected body decides – informed by evidence and participation, accountable to residents.",
    ),
    responsible: c("Gewählte Vertretung der Stadt", "The city’s elected representatives"),
    trust: c(
      "Beschlüsse werden mit Begründung veröffentlicht",
      "Decisions are published with their reasoning",
    ),
  },
  ruleCase: {
    layer: 3,
    kind: "outcome",
    name: c("Regelhindernis", "Rule obstacle"),
    role: c(
      "Wenn eine übergeordnete Vorgabe eine sinnvolle Lösung verhindert, dokumentiert die Stadt Regel, Folgen und Alternativen.",
      "When a higher-level rule blocks a sensible solution, the city documents the rule, its effects, and alternatives.",
    ),
    responsible: c(
      "Stadt und Städtenetzwerke; entscheiden müssen Land, Bund oder EU",
      "The city and city networks; the decision rests with regional, national, or EU bodies",
    ),
  },
  administration: {
    layer: 4,
    kind: "people",
    name: c("Verwaltung", "Administration"),
    role: c(
      "Setzt Beschlüsse um, vergibt Aufträge und hält Zuständigkeit und Status öffentlich einsehbar.",
      "Carries out decisions, awards contracts, and keeps responsibility and status publicly visible.",
    ),
    responsible: c(
      "Bürgermeisterin oder Bürgermeister mit den Fachämtern",
      "The mayor and the city departments",
    ),
    trust: c(
      "Zuständigkeit und Status sind einsehbar",
      "Responsibility and status are visible",
    ),
  },
  works: {
    layer: 4,
    kind: "decision",
    name: c("Bauhof & Betrieb", "Public works & operations"),
    role: c(
      "Pflanzt, baut, repariert und pflegt. Betrieb und Instandhaltung gehören zur Umsetzung dazu.",
      "Plants, builds, repairs, and maintains. Operation and upkeep are part of delivery.",
    ),
    responsible: c(
      "Bauhof, beauftragte Firmen und Betreiber",
      "Public works team, contractors, and operators",
    ),
  },
  change: {
    layer: 4,
    kind: "outcome",
    name: c("Sichtbare Veränderung", "Visible change"),
    role: c(
      "Was sich vor Ort tatsächlich verändert: Bäume und Schatten am Platz, ein neues Wohnhaus, eine geöffnete Anlaufstelle.",
      "What actually changes on the ground: trees and shade on the square, a new home, an open assistance point.",
    ),
    responsible: c(
      "Die Stadt als Betreiberin; Pflege gemeinsam mit der Nachbarschaft",
      "The city as operator; care shared with the neighborhood",
    ),
  },
  evaluation: {
    layer: 4,
    kind: "outcome",
    name: c("Wirkung prüfen", "Impact check"),
    role: c(
      "Vergleicht Erwartungen mit beobachteten Ergebnissen und trennt Veränderung von belegter Ursache. Das Ergebnis geht zurück ins Stadtwissen.",
      "Compares expectations with observed results and separates change from proven cause. The findings return to the city’s knowledge.",
    ),
    responsible: c(
      "Verwaltung mit unabhängiger Prüfung; Ergebnisse sind öffentlich",
      "Administration with independent review; results are public",
    ),
    trust: c(
      "Ergebnisse samt Unsicherheit werden veröffentlicht",
      "Results are published with their uncertainty",
    ),
  },
  neighbor: {
    layer: null,
    kind: "place",
    name: c("Vergleichbare Stadt", "Comparable city"),
    role: c(
      "Eine andere Stadt mit ähnlicher Ausgangslage. Städte teilen Daten, Maßnahmen, Ergebnisse und Grenzen – und passen Lösungen vor Ort an.",
      "Another city with similar conditions. Cities share data, measures, results, and limits – and adapt solutions locally.",
    ),
    responsible: c(
      "Partnerkommunen und kommunale Netzwerke",
      "Partner municipalities and municipal networks",
    ),
  },
  higher: {
    layer: null,
    kind: "people",
    name: c("Land · Bund · EU", "Region · nation · EU"),
    role: c(
      "Die zuständigen Stellen für übergeordnete Regeln. Sie prüfen begründete Vorschläge demokratisch und geben Rückmeldung.",
      "The bodies responsible for higher-level rules. They review evidence-based proposals democratically and respond.",
    ),
    responsible: c(
      "Landtag, Bundestag und EU-Institutionen",
      "Regional and national parliaments and EU institutions",
    ),
  },
};

export const relations: {
  from: EntityId;
  to: EntityId;
  verb: Copy;
  tone: Tone;
}[] = [
  { from: "energy", to: "sensors", verb: c("versorgt", "powers"), tone: "enables" },
  { from: "energy", to: "compute", verb: c("versorgt", "powers"), tone: "enables" },
  { from: "network", to: "sensors", verb: c("verbindet", "connects"), tone: "enables" },
  {
    from: "network",
    to: "administration",
    verb: c("hält erreichbar", "keeps reachable"),
    tone: "enables",
  },
  { from: "compute", to: "openData", verb: c("speichert", "stores"), tone: "enables" },
  { from: "compute", to: "analysis", verb: c("rechnet für", "runs"), tone: "enables" },
  { from: "sensors", to: "square", verb: c("beobachten", "observe"), tone: "observes" },
  { from: "sensors", to: "openData", verb: c("speisen", "feed"), tone: "informs" },
  { from: "openData", to: "map", verb: c("fließen in", "flow into"), tone: "informs" },
  { from: "analysis", to: "map", verb: c("unterstützt", "assists"), tone: "informs" },
  { from: "map", to: "assembly", verb: c("erklärt", "explains"), tone: "informs" },
  { from: "openData", to: "proposal", verb: c("informieren", "inform"), tone: "informs" },
  { from: "assembly", to: "proposal", verb: c("wägt ab", "weighs"), tone: "decides" },
  { from: "council", to: "proposal", verb: c("entscheidet", "decides"), tone: "decides" },
  {
    from: "council",
    to: "administration",
    verb: c("gibt Auftrag", "mandates"),
    tone: "delivers",
  },
  {
    from: "administration",
    to: "works",
    verb: c("beauftragt", "commissions"),
    tone: "delivers",
  },
  {
    from: "administration",
    to: "openData",
    verb: c("veröffentlicht", "publishes"),
    tone: "delivers",
  },
  { from: "works", to: "change", verb: c("setzt um", "delivers"), tone: "delivers" },
  { from: "works", to: "buildings", verb: c("pflegt", "maintains"), tone: "delivers" },
  { from: "evaluation", to: "change", verb: c("prüft", "evaluates"), tone: "learns" },
  {
    from: "evaluation",
    to: "openData",
    verb: c("fließt zurück", "feeds back"),
    tone: "learns",
  },
  { from: "evaluation", to: "council", verb: c("informiert", "informs"), tone: "learns" },
  {
    from: "analysis",
    to: "neighbor",
    verb: c("findet ähnliche Orte", "finds similar places"),
    tone: "shares",
  },
  {
    from: "evaluation",
    to: "neighbor",
    verb: c("teilt Ergebnisse", "shares results"),
    tone: "shares",
  },
  {
    from: "neighbor",
    to: "proposal",
    verb: c("regt an", "suggests"),
    tone: "shares",
  },
  { from: "council", to: "ruleCase", verb: c("dokumentiert", "documents"), tone: "rules" },
  {
    from: "ruleCase",
    to: "higher",
    verb: c("schlägt Änderung vor", "proposes a change"),
    tone: "rules",
  },
  {
    from: "higher",
    to: "council",
    verb: c("prüft & antwortet", "reviews & responds"),
    tone: "rules",
  },
];

export const connections: {
  id: ConnectionId;
  title: Copy;
  short: Copy;
  /** How far it reaches, shown under its name beside the model. */
  reach: Copy;
  question: Copy;
  description: Copy;
  steps: Copy[];
  note: Copy;
  focus: EntityId[];
  links: Link[];
}[] = [
  {
    id: "trust",
    title: c("Vertrauen gilt überall.", "Trust runs through everything."),
    short: c("Rechte & Vertrauen", "Rights & trust"),
    reach: c("gilt auf allen Ebenen", "applies on every level"),
    question: c("Was macht das Ganze verlässlich?", "What makes the whole system dependable?"),
    description: c(
      "Datenschutz, klare Rechte und nachvollziehbare Quellen begleiten alle vier Ebenen. Öffentliche Daten werden zugänglich; geschützte Informationen bleiben unter passenden Zugriffsregeln.",
      "Privacy, clear rights, and traceable sources apply across all four levels. Public data becomes accessible; protected information stays under appropriate access rules.",
    ),
    steps: [
      c("Herkunft, Aktualität und Unsicherheit sichtbar machen", "Show sources, freshness, and uncertainty"),
      c("Zugriff und Verarbeitung passend zur Sensitivität regeln", "Match access and processing to sensitivity"),
      c("Entscheidungen und Verantwortlichkeiten nachvollziehbar halten", "Keep decisions and responsibility traceable"),
    ],
    note: c(
      "Offenheit und Datenschutz gehören zusammen. Menschen behalten Autorität.",
      "Openness and privacy belong together. People retain authority.",
    ),
    focus: [
      "buildings",
      "compute",
      "sensors",
      "openData",
      "map",
      "analysis",
      "assembly",
      "council",
      "administration",
      "evaluation",
    ],
    links: [
      ["sensors", "openData"],
      ["administration", "openData"],
      ["evaluation", "openData"],
    ],
  },
  {
    id: "exchange",
    title: c("Städte lernen voneinander.", "Cities learn from each other."),
    short: c("Zwischen Städten", "Between cities"),
    reach: c("vergleichen · teilen · anpassen", "compare · share · adapt"),
    question: c("Was lässt sich sinnvoll übertragen?", "What can usefully transfer to another place?"),
    description: c(
      "Städte tauschen überprüfbare Lösungen und Erfahrungen aus. Vergleichbare Orte helfen, passende Ansätze zu finden. Jede Stadt passt sie an ihre Situation an und prüft die Wirkung erneut.",
      "Cities exchange verifiable solutions and experience. Comparable places help identify promising approaches. Each city adapts them to its own context and evaluates their impact again.",
    ),
    steps: [
      c("Vergleichbare Orte und Ausgangslagen finden", "Find comparable places and starting conditions"),
      c("Daten, Maßnahmen, Ergebnisse und Grenzen teilen", "Share data, interventions, outcomes, and limitations"),
      c("Vor Ort anpassen, erproben und erneut messen", "Adapt locally, try the approach, and measure again"),
    ],
    note: c(
      "S2Vec kann bei räumlichen Vergleichen helfen. Ähnlichkeit allein belegt noch keine übertragbare Wirkung.",
      "S2Vec can support spatial comparisons. Similarity alone does not establish that an intervention will transfer.",
    ),
    focus: ["neighbor", "analysis", "evaluation", "proposal"],
    links: [
      ["analysis", "neighbor"],
      ["evaluation", "neighbor"],
      ["neighbor", "proposal"],
    ],
  },
  {
    id: "rules",
    title: c("Erfahrung kann Regeln verändern.", "Experience can inform better rules."),
    short: c("Regeln weiterentwickeln", "Improve the rules"),
    reach: c("mit Land · Bund · EU", "with region · nation · EU"),
    question: c(
      "Was tun, wenn die Lösung an einer Regel scheitert?",
      "What if a rule prevents a useful solution?",
    ),
    description: c(
      "Städte können dokumentieren, welche Regel ein Vorhaben einschränkt und welche Alternativen sinnvoll erscheinen. Ein begründeter Vorschlag erreicht die zuständige politische Ebene: Land, Bund oder EU.",
      "Cities can document which rule constrains a project and what alternatives appear useful. An evidence-backed proposal reaches the responsible political level: regional, national, or European.",
    ),
    steps: [
      c("Regelhindernis, Auswirkungen und Alternativen dokumentieren", "Document the obstacle, its effects, and alternatives"),
      c("Evidenz und konkrete Änderungsvorschläge gemeinsam aufbereiten", "Prepare evidence and specific reform proposals together"),
      c("Demokratisch prüfen, entscheiden und Rückmeldung geben", "Review democratically, decide, and provide feedback"),
    ],
    note: c(
      "Daten unterstützen die Prüfung. Die Entscheidung über eine Regeländerung bleibt bei den zuständigen demokratischen Stellen.",
      "Data supports the review. Decisions about changing rules remain with the responsible democratic institutions.",
    ),
    focus: ["council", "ruleCase", "higher"],
    links: [
      ["council", "ruleCase"],
      ["ruleCase", "higher"],
      ["higher", "council"],
    ],
  },
];

export type Evidence = "measured" | "scenario" | "decision" | "outcome";

export const evidenceLabels: Record<Evidence, Copy> = {
  measured: c("Messwert", "Measurement"),
  scenario: c("Szenario – beruht auf Annahmen", "Scenario – based on assumptions"),
  decision: c("Entscheidung von Menschen", "Decision made by people"),
  outcome: c("Beobachtete Wirkung", "Observed outcome"),
};

export const examples: {
  id: ExampleId;
  title: Copy;
  description: Copy;
  /** A few words shown under the title beside the model. */
  teaser: Copy;
  steps: {
    layer: LayerId;
    title: Copy;
    body: Copy;
    focus: EntityId[];
    links: Link[];
    evidence?: Evidence;
    cue: Partial<SceneCue>;
  }[];
}[] = [
  {
    id: "heat",
    title: c("Hitzeschutz", "Heat protection"),
    teaser: c("Vom heißen Platz zum kühleren Ort", "From a hot square to a cooler place"),
    description: c(
      "Von einem heißen Platz zu einem kühleren, nutzbaren öffentlichen Raum.",
      "From an overheated square to a cooler, usable public space.",
    ),
    steps: [
      {
        layer: 1,
        title: c("Ein heißer Platz", "A hot square"),
        body: c(
          "Der gepflasterte Platz heizt sich im Sommer stark auf. Es gibt kaum Schatten; viele meiden ihn am Nachmittag.",
          "The paved square heats up strongly in summer. There is little shade, and many people avoid it in the afternoon.",
        ),
        focus: ["square"],
        links: [],
        cue: { heat: 1, delivered: 0, options: false, construction: 0 },
      },
      {
        layer: 2,
        title: c("Beobachten und messen", "Observe and measure"),
        body: c(
          "Messpunkte erfassen Luft- und Oberflächentemperatur. Strom vom Solardach und das Funknetz halten sie in Betrieb; die Werte landen mit Quelle und Zeitpunkt in den offenen Daten.",
          "Sensors record air and surface temperature. Power from the solar roof and the radio network keep them running; readings enter the open data with source and time.",
        ),
        focus: ["sensors", "square", "energy", "network", "openData"],
        links: [
          ["sensors", "square"],
          ["energy", "sensors"],
          ["network", "sensors"],
          ["sensors", "openData"],
        ],
        evidence: "measured",
        cue: { heat: 1, delivered: 0, options: false, construction: 0 },
      },
      {
        layer: 2,
        title: c("Verstehen und ausprobieren", "Understand and explore"),
        body: c(
          "Die 3D-Karte zeigt, wo es am heißesten ist. Im Stadtspiel kann jede und jeder ausprobieren, was Bäume oder ein Sonnensegel verändern könnten. Das ist ein Szenario auf Basis von Annahmen, keine Messung.",
          "The 3D map shows where it is hottest. In the city game anyone can try out what trees or a shade sail might change. That is a scenario based on assumptions, not a measurement.",
        ),
        focus: ["map", "openData", "analysis"],
        links: [
          ["openData", "map"],
          ["analysis", "map"],
        ],
        evidence: "scenario",
        cue: { heat: 1, scenario: true, delivered: 0, options: false, construction: 0 },
      },
      {
        layer: 3,
        title: c("Gemeinsam abwägen", "Weigh it up together"),
        body: c(
          "Anwohnende, Geschäfte und Fachleute beraten am Stadtmodell. Bäume spenden dauerhaft Schatten, brauchen aber Jahre und Pflege; ein Segel wirkt sofort, hält aber kürzer. Interessen, Kosten und Unsicherheiten liegen offen auf dem Tisch.",
          "Residents, shops, and experts deliberate around the city model. Trees give lasting shade but need years and care; a sail works at once but does not last as long. Interests, costs, and uncertainties are on the table.",
        ),
        focus: ["assembly", "proposal", "map", "openData"],
        links: [
          ["map", "assembly"],
          ["openData", "proposal"],
          ["assembly", "proposal"],
        ],
        cue: { heat: 1, scenario: true, options: true, delivered: 0, construction: 0 },
      },
      {
        layer: 3,
        title: c("Entscheiden", "Decide"),
        body: c(
          "Der Gemeinderat beschließt: Bäume, dazu ein Sonnensegel für die ersten Jahre. Begründung, Abwägung und Zuständigkeit werden veröffentlicht. Die Daten haben informiert – entschieden haben Menschen.",
          "The council decides: trees, plus a shade sail for the first years. The reasoning, the trade-offs, and who is responsible are published. The data informed the choice – people made it.",
        ),
        focus: ["council", "proposal", "administration"],
        links: [
          ["council", "proposal"],
          ["council", "administration"],
        ],
        evidence: "decision",
        cue: { heat: 1, options: true, decided: true, delivered: 0, construction: 0 },
      },
      {
        layer: 4,
        title: c("Umsetzen", "Deliver"),
        body: c(
          "Die Verwaltung beauftragt den Bauhof. Bäume werden gepflanzt, das Segel gespannt, Bänke versetzt. Der Stand ist öffentlich einsehbar, und die Pflege ist von Anfang an eingeplant.",
          "The administration commissions the public works team. Trees are planted, the sail goes up, benches are moved. Progress is publicly visible, and maintenance is planned from the start.",
        ),
        focus: ["administration", "works", "change"],
        links: [
          ["council", "administration"],
          ["administration", "works"],
          ["works", "change"],
        ],
        cue: { heat: 1, options: true, decided: true, delivered: 1, construction: 0 },
      },
      {
        layer: 4,
        title: c("Nachmessen und weitergeben", "Measure again and pass it on"),
        body: c(
          "Im nächsten Sommer wird wieder gemessen und mit der Erwartung verglichen. Das Ergebnis fließt samt Unsicherheit zurück ins Stadtwissen, informiert die nächste Entscheidung und hilft vergleichbaren Städten.",
          "Next summer the square is measured again and compared with what was expected. The result – including its uncertainty – flows back into the city’s knowledge, informs the next decision, and helps comparable cities.",
        ),
        focus: ["evaluation", "change", "openData", "council", "neighbor"],
        links: [
          ["evaluation", "change"],
          ["evaluation", "openData"],
          ["evaluation", "council"],
          ["evaluation", "neighbor"],
        ],
        evidence: "outcome",
        cue: {
          heat: 0.25,
          measured: "after",
          options: true,
          decided: true,
          delivered: 1,
          evaluated: true,
          foundation: true,
          construction: 0,
        },
      },
      {
        layer: 3,
        title: c("Wenn eine Regel im Weg steht", "When a rule stands in the way"),
        body: c(
          "Ein Förderprogramm bezahlt das Pflanzen, aber nicht die Pflege der ersten Jahre. Die Stadt dokumentiert Folgen und Alternativen und bringt mit anderen Städten einen Änderungsvorschlag zur zuständigen Stelle. Dort wird demokratisch geprüft und geantwortet.",
          "A funding program pays for planting but not for care in the first years. The city documents the effects and alternatives and, together with other cities, takes a proposal for change to the responsible body. That body reviews it democratically and responds.",
        ),
        focus: ["ruleCase", "higher", "council", "neighbor"],
        links: [
          ["council", "ruleCase"],
          ["ruleCase", "higher"],
          ["higher", "council"],
        ],
        evidence: "decision",
        cue: {
          heat: 0.25,
          measured: "after",
          options: true,
          decided: true,
          delivered: 1,
          evaluated: true,
          foundation: true,
          construction: 0,
        },
      },
    ],
  },
  {
    id: "resilience",
    title: c("Krisenvorsorge", "Emergency preparedness"),
    teaser: c("Hilfe erreichbar, auch bei Ausfall", "Help within reach, even in an outage"),
    description: c(
      "Wichtige Informationen und Hilfe bleiben auch bei Störungen erreichbar.",
      "Essential information and support remain available during disruption.",
    ),
    steps: [
      {
        layer: 1,
        title: c("Wege, die auch bei Ausfall tragen", "Routes that hold during outages"),
        body: c(
          "Funkmast, Batteriespeicher und das Bürgerhaus als Anlaufstelle ergänzen die regulären Netze. Fallen Strom oder Internet aus, bleiben wichtige Nachrichten und Hilfe erreichbar.",
          "A radio mast, battery storage, and the community center as an assistance point complement the regular networks. If power or the internet fails, essential messages and help stay within reach.",
        ),
        focus: ["network", "energy", "buildings", "compute"],
        links: [
          ["energy", "compute"],
          ["network", "administration"],
        ],
        cue: { radio: true },
      },
      {
        layer: 2,
        title: c("Ein gemeinsames Lagebild", "A shared picture of conditions"),
        body: c(
          "Geprüfte Meldungen und Messwerte erscheinen auf einer Karte. Enthalten Meldungen persönliche Angaben, sehen sie nur die zuständigen Einsatzkräfte.",
          "Verified reports and readings appear on one map. Where reports contain personal details, only the responsible emergency staff can see them.",
        ),
        focus: ["sensors", "openData", "map"],
        links: [
          ["sensors", "openData"],
          ["openData", "map"],
        ],
        evidence: "measured",
        cue: { radio: true, reports: true },
      },
      {
        layer: 3,
        title: c("Verantwortung klären", "Clarify responsibility"),
        body: c(
          "Rat und Krisenstab legen vorab fest, wer was entscheidet, welche Wege gelten und wie die Bevölkerung informiert wird. Die Abläufe sind öffentlich.",
          "The council and the crisis team agree in advance who decides what, which routes apply, and how people are informed. The procedures are public.",
        ),
        focus: ["council", "assembly", "proposal", "administration"],
        links: [
          ["assembly", "proposal"],
          ["council", "proposal"],
          ["council", "administration"],
        ],
        evidence: "decision",
        cue: { radio: true, reports: true, decided: true },
      },
      {
        layer: 4,
        title: c("Warnen und helfen", "Warn and help"),
        body: c(
          "Warnungen erreichen alle über mehrere Kanäle. Das Bürgerhaus öffnet als Anlaufstelle mit Strom, Wasser und Informationen.",
          "Warnings reach everyone through several channels. The community center opens as an assistance point with power, water, and information.",
        ),
        focus: ["administration", "works", "network", "change"],
        links: [
          ["network", "administration"],
          ["administration", "works"],
          ["works", "change"],
        ],
        cue: { radio: true, reports: true, decided: true, warning: true },
      },
      {
        layer: 4,
        title: c("Üben und verbessern", "Practice and improve"),
        body: c(
          "Nach jeder Übung und jedem Ereignis wird ausgewertet, was funktioniert hat. Die Erkenntnisse verbessern Abläufe, Technik und Absprachen mit Nachbarstädten.",
          "After every exercise and incident, the city reviews what worked. The lessons improve procedures, equipment, and arrangements with neighboring cities.",
        ),
        focus: ["evaluation", "openData", "buildings", "neighbor"],
        links: [
          ["evaluation", "openData"],
          ["works", "buildings"],
          ["evaluation", "neighbor"],
        ],
        evidence: "outcome",
        cue: { decided: true, evaluated: true },
      },
    ],
  },
  {
    id: "housing",
    title: c("Wohnen", "Housing"),
    teaser: c("Von der Brache zum neuen Wohnhaus", "From vacant lot to new homes"),
    description: c(
      "Wohnbedarf, vorhandene Flächen und konkrete Vorhaben zusammenbringen.",
      "Connect housing needs, available land, and concrete projects.",
    ),
    steps: [
      {
        layer: 1,
        title: c("Flächen und Rechte klären", "Clarify land and rights"),
        body: c(
          "Eine Brachfläche und leerstehende Gebäude werden erfasst. Eigentum, Nutzung, Mitsprache und Finanzierung werden getrennt und nachvollziehbar beschrieben.",
          "A vacant lot and empty buildings are recorded. Ownership, use, say in decisions, and financing are described separately and transparently.",
        ),
        focus: ["buildings"],
        links: [],
        cue: { construction: 0 },
      },
      {
        layer: 2,
        title: c("Bedarf und Varianten verstehen", "Understand needs and options"),
        body: c(
          "Daten zu Bedarf, Lage und Kosten fließen in Karten und Szenarien. Varianten zeigen, was auf der Fläche möglich wäre – als Annahme, nicht als Zusage.",
          "Data on need, location, and costs feed maps and scenarios. Options show what the lot could hold – as assumptions, not promises.",
        ),
        focus: ["openData", "map", "analysis"],
        links: [
          ["openData", "map"],
          ["analysis", "map"],
        ],
        evidence: "scenario",
        cue: { housingScenario: true, construction: 0 },
      },
      {
        layer: 3,
        title: c("Ziele abwägen", "Weigh the goals"),
        body: c(
          "Bezahlbarkeit, Qualität, Nachbarschaft und langfristige Verantwortung werden gemeinsam abgewogen. Der Rat entscheidet über Vorhaben und Trägerschaft.",
          "Affordability, quality, neighborhood, and long-term responsibility are weighed together. The council decides on the project and who will run it.",
        ),
        focus: ["assembly", "proposal", "council"],
        links: [
          ["map", "assembly"],
          ["assembly", "proposal"],
          ["council", "proposal"],
        ],
        evidence: "decision",
        cue: { housingScenario: true, housingProposal: true, construction: 0 },
      },
      {
        layer: 4,
        title: c("Bauen und betreiben", "Build and operate"),
        body: c(
          "Bau und Betrieb werden beauftragt; Fortschritt und Kosten sind öffentlich einsehbar. Betrieb und Pflege gehören von Anfang an dazu.",
          "Construction and operation are commissioned; progress and costs are publicly visible. Operation and maintenance are part of the plan from day one.",
        ),
        focus: ["administration", "works", "change"],
        links: [
          ["council", "administration"],
          ["administration", "works"],
          ["works", "change"],
        ],
        cue: { housingProposal: true, construction: 1 },
      },
      {
        layer: 4,
        title: c("Wirkung prüfen", "Check the impact"),
        body: c(
          "Belegung, Kosten und Zufriedenheit werden ausgewertet. Die Erfahrungen fließen zurück ins Stadtwissen und in künftige Vorhaben – auch in anderen Städten.",
          "Occupancy, costs, and residents’ satisfaction are reviewed. The experience flows back into the city’s knowledge and into future projects – in other cities too.",
        ),
        focus: ["evaluation", "change", "openData", "neighbor"],
        links: [
          ["evaluation", "change"],
          ["evaluation", "openData"],
          ["evaluation", "neighbor"],
        ],
        evidence: "outcome",
        cue: { housingProposal: true, construction: 1, evaluated: true },
      },
    ],
  },
];

export type TopicTarget =
  | { entity: EntityId }
  | { connection: ConnectionId }
  | { example: ExampleId };

/** The original 17 topics and where each now lives. */
export const topics: {
  n: number;
  name: Copy;
  home: LayerId | ConnectionId | "cases";
  target: TopicTarget;
  note?: Copy;
}[] = [
  {
    n: 1,
    name: c("Physische Stadt & Energie-Gemeingüter", "Physical city & energy commons"),
    home: 1,
    target: { entity: "buildings" },
  },
  {
    n: 4,
    name: c("Lokales Breitband", "Local broadband"),
    home: 1,
    target: { entity: "network" },
  },
  {
    n: 5,
    name: c("Resilientes Schmalband", "Resilient narrowband"),
    home: 1,
    target: { entity: "network" },
  },
  {
    n: 6,
    name: c("Lokale Rechenleistung und Speicherung", "Local compute and storage"),
    home: 1,
    target: { entity: "compute" },
  },
  {
    n: 7,
    name: c("Compute Commons", "Compute commons"),
    home: 1,
    target: { entity: "compute" },
  },
  {
    n: 2,
    name: c("Urbane und ländliche Sensorik", "Urban and rural sensing"),
    home: 2,
    target: { entity: "sensors" },
  },
  {
    n: 3,
    name: c("Räumliche Intelligenz", "Spatial intelligence"),
    home: 2,
    target: { entity: "analysis" },
  },
  {
    n: 9,
    name: c("Civic Inference Gateway", "Civic Inference Gateway"),
    home: 2,
    target: { entity: "analysis" },
  },
  {
    n: 10,
    name: c("Versammlungsinfrastruktur Kair/Meld", "Assembly infrastructure Kair/Meld"),
    home: 3,
    target: { entity: "assembly" },
  },
  {
    n: 12,
    name: c("Civic Workflow", "Civic workflow"),
    home: 3,
    target: { entity: "proposal" },
    note: c("verbindet Entscheidung und Umsetzung", "links decisions with delivery"),
  },
  {
    n: 17,
    name: c("Regulatorische und demokratische Eskalation", "Regulatory and democratic escalation"),
    home: 3,
    target: { connection: "rules" },
    note: c("führt zu „Regeln weiterentwickeln“", "leads to “Improve the rules”"),
  },
  {
    n: 13,
    name: c("Verwaltung und öffentliche Informationen", "Administration and public information"),
    home: 4,
    target: { entity: "administration" },
  },
  {
    n: 8,
    name: c("Vertrauen, Datenschutz und Lokalität", "Trust, privacy, and locality"),
    home: "trust",
    target: { connection: "trust" },
  },
  {
    n: 11,
    name: c("Evidenz, Identität und Provenienz", "Evidence, identity, and provenance"),
    home: "trust",
    target: { connection: "trust" },
  },
  {
    n: 16,
    name: c("Interkommunale Wissensföderation", "Intermunicipal knowledge federation"),
    home: "exchange",
    target: { connection: "exchange" },
  },
  {
    n: 14,
    name: c("Klimaresilienz und Schutzräume", "Climate resilience and shelters"),
    home: "cases",
    target: { example: "heat" },
  },
  {
    n: 15,
    name: c("Zivilschutz und Fallback", "Civil protection and fallback"),
    home: "cases",
    target: { example: "resilience" },
  },
];

export const findRelation = ([from, to]: Link) =>
  relations.find((relation) => relation.from === from && relation.to === to);
