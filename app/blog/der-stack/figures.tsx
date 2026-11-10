type Language = "de" | "en";

const LEVELS = [
  { n: "04", color: "#df5536", de: ["Handeln & umsetzen", "Ledger of Life · Ladenrunde · Spiel · Maskottchen"], en: ["Act & deliver", "Ledger of Life · Ladenrunde · game · mascots"] },
  { n: "03", color: "#e19a12", de: ["Beraten & entscheiden", "Have your say · @city-ai · Mitmachen"], en: ["Deliberate & decide", "Have your say · @city-ai · Mitmachen"] },
  { n: "02", color: "#1b98b1", de: ["Wahrnehmen & verstehen", "Civic-Data-Pipeline · MCP · Stadtkompass"], en: ["Perceive & understand", "Civic data pipeline · MCP · Stadtkompass"] },
  { n: "01", color: "#4f9a3e", de: ["Infrastruktur bereitstellen", "eigener Cluster · privates Netz · Offline-Mesh"], en: ["Provide infrastructure", "own cluster · private network · offline mesh"] },
];

const STACK_TEXT = {
  de: { title: "Der Stack: vier Ebenen, ein Kreislauf", trust: "Rechte & Vertrauen gelten überall", up: "versorgt · informiert · beauftragt", back: "Wirkung fließt zurück", peer: "Vergleichbare Stadt", peerSub: "vergleichen · teilen · anpassen" },
  en: { title: "The stack: four layers, one loop", trust: "Rights & trust apply everywhere", up: "powers · informs · mandates", back: "Impact flows back", peer: "Comparable town", peerSub: "compare · share · adapt" },
};

export function StackDiagram({ language }: { language: Language }) {
  const t = STACK_TEXT[language];
  return (
    <figure className="blog-diagram">
      <svg viewBox="0 0 860 560" role="img" aria-labelledby="stack-title">
        <title id="stack-title">{t.title}</title>
        <defs>
          <marker id="arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#15263b" /></marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2f7d4a" /></marker>
        </defs>
        <rect x="70" y="18" width="560" height="512" rx="14" fill="none" stroke="#3d4fa8" strokeDasharray="5 6" />
        <text x="350" y="44" textAnchor="middle" className="d-eyebrow" fill="#3d4fa8">{t.trust.toUpperCase()}</text>
        {LEVELS.map((level, i) => {
          const y = 70 + i * 112;
          const [name, items] = level[language];
          return (
            <g key={level.n}>
              <path d={`M140 ${y + 24} L350 ${y} L560 ${y + 24} L560 ${y + 66} L350 ${y + 90} L140 ${y + 66} Z`} fill={level.color} fillOpacity="0.14" stroke={level.color} strokeWidth="2" />
              <rect x="164" y={y + 30} width="34" height="24" rx="12" fill={level.color} />
              <text x="181" y={y + 47} textAnchor="middle" className="d-badge" fill="#fff">{level.n}</text>
              <text x="210" y={y + 41} className="d-name" fill="#15263b">{name}</text>
              <text x="210" y={y + 61} className="d-items" fill="#33455a">{items}</text>
            </g>
          );
        })}
        <path d="M110 470 L110 110" stroke="#15263b" strokeWidth="2" markerEnd="url(#arrow-ink)" fill="none" />
        <text transform="translate(98 290) rotate(-90)" textAnchor="middle" className="d-items" fill="#15263b">{t.up}</text>
        <path d="M600 110 C 640 220, 640 360, 600 470" stroke="#2f7d4a" strokeWidth="2" strokeDasharray="6 5" markerEnd="url(#arrow-green)" fill="none" />
        <text transform="translate(648 290) rotate(90)" textAnchor="middle" className="d-flow" fill="#2f7d4a">{t.back}</text>
        <g>
          {[0, 1, 2, 3].map(i => (
            <path key={i} d={`M700 ${210 + i * 34} L760 ${198 + i * 34} L820 ${210 + i * 34} L820 ${224 + i * 34} L760 ${236 + i * 34} L700 ${224 + i * 34} Z`} fill={LEVELS[i].color} fillOpacity="0.18" stroke={LEVELS[i].color} />
          ))}
          <line x1="640" y1="270" x2="694" y2="270" stroke="#56677a" strokeDasharray="3 4" />
          <text x="760" y="364" textAnchor="middle" className="d-name" fill="#15263b">{t.peer}</text>
          <text x="760" y="384" textAnchor="middle" className="d-items" fill="#56677a">{t.peerSub}</text>
        </g>
      </svg>
      <figcaption>{t.title}</figcaption>
    </figure>
  );
}

const STEPS = {
  de: [
    ["Vor 2026", "Zwei ältere Ideen", "Ein Treueprogramm von einem Hackathon und die Mietkaution"],
    ["Februar 2026", "Die Frage an der Haustür", "Recherche zur Bürgermeisterwahl, Gespräche in der Stadt"],
    ["", "Die ersten Apps", "ZK Residency, der Fork der Röbel-App, 3D-Karten und das Spiel"],
    ["30. Sep 2026", "stadtstack.eu online", "Das Stadtmodell: eine Stadt, viermal gesehen"],
    ["12. Okt 2026", "KI-Zugang zu Stadtdaten", "Antworten mit Quelle für KI-Assistenten (Civic MCP 0.3.2)"],
    ["3. Nov 2026", "Daten für alle 319 Gemeinden", "Stammdaten, Energieanlagen und erste Ratsdaten"],
    ["10. Nov 2026", "Größte Abweichungen", "Jeder Ort im Vergleich mit ähnlich großen Orten"],
  ],
  en: [
    ["Before 2026", "Two earlier ideas", "A loyalty programme from a hackathon and the rent deposit"],
    ["February 2026", "The question at the door", "Researching the mayoral election, talking to people in town"],
    ["", "The first apps", "ZK Residency, the fork of the Röbel app, 3D maps and the game"],
    ["30 Sep 2026", "stadtstack.eu online", "The city model: one city, seen four ways"],
    ["12 Oct 2026", "AI access to town data", "Sourced answers for AI assistants (Civic MCP 0.3.2)"],
    ["3 Nov 2026", "Data for all 319 municipalities", "Master data, energy installations and first council data"],
    ["10 Nov 2026", "Largest differences", "Every place compared with similar-sized ones"],
  ],
};

export function Timeline({ language }: { language: Language }) {
  const title = language === "de" ? "Der Weg bis heute" : "The path so far";
  return (
    <figure className="blog-timeline">
      <figcaption>{title}</figcaption>
      <ol>
        {STEPS[language].map(([when, what, detail], i) => (
          <li key={what} style={{ ["--dot" as string]: LEVELS[3 - Math.min(3, Math.floor(i / 2))].color }}>
            {when && <span className="blog-timeline-when">{when}</span>}
            <strong>{what}</strong>
            <span className="blog-timeline-detail">{detail}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
