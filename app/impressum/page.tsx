import type { Metadata } from "next";
import { Fragment } from "react";
import LegalDocument from "../legal-document";
export const metadata: Metadata = { title: "Impressum / Legal notice · Stadtstack" };
export default function Imprint() {
  return <LegalDocument title={{ de: "Impressum", en: "Legal notice" }} intro={{ de: "Stadtstack ist ein unabhängiges Projekt, kein amtlicher Stadtdienst.", en: "Stadtstack is an independent project, not an official municipal service." }} sections={[
    { id: "anbieter", deTitle: "Angaben gemäß § 5 DDG", enTitle: "Information under section 5 DDG", de: [<Fragment key="address-de">Maximilian Stahl<br />Fritz-Reuter-Straße 9a<br />15344 Strausberg<br />Deutschland</Fragment>], en: [<Fragment key="address-en">Maximilian Stahl<br />Fritz-Reuter-Straße 9a<br />15344 Strausberg<br />Germany</Fragment>] },
    { id: "kontakt", deTitle: "Kontakt", enTitle: "Contact", de: [<Fragment key="contact-de">E-Mail: <a href="mailto:contact@agentcart.eu">contact@agentcart.eu</a><br />Unmittelbarer Kontakt: <a href="/kontakt">Kontaktformular</a></Fragment>], en: [<Fragment key="contact-en">Email: <a href="mailto:contact@agentcart.eu">contact@agentcart.eu</a><br />Direct contact: <a href="/kontakt#en">Contact form</a></Fragment>] },
    { id: "redaktion", deTitle: "Verantwortlich für journalistisch-redaktionelle Inhalte", enTitle: "Responsible for journalistic/editorial content", de: ["Soweit das Angebot journalistisch-redaktionelle Inhalte enthält: verantwortlich gemäß § 18 Abs. 2 MStV:", <Fragment key="editor-de">Maximilian Stahl<br />Fritz-Reuter-Straße 9a<br />15344 Strausberg<br />Deutschland</Fragment>], en: ["Where the service includes journalistic/editorial content, responsible under section 18(2) MStV:", <Fragment key="editor-en">Maximilian Stahl<br />Fritz-Reuter-Straße 9a<br />15344 Strausberg<br />Germany</Fragment>] },
    { id: "datenschutz", deTitle: "Datenschutz", enTitle: "Privacy", de: [<Fragment key="privacy-de">Informationen zur Verarbeitung personenbezogener Daten findest du in der <a href="/datenschutz">Datenschutzerklärung</a>.</Fragment>], en: [<Fragment key="privacy-en">Read how personal data is processed in our <a href="/datenschutz#en">privacy notice</a>.</Fragment>] },
  ]} />;
}
