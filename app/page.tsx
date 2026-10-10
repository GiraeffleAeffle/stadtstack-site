import "./projects.css";

const projects = [
  { name: "Ledger of Life", status: "Prototyp · Solana-Testnetz", text: "Wohnen, Mietkaution und gemeinsam abwägen: Have your say sammelt Pro und Contra, zeigt sie als Sunburst und ergänzt ein Meinungsbild. Themen können Städte verbinden. @city-ai verweist auf Quellen statt für die Stadt zu sprechen.", detail: "Dazu kommen die Loyalty-Kartenebene für lokale Orte und der Home Node für die Nutzung offline.", href: "https://ledger.stadtstack.eu", link: "Ledger of Life öffnen" },
  { name: "ZK Loyalty", status: "Pilot · Sepolia-Testnetz", text: "Treue für lokale Läden. Ein Pilot zum Ausprobieren, wie Kundinnen, Kunden und Geschäfte zusammenfinden – mit Zero-Knowledge-Technik.", detail: "Noch kein produktives Bonusprogramm: Testeinheiten haben keinen Wert und begründen keine Ansprüche.", href: "https://loyalty.stadtstack.eu", link: "Loyalty-Pilot öffnen" },
  { name: "Das Spiel", status: "Spielbarer Prototyp", text: "Stadt als Spiel: entdecken, ausprobieren und über das Zusammenleben ins Gespräch kommen.", detail: "Ein eigener Zugang zu Stadtstack, ohne dass man zuerst eine Blockchain verstehen muss.", href: "https://spiel.stadtstack.eu", link: "Zum Spiel" },
  { name: "Mitmachen", status: "Beteiligung geschlossen", text: "Die bisherige Beteiligungsseite bleibt unverändert erreichbar. Die Teilnahme ist geschlossen.", detail: "Beteiligung bei Stadtstack ist beratend. Sie ersetzt keine amtlichen Verfahren oder Entscheidungen.", href: "https://mitmachen.stadtstack.eu", link: "Bisherige Beteiligung ansehen" },
  { name: "Die Offline-Mesh-Stadt", status: "Labor-Demo · ein Funk-Hop", text: "Ledger Lite und Zahlungen über LoRa/Reticulum auf Gnosis: eine Demo dafür, wie kleine Nachrichten auch ohne Internet von Gerät zu Gerät kommen können.", detail: "Bisher ein Funk-Hop im Labor – kein stadtweites Netz und kein einsatzbereites Zahlungssystem. Testeinheiten haben keinen Wert oder Rechtsanspruch.", href: null, link: "Noch kein öffentlicher Zugang" },
  { name: "Civic Data & MCP", status: "Gehosteter MCP · geschützter Lesezugang", text: "Die civic data pipeline bereitet kommunale Quellen für nachvollziehbare Antworten auf. Der gehostete MCP macht diese Daten für KI-Werkzeuge lesbar – mit Quellen, Datum und klaren Grenzen.", detail: "Zugang über einen persönlichen Token am Endpunkt mcp.stadtstack.eu/mcp. Nur lesend; noch kein OAuth- oder fertiger ChatGPT-Connector. Der Link unten zeigt den öffentlichen Dienststatus.", href: "https://mcp.stadtstack.eu/health", link: "MCP-Dienststatus ansehen" },
];

export default function Home() {
  return <>
    <div className="project-home">
      <header className="project-header"><a href="#start" className="project-brand">stadtstack<span>Stadt gemeinsam ausprobieren.</span></a><a href="#projekte">Projekte ↓</a></header>
      <main id="start">
        <section className="project-intro" aria-labelledby="project-title"><p className="project-eyebrow">Offenes Stadtlabor · Stand 10. Oktober 2026</p><h1 id="project-title">Eine Stadt ist mehr<br />als ihre Technik.</h1><p className="project-lead">Stadtstack verbindet Wohnen, lokale Läden, Beteiligung und offene Daten. Hier siehst du, was du heute ausprobieren kannst – und was noch im Labor ist.</p><div className="project-notice"><strong>Ein unabhängiges Projekt. Kein offizieller Stadtdienst.</strong><p>Die Anwendungen sind Prototypen und Piloten. Blockchain-Funktionen nutzen Testnetze; Testeinheiten haben keinen Geldwert und begründen keine Rechte oder Ansprüche. Beteiligung ist beratend.</p></div></section>
        <section id="projekte" aria-labelledby="projects-title" className="project-overview"><div className="project-section-heading"><h2 id="projects-title">Was gerade entsteht</h2><p>Sechs Projekte. Unterschiedliche Reifegrade. Klar benannt.</p></div><div className="project-grid">{projects.map((project, index) => <article className="project-card" key={project.name}><div className="project-card-top"><span className="project-number">0{index + 1}</span><span className="project-status">{project.status}</span></div><h3>{project.name}</h3><p>{project.text}</p><p className="project-detail">{project.detail}</p>{project.href ? <a href={project.href}>{project.link} <span aria-hidden="true">↗</span></a> : <p className="project-availability">{project.link}</p>}</article>)}</div></section>
      </main>
      <footer className="project-footer"><p>Stadtstack · offen, lokal, gemeinsam.</p><a href="https://github.com/GiraeffleAeffle/stadtstack-site">Quellcode dieser Website ↗</a></footer>
    </div>
  </>;
}
