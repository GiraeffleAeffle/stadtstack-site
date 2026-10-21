import type { Metadata } from "next";
import { sharedSections } from "../legal-content";
import { appSections } from "../legal-apps";
import { ledgerSection } from "../legal-ledger";
import { retentionPolicy } from "../legal-retention";
import { contactSection } from "../legal-contact";
import LegalDocument from "../legal-document";
export const metadata: Metadata = { title: "Datenschutz / Privacy · Stadtstack" };
const sections = [...sharedSections.slice(0,3), ledgerSection, ...appSections, ...sharedSections.slice(3), contactSection, retentionPolicy];
export default function Privacy() {
  return <LegalDocument title={{ de: "Datenschutzerklärung", en: "Privacy notice" }} intro={{ de: "Welche Daten bei Stadtstack verarbeitet werden, wie lange sie bleiben und welche Rechte bestehen. Die Angaben zur jeweiligen App ergänzen die gemeinsamen Abschnitte.", en: "How Stadtstack processes data, how long it is kept and what rights apply. Each app’s information applies alongside the shared sections." }} sections={sections} tocIds={["ledger", "ladenrunde", "spiel", "mitmachen", "mcp", "kontakt", "aufbewahrung", "rechte"]} />;
}
