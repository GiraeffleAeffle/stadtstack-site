"use client";

import type { ReactNode } from "react";
import LegalHeader from "./legal-header";
import { usePageLanguage } from "./legal-language";
import "./kontakt/contact.css";
import "./legal.css";

type Section = { id: string; deTitle: string; enTitle: string; de: ReactNode[]; en: ReactNode[] };
export default function LegalDocument({ title, intro, sections, tocIds = [] }: {
  title: { de: string; en: string }; intro: { de: string; en: string }; sections: Section[]; tocIds?: string[];
}) {
  const { language, selectLanguage } = usePageLanguage();
  const contents = tocIds.map(id => sections.find(section => section.id === id)).filter((section): section is Section => Boolean(section));
  return <main className="contact-page legal-page">
    <LegalHeader />
    <p className="contact-eyebrow">Stadt gemeinsam ausprobieren · An independent city lab</p>
    <article className="contact-content legal-content" lang={language} id={language}>
      <div className="contact-languages" aria-label="Sprache / Language"><button type="button" aria-pressed={language === "de"} onClick={() => selectLanguage("de")}>Deutsch</button><button type="button" aria-pressed={language === "en"} onClick={() => selectLanguage("en")}>English</button></div>
      <h1>{title[language]}</h1><p className="contact-intro">{intro[language]}</p>
      {contents.length > 0 && <nav className="legal-toc" aria-label={language === "de" ? "Inhaltsübersicht" : "Contents"}><h2>{language === "de" ? "Direkt zum Abschnitt" : "Jump to a section"}</h2><ul>{contents.map(section => <li key={section.id}><a href={`#${language}-${section.id}`}>{language === "de" ? section.deTitle : section.enTitle}</a></li>)}</ul></nav>}
      <div className="legal-sections">{sections.map(section => <section className="legal-section" key={section.id} id={`${language}-${section.id}`}><h2>{language === "de" ? section.deTitle : section.enTitle}</h2>{section[language].map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}</div>
    </article>
  </main>;
}
