"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePageLanguage } from "../legal-language";

const copy = {
  de: {
    title: "Schreib uns direkt", intro: "Fragen, Ideen oder ein Gespräch über ein Projekt? Wir freuen uns auf deine Nachricht.",
    name: "Name (optional)", email: "E-Mail für unsere Antwort", message: "Deine Nachricht", hint: "10 bis 5.000 Zeichen. Bitte keine sensiblen Daten oder Dokumente senden.",
    success: "Deine Nachricht wurde in unserem eigenen Posteingang gespeichert. Vielen Dank! Das ist keine E-Mail-Versandbestätigung.", invalid: "Bitte prüfe deine Angaben (Nachricht: 10–5.000 Zeichen). Lass das Formular mindestens 3 Sekunden geöffnet; nach 2 Stunden lade bitte die Seite neu.",
    privacy: "Wir speichern deine Nachricht verschlüsselt in unserem selbst betriebenen Posteingang und löschen sie automatisch nach 90 Tagen. Dein Name ist freiwillig; die Antwort-E-Mail benötigen wir zur Bearbeitung deiner Anfrage. Eine zugriffsgeschützte Benachrichtigung enthält keine deiner Angaben. Für iPhone-Sofortbenachrichtigungen erhält ntfy.sh einen inhaltsfreien, pseudonymen Abrufimpuls, weitergeleitet über Google Firebase und Apple APNs. Das Formular versendet keine E-Mail und liefert nicht an ein iCloud-Postfach. Mehr dazu im", privacyLink: "Datenschutz", send: "Nachricht senden", sending: "Wird gesendet …",
    forbidden: "Die Anfrage konnte nicht angenommen werden. Bitte lade die Seite neu oder schreib uns per E-Mail.", rate: "Zu viele Anfragen. Bitte warte vor einem weiteren Versuch.", unavailable: "Die Nachricht konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. Versuch es später oder schreib uns per E-Mail.", direct: "Lieber direkt per E-Mail?", required: "E-Mail und Nachricht sind erforderlich.",
  },
  en: {
    title: "A message to Stadtstack", intro: "Questions, ideas or a conversation about a project? Get in touch directly.",
    name: "Name (optional)", email: "Email for our reply", message: "Your message", hint: "10 to 5,000 characters. Please do not send sensitive data or documents.",
    success: "Your message was saved in our own inbox. Thank you! This is not an email delivery confirmation.", invalid: "Please check your details (message: 10–5,000 characters). Keep the form open for at least 3 seconds; after 2 hours please reload the page.",
    forbidden: "The request could not be accepted. Please reload the page or email us directly.", rate: "Too many requests. Please wait before trying again.", unavailable: "Your message could not be saved. Your input has been kept. Try later or email us directly.", direct: "Prefer to email directly?", required: "Email and message are required.",
    privacy: "We save your message encrypted in our self-hosted inbox and automatically delete it after 90 days. Your name is optional; we need your reply email to handle your enquiry. An access-controlled notification contains none of your details. For instant iPhone notifications, ntfy.sh receives a content-free, pseudonymous fetch trigger relayed through Google Firebase and Apple APNs. This form does not send email or deliver to an iCloud mailbox. Read our", privacyLink: "privacy notice", send: "Send message", sending: "Sending …",
  },
};
type Status = "idle" | "sending" | "success" | "invalid" | "forbidden" | "rate" | "unavailable";

export default function ContactForm() {
  const { language, ready, selectLanguage } = usePageLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const startedAt = useRef(0);
  const busy = useRef(false);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const text = copy[language];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !ready) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true;
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), message: data.get("message"), website: data.get("website"), startedAt: startedAt.current }),
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        form.reset(); startedAt.current = Date.now(); setStatus("success");
      } else {
        setStatus(result.error === "invalid_request" ? "invalid" : result.error === "forbidden" ? "forbidden" : result.error === "rate_limited" ? "rate" : "unavailable");
      }
    } catch { setStatus("unavailable"); }
    finally { busy.current = false; }
  }

  return <section className="contact-content" lang={language}>
    <div className="contact-languages" aria-label="Sprache / Language"><button type="button" aria-pressed={language === "de"} onClick={() => selectLanguage("de")}>Deutsch</button><button type="button" aria-pressed={language === "en"} onClick={() => selectLanguage("en")}>English</button></div>
    <h1>{text.title}</h1><p className="contact-intro">{text.intro}</p>
    <div className="contact-grid"><form className="contact-form" onSubmit={submit} aria-busy={status === "sending"}>
      <p className="contact-required">{text.required}</p>
      <label htmlFor="contact-name">{text.name}</label><input id="contact-name" name="name" autoComplete="name" maxLength={120} disabled={status === "sending"} />
      <label htmlFor="contact-email">{text.email}</label><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={status === "sending"} />
      <label htmlFor="contact-message">{text.message}</label><textarea id="contact-message" name="message" rows={7} required minLength={10} maxLength={5000} aria-describedby="contact-hint" disabled={status === "sending"} /><p id="contact-hint" className="contact-hint">{text.hint}</p>
      <div className="contact-honeypot" aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <p className="contact-privacy">{text.privacy} <a href={`/datenschutz#${language}`}>{text.privacyLink}</a>.</p>
      <button className="contact-submit" type="submit" disabled={!ready || status === "sending"}>{status === "sending" ? text.sending : text.send}</button>
      <p className={`contact-status${status === "success" ? " contact-success" : ""}`} role="status" aria-live="polite">{status !== "idle" && status !== "sending" ? text[status] : ""}</p>
    </form><aside className="contact-aside"><h2>{text.direct}</h2><a href="mailto:contact@agentcart.eu">contact@agentcart.eu</a><p>Stadtstack<br />Maximilian Stahl</p></aside></div>
  </section>;
}
