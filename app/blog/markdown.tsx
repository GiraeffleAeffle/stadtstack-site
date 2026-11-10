import Image from "next/image";
import type { ReactNode } from "react";

// Renders the small Markdown subset used by the blog posts: headings (###),
// paragraphs, "- " lists, "> " callouts, standalone images and {{block}}
// placeholders, with **bold**, *italic* and [links](url) inline.
export type BlockRenderer = (name: string, key: string) => ReactNode;

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) nodes.push(<strong key={key}>{inline(match[1], key)}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key}>{inline(match[2], key)}</em>);
    else {
      const href = match[4];
      const external = /^https?:/.test(href);
      nodes.push(<a key={key} href={href} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>{inline(match[3], key)}</a>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const slug = (text: string) => text.toLowerCase().replace(/[*·:]/g, "").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function headings(source: string, idPrefix: string) {
  return source.split("\n").filter(line => line.startsWith("### ")).map(line => ({ id: `${idPrefix}-${slug(line.slice(4))}`, title: line.slice(4).replace(/\*/g, "") }));
}

export function Markdown({ source, block, idPrefix }: { source: string; block: BlockRenderer; idPrefix: string }) {
  const out: ReactNode[] = [];
  const blocks = source.split(/\n\s*\n/);
  blocks.forEach((raw, index) => {
    const text = raw.trim();
    const key = `b${index}`;
    if (!text) return;
    const placeholder = /^\{\{(\w+)\}\}$/.exec(text);
    if (placeholder) { out.push(block(placeholder[1], key)); return; }
    if (text.startsWith("### ")) { const title = text.slice(4); out.push(<h2 key={key} id={`${idPrefix}-${slug(title)}`}>{inline(title, key)}</h2>); return; }
    if (text.startsWith("*") && !text.startsWith("**") && text.endsWith("*") && !text.includes("\n")) { out.push(<p key={key} className="blog-question">{inline(text.slice(1, -1), key)}</p>); return; }
    const images = text.split("\n").map(line => /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim()));
    if (images.every(Boolean)) {
      const items = images as RegExpExecArray[];
      out.push(<div key={key} className={items.length > 1 ? "blog-figures blog-figures--grid" : "blog-figures"}>{items.map(([, alt, src]) => (
        <figure key={src}><Image src={src} alt={alt} width={1800} height={1125} sizes="(max-width: 900px) 100vw, 860px" unoptimized /><figcaption>{alt}</figcaption></figure>
      ))}</div>);
      return;
    }
    if (text.startsWith("> ")) { out.push(<aside key={key} className="blog-status">{inline(text.replace(/^> /gm, ""), key)}</aside>); return; }
    if (text.startsWith("- ")) {
      out.push(<ul key={key}>{text.split(/\n(?=- )/).map((item, i) => <li key={i}>{inline(item.slice(2).replace(/\n\s*/g, " "), `${key}-${i}`)}</li>)}</ul>);
      return;
    }
    out.push(<p key={key}>{inline(text.replace(/\n/g, " "), key)}</p>);
  });
  return <>{out}</>;
}
