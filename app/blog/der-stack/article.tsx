"use client";

import LegalHeader from "../../legal-header";
import { usePageLanguage } from "../../legal-language";
import { headings, Markdown } from "../markdown";
import { StackDiagram, Timeline } from "./figures";
import "../../kontakt/contact.css";
import "../blog.css";

const TEXT = {
  de: { eyebrow: "Blog · 9. November 2026 · Maximilian Stahl", title: "Eine Stadt, viermal gesehen", subtitle: "Warum ich Stadtstack baue – und was ich auf allen vier Ebenen ausprobiert habe", toc: "In diesem Beitrag" },
  en: { eyebrow: "Blog · 9 November 2026 · Maximilian Stahl", title: "One city, seen four ways", subtitle: "Why I'm building Stadtstack – and what I've tested on every layer", toc: "In this post" },
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
