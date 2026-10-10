import type { Metadata } from "next";
import ContactForm from "./contact-form";
import LegalHeader from "../legal-header";
import "./contact.css";

export const metadata: Metadata = {
  title: "Kontakt / Contact · Stadtstack",
  description: "Stadtstack direkt kontaktieren / Contact Stadtstack directly.",
};

export default function ContactPage() {
  return <main className="contact-page">
    <LegalHeader />
    <p className="contact-eyebrow">Stadt gemeinsam ausprobieren · An independent city lab</p>
    <ContactForm />
    <noscript><p>Das Formular benötigt JavaScript. Schreib uns stattdessen per E-Mail. / The form requires JavaScript. Please email us instead.</p></noscript>
  </main>;
}
