import Image from "next/image";
import Link from "next/link";

export default function LegalHeader() {
  return <header className="contact-header">
    <Link className="contact-brand" href="/" aria-label="Stadtstack Startseite / Home"><Image src="/favicon.svg" alt="" width={36} height={40} unoptimized /><span>Stadtstack</span></Link>
    <nav aria-label="Seitennavigation / Page navigation"><Link href="/">← Zur Startseite / Back home</Link><Link href="/kontakt">Kontakt / Contact</Link></nav>
  </header>;
}
