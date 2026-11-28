import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import BlogArticle from "./article";

const description = "Wie eine Frage an der Haustür zu Stadtstack wurde: öffentliche Daten für 319 Gemeinden, vier Ebenen, was läuft und was noch nicht funktioniert.";

export const metadata: Metadata = {
  title: "Aus dem Bauch oder mit Fakten? · Stadtstack Blog",
  description,
  openGraph: {
    url: "https://stadtstack.eu/blog/der-stack",
    title: "Aus dem Bauch oder mit Fakten? Warum ich Stadtstack baue",
    description,
    images: ["https://stadtstack.eu/blog/der-stack/modell.webp"],
    locale: "de_DE",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: "From the gut, or from the facts? Why I'm building Stadtstack", images: ["https://stadtstack.eu/blog/der-stack/modell.webp"] },
};

export default function DerStackPage() {
  const read = (lang: "de" | "en") => readFileSync(join(process.cwd(), "app/blog/der-stack", `${lang}.md`), "utf8");
  return <BlogArticle de={read("de")} en={read("en")} />;
}
