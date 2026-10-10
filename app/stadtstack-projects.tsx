import type { Language } from "./stadtstack-content";

const projects = [
  {
    title: "Ledger of Life", href: "https://ledger.stadtstack.eu",
    status: { de: "Prototyp · Solana-Testnetz", en: "Prototype · Solana test network" },
    text: { de: "Wohnen und Mietkaution auf Solana. Have your say sammelt Pro und Contra, zeigt ein Sunburst und ergänzt ein Meinungsbild. Themen verbinden Städte; @city-ai verweist auf Quellen.", en: "Housing and rental deposits on Solana. Have your say gathers pros and cons, shows a sunburst and adds an opinion poll. Topics connect cities; @city-ai cites sources." },
    detail: { de: "Mit Loyalty-Kartenebene für lokale Orte und dem offline nutzbaren Home Node.", en: "With a loyalty map layer for local places and an offline Home Node." },
    link: { de: "Ledger of Life öffnen", en: "Open Ledger of Life" },
  },
  {
    title: "ZK Loyalty", href: "https://loyalty.stadtstack.eu",
    status: { de: "Pilot · Sepolia-Testnetz", en: "Pilot · Sepolia test network" },
    text: { de: "Treue für lokale Läden – ein Pilot mit Zero-Knowledge-Technik, noch kein produktives Bonusprogramm.", en: "Loyalty for local shops – a pilot with zero-knowledge technology, not a production rewards programme." },
    detail: { de: "Die Erstellung und Veröffentlichung neuer Programme ist derzeit pausiert. Testeinheiten haben keinen Wert und begründen keine Ansprüche.", en: "Creating and publishing new programmes is currently paused. Test units have no value and confer no rights." },
    link: { de: "Loyalty-Pilot öffnen", en: "Open the loyalty pilot" },
  },
  {
    title: "Spiel", href: "https://spiel.stadtstack.eu",
    status: { de: "Spielbarer Prototyp", en: "Playable prototype" },
    text: { de: "Stadt als Spiel: entdecken, ausprobieren und über das Zusammenleben ins Gespräch kommen.", en: "City as a game: explore, experiment and start a conversation about living together." },
    detail: { de: "Ein eigener Zugang zu Stadtstack, ohne zuerst eine Blockchain verstehen zu müssen.", en: "Another way into Stadtstack, without needing to understand a blockchain first." },
    link: { de: "Zum Spiel", en: "Play the game" },
  },
  {
    title: "Mitmachen", href: "https://mitmachen.stadtstack.eu",
    status: { de: "Beteiligung geschlossen", en: "Participation closed" },
    text: { de: "Die bisherige Beteiligungsseite bleibt unverändert erreichbar. Die Teilnahme ist geschlossen.", en: "The previous participation site remains accessible and unchanged. Participation is closed." },
    detail: { de: "Beteiligung ist beratend und ersetzt keine amtlichen Verfahren oder Entscheidungen.", en: "Participation is advisory and does not replace official procedures or decisions." },
    link: { de: "Bisherige Beteiligung ansehen", en: "View previous participation" },
  },
  {
    title: "Offline-Mesh", href: null,
    status: { de: "Labor-Demo · ein Funk-Hop", en: "Lab demo · one radio hop" },
    text: { de: "Ledger Lite und Zahlungen über LoRa/Reticulum auf Gnosis: kleine Nachrichten von Gerät zu Gerät, auch ohne Internet.", en: "Ledger Lite and payments over LoRa/Reticulum on Gnosis: small messages between devices, even without internet." },
    detail: { de: "Bisher ein Funk-Hop im Labor. Kein stadtweites Netz oder einsatzbereites Zahlungssystem; Testeinheiten haben keinen Wert oder Rechtsanspruch.", en: "So far, one radio hop in the lab. Not a citywide network or production payment system; test units have no value or legal entitlement." },
    link: { de: "Noch kein öffentlicher Zugang", en: "No public access yet" },
  },
  {
    title: "Civic Data & MCP", href: "https://mcp.stadtstack.eu/health",
    status: { de: "Gehosteter MCP · geschützter Lesezugang", en: "Hosted MCP · protected read access" },
    text: { de: "Die Datenpipeline bereitet kommunale Quellen für nachvollziehbare Antworten auf. Der gehostete MCP macht sie für KI-Werkzeuge lesbar – mit Quellen, Datum und klaren Grenzen.", en: "The data pipeline prepares civic sources for traceable answers. The hosted MCP makes them readable by AI tools, with sources, dates and clear limits." },
    detail: { de: "Persönlicher Token am Endpunkt mcp.stadtstack.eu/mcp. Nur lesend; noch kein OAuth- oder fertiger ChatGPT-Connector. Der Link zeigt den öffentlichen Dienststatus.", en: "Personal token at mcp.stadtstack.eu/mcp. Read-only; not yet OAuth or a ready-made ChatGPT connector. The link shows public service health." },
    link: { de: "MCP-Dienststatus ansehen", en: "View MCP service health" },
  },
];

export default function StadtstackProjects({ language }: { language: Language }) {
  return (
    <section id="projects" className="family" aria-labelledby="projects-title">
      <div className="section-head">
        <h2 id="projects-title">{language === "de" ? "Aktuelle Projekte" : "Current projects"}</h2>
        <p>{language === "de" ? "Stand 10. Oktober 2026. Ein unabhängiges Stadtlabor, kein offizieller Stadtdienst. Blockchain-Funktionen nutzen Testnetze: Testeinheiten haben keinen Geldwert und begründen keine Rechte oder Ansprüche. Beteiligung ist beratend." : "As of 10 October 2026. An independent city lab, not an official city service. Blockchain features use test networks: test units have no monetary value and confer no rights or entitlements. Participation is advisory."}</p>
      </div>
      <ul className="family-grid">
        {projects.map((project) => (
          <li className="family-card" key={project.title}>
            <div className="family-card-heading"><h3>{project.title}</h3></div>
            <p className="family-badge">{project.status[language]}</p>
            <p className="family-description">{project.text[language]}</p>
            <p className="family-description">{project.detail[language]}</p>
            {project.href ? <a className="family-link" href={project.href}>{project.link[language]} <span aria-hidden="true">↗</span></a> : <p className="family-badge">{project.link[language]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
