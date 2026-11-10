"use client";

import LegalHeader from "../../legal-header";
import { usePageLanguage } from "../../legal-language";
import { headings, Markdown } from "../markdown";
import { StackDiagram, Timeline } from "./figures";
import "../../kontakt/contact.css";
import "../blog.css";

const TEXT = {
  de: { eyebrow: "Blog · 10. November 2026 · Maximilian Stahl", title: "Aus dem Bauch oder mit Fakten?", subtitle: "Wie eine Frage an der Haustür zu Stadtstack wurde, was ich seitdem ausprobiert habe und was noch nicht funktioniert", toc: "In diesem Beitrag" },
  en: { eyebrow: "Blog · 10 November 2026 · Maximilian Stahl", title: "From the gut, or from the facts?", subtitle: "How a question at my front door became Stadtstack, what I've tried since, and what doesn't work yet", toc: "In this post" },
};

export default function BlogArticle({ de, en }: { de: string; en: string }) {
  const { language, selectLanguage } = usePageLanguage();
  const source = language === "de" ? de : en;
  const t = TEXT[language];
  return <main className="contact-page blog-page">
    <LegalHeader />
    <article className="blog-article" lang={language} id={language}>
      <div className="contact-languages" aria-label="Sprache / Language"><button type="button" aria-pressed={language === "de"} onClick={() => selectLanguage("de")}>Deutsch</button><button type="button" aria-pressed={language === "en"} onClick={() => selectLanguage("en")}>English</button></div>
      <p className="contact-eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="blog-subtitle">{t.subtitle}</p>
      <nav className="blog-toc" aria-label={t.toc}><h2>{t.toc}</h2><ol>{headings(source, language).map(h => <li key={h.id}><a href={`#${h.id}`}>{h.title}</a></li>)}</ol></nav>
      <Markdown source={source} idPrefix={language} block={(name, key) => name === "stack" ? <StackDiagram key={key} language={language} /> : name === "timeline" ? <Timeline key={key} language={language} /> : null} />
    </article>
  </main>;
}
