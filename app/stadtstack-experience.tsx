"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import StadtstackScene, { type Focus, type PickTarget, type StoryPosition } from "./stadtstack-scene";
import {
  connections,
  entities,
  evidenceLabels,
  examples,
  family,
  findRelation,
  kinds,
  layers,
  relations,
  topics,
  type ConnectionId,
  type EntityId,
  type ExampleId,
  type Kind,
  type Language,
  type LayerId,
  type Tone,
  type TopicTarget,
} from "./stadtstack-content";

type IconName =
  | "sun"
  | "radio"
  | "house"
  | "shield"
  | "cities"
  | "rules"
  | "turnLeft"
  | "turnRight"
  | "zoom"
  | "whole"
  | "close"
  | "prev"
  | "next"
  | "external";

const iconPaths: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
  radio: (
    <>
      <path d="M12 13v8M9 21h6M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  house: <path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" />,
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6l8-3Z" />
      <path d="m8.5 12 2.4 2.4L15.8 9.5" />
    </>
  ),
  cities: <path d="M2.5 20h19M4 20V10h6v10M14 20V5h6v15M6.5 13h1M6.5 16.5h1M16.5 8.5h1M16.5 12h1M16.5 15.5h1M10 14h4" />,
  rules: <path d="M3 9 12 4l9 5M4.5 9.5h15M6.5 10v7M12 10v7M17.5 10v7M4 17.5h16M3 20.5h18" />,
  turnLeft: <path d="M5 8.5a8 8 0 1 1-.6 8M5 3.5v5h5" />,
  turnRight: <path d="M19 8.5a8 8 0 1 0 .6 8M19 3.5v5h-5" />,
  zoom: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  whole: (
    <>
      <path d="m12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z" />
      <path d="m3.5 12 8.5 4.6 8.5-4.6M3.5 16.4 12 21l8.5-4.6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  prev: <path d="M19 12H5m6-6-6 6 6 6" />,
  next: <path d="M5 12h14m-6-6 6 6-6 6" />,
  external: <path d="M14 4h6v6m0-6L10 14M10 5H5v14h14v-5" />,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 36 42" aria-hidden="true">
      {layers.map((layer, index) => (
        <path key={layer.id} d={`m3 ${30 - index * 7} 15 8 15-8-15-8Z`} fill={layer.color} />
      ))}
    </svg>
  );
}

const storyIcons: Record<ExampleId, IconName> = { heat: "sun", resilience: "radio", housing: "house" };
const connectionIcons: Record<ConnectionId, IconName> = {
  trust: "shield",
  exchange: "cities",
  rules: "rules",
};
const KIND_COLORS: Record<Kind, string> = {
  place: "#4f9a3e",
  observation: "#1b98b1",
  people: "#e19a12",
  decision: "#df5536",
  outcome: "#7a4dc2",
};
const TONE_COLORS: Record<Tone, string> = {
  enables: "#3b7d2d",
  observes: "#0d7f96",
  informs: "#0d7f96",
  decides: "#a56a00",
  delivers: "#c33f27",
  learns: "#256b39",
  shares: "#2d5fb3",
  rules: "#6a43b5",
};
const RELATION_TONES: Record<ConnectionId, string> = {
  trust: "#3d4fa8",
  rules: TONE_COLORS.rules,
  exchange: TONE_COLORS.shares,
};
/** Top to bottom in the order their objects appear beside the model. */
const ACROSS_ORDER: ConnectionId[] = ["trust", "rules", "exchange"];

function KindIcon({ kind }: { kind: Kind }) {
  const color = KIND_COLORS[kind];
  return (
    <svg className="kind-icon" viewBox="0 0 48 48" aria-hidden="true">
      {kind === "place" && (
        <>
          <path d="M24 6 42 15 24 24 6 15Z" fill={color} />
          <path d="M6 15v17l18 9V24Z" fill={color} opacity=".75" />
          <path d="M42 15v17l-18 9V24Z" fill={color} opacity=".55" />
        </>
      )}
      {kind === "observation" && (
        <>
          <path d="M24 6 42 15 24 24 6 15Z M6 15v17l18 9 18-9V15M24 24v17" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="16" cy="30" r="3" fill={color} />
          <circle cx="31" cy="29" r="3" fill="none" stroke={color} strokeWidth="2" strokeDasharray="2 2" />
        </>
      )}
      {kind === "people" && (
        <>
          <circle cx="18" cy="14" r="6" fill={color} />
          <path d="M8 40c0-9 4.5-15 10-15s10 6 10 15Z" fill={color} />
          <path d="M28 40h14V22l-7-5-7 5Z" fill={color} opacity=".6" />
        </>
      )}
      {kind === "decision" && (
        <>
          <path d="M12 6v36" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M13 8h24l-6 7 6 7H13Z" fill={color} />
          <path d="m22 33 4 4 9-10" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === "outcome" && (
        <>
          <circle cx="24" cy="24" r="16" fill="none" stroke={color} strokeWidth="3" />
          <path d="m16 24 6 6 11-12" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 38 42 44M38 36l4 4" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function StadtstackExperience() {
  const [language, setLanguage] = useState<Language>("de");
  const [focus, setFocus] = useState<Focus>({ type: "overview" });
  const [story, setStory] = useState<StoryPosition>(null);
  const [closeUp, setCloseUp] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [turn, setTurn] = useState<{ nonce: number; direction: -1 | 1 }>({ nonce: 0, direction: 1 });
  const [revealTick, setRevealTick] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const t = (de: string, en: string) => (language === "de" ? de : en);

  const selectedLayerId: LayerId | null = story
    ? examples.find((item) => item.id === story.id)!.steps[story.step].layer
    : focus.type === "layer"
      ? focus.id
      : focus.type === "entity"
        ? entities[focus.id].layer
        : null;
  const closeUpLayer =
    !story && (focus.type === "layer" || (focus.type === "entity" && entities[focus.id].layer))
      ? selectedLayerId
      : null;
  const hasCard = story !== null || focus.type !== "overview";
  const closeUpLabel =
    closeUp && closeUpLayer !== null
      ? t("Stapel schließen", "Close the stack")
      : closeUpLayer
        ? `${t("Ebene", "Level")} 0${closeUpLayer} ${t("öffnen", "up close")}`
        : t("Näher ansehen", "Look closer");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Every choice brings its card into view: the top of the reading column on wide screens,
  // the space right under the pinned model on small ones.
  useEffect(() => {
    const hero = heroRef.current;
    const card = cardRef.current;
    if (!revealTick || !hero || !card) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const cardTop = card.getBoundingClientRect().top;
    if (window.matchMedia("(min-width: 1100px)").matches) {
      const header = document.querySelector<HTMLElement>(".masthead")?.offsetHeight ?? 0;
      if (cardTop < header || cardTop > window.innerHeight * 0.6)
        window.scrollTo({ top: hero.getBoundingClientRect().top + window.scrollY - header, behavior });
    } else {
      // The model shrinks while a card is open; measure after that change has been applied.
      const stage = hero.querySelector<HTMLElement>(".stage");
      requestAnimationFrame(() => {
        const stageHeight = stage?.offsetHeight ?? 0;
        const top = card.getBoundingClientRect().top;
        if (Math.abs(top - stageHeight - 12) > 24)
          window.scrollBy({ top: top - stageHeight - 12, behavior });
      });
    }
  }, [revealTick]);

  function reveal() {
    setRevealTick((tick) => tick + 1);
  }
  function selectLayer(id: LayerId) {
    setStory(null);
    setFocus({ type: "layer", id });
    reveal();
  }
  function selectEntity(id: EntityId) {
    setStory(null);
    setFocus({ type: "entity", id });
    if (!entities[id].layer) setCloseUp(false);
    reveal();
  }
  function selectConnection(id: ConnectionId) {
    setStory(null);
    setCloseUp(false);
    setFocus({ type: "connection", id });
    reveal();
  }
  function startStory(id: ExampleId) {
    setCloseUp(false);
    setFocus({ type: "overview" });
    setStory({ id, step: 0 });
    reveal();
  }
  function goToStep(id: ExampleId, step: number) {
    setStory({ id, step });
    reveal();
  }
  function wholeCity() {
    setStory(null);
    setCloseUp(false);
    setFocus({ type: "overview" });
    setResetKey((key) => key + 1);
    const hero = heroRef.current;
    if (!hero) return;
    const header = window.matchMedia("(min-width: 1100px)").matches
      ? (document.querySelector<HTMLElement>(".masthead")?.offsetHeight ?? 0)
      : 0;
    const { top, bottom } = hero.getBoundingClientRect();
    if (top < header - 1 && bottom > header)
      window.scrollTo({
        top: top + window.scrollY - header,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }
  function pick(target: PickTarget) {
    if ("entity" in target) selectEntity(target.entity);
    else selectLayer(target.layer);
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (story) setStory(null);
      else if (closeUp) setCloseUp(false);
      else if (focus.type === "entity" && entities[focus.id].layer)
        setFocus({ type: "layer", id: entities[focus.id].layer! });
      else if (focus.type !== "overview") {
        setFocus({ type: "overview" });
        setResetKey((key) => key + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, closeUp, focus]);

  const activeExample = story ? examples.find((item) => item.id === story.id)! : null;
  const announcement = activeExample
    ? `${activeExample.title[language]}: ${activeExample.steps[story!.step].title[language]}`
    : focus.type === "layer"
      ? layers[focus.id - 1].title[language]
      : focus.type === "entity"
        ? entities[focus.id].name[language]
        : focus.type === "connection"
          ? connections.find((item) => item.id === focus.id)!.short[language]
          : t("Ganze Stadt", "Whole city");

  const entityButton = (id: EntityId, extra?: ReactNode) => {
    const entity = entities[id];
    return (
      <button
        className="entity-link"
        style={{ "--tone": KIND_COLORS[entity.kind] } as CSSProperties}
        onClick={() => selectEntity(id)}
      >
        <span className="entity-link-name">{entity.name[language]}</span>
        {entity.layer ? (
          <span className="entity-link-level">0{entity.layer}</span>
        ) : (
          <span className="entity-link-level">{t("außen", "outside")}</span>
        )}
        {extra}
      </button>
    );
  };

  const relationRow = (from: EntityId, to: EntityId, perspective?: EntityId) => {
    const relation = findRelation([from, to])!;
    const other = perspective === from ? to : perspective === to ? from : null;
    return (
      <li key={`${from}-${to}`} className="relation-row" style={{ "--tone": TONE_COLORS[relation.tone] } as CSSProperties}>
        {other === null ? (
          <>
            <button className="relation-entity" onClick={() => selectEntity(from)}>
              {entities[from].name[language]}
            </button>
            <span className="relation-verb">{relation.verb[language]}</span>
            <button className="relation-entity" onClick={() => selectEntity(to)}>
              {entities[to].name[language]}
            </button>
          </>
        ) : perspective === to ? (
          <>
            <button className="relation-entity" onClick={() => selectEntity(from)}>
              {entities[from].name[language]}
            </button>
            <span className="relation-verb">{relation.verb[language]}</span>
          </>
        ) : (
          <>
            <span className="relation-verb">{relation.verb[language]}</span>
            <button className="relation-entity" onClick={() => selectEntity(to)}>
              {entities[to].name[language]}
            </button>
          </>
        )}
      </li>
    );
  };

  const topicsFor = (match: (target: TopicTarget) => boolean) =>
    topics.filter((topic) => match(topic.target));

  const crumbs = (items: { label: string; onClick?: () => void }[]) => (
    <nav className="crumbs" aria-label={t("Position im Modell", "Position in the model")}>
      <button onClick={wholeCity}>{t("Ganze Stadt", "Whole city")}</button>
      {items.map((item, index) => (
        <span key={index}>
          <span aria-hidden="true" className="crumb-sep">
            /
          </span>
          {item.onClick ? <button onClick={item.onClick}>{item.label}</button> : <span aria-current="location">{item.label}</span>}
        </span>
      ))}
    </nav>
  );

  const closeButton = (
    <button className="card-close" onClick={wholeCity} aria-label={t("Zur ganzen Stadt", "Back to the whole city")}>
      <Icon name="close" size={18} />
    </button>
  );

  let card: ReactNode = null;
  if (activeExample && story) {
    const step = activeExample.steps[story.step];
    const last = story.step === activeExample.steps.length - 1;
    const layer = layers[step.layer - 1];
    card = (
      <>
        <div className="card-top">
          {crumbs([{ label: `${t("Beispiel", "Example")}: ${activeExample.title[language]}` }])}
          {closeButton}
        </div>
        <p className="card-kicker" style={{ "--tone": layer.color } as CSSProperties}>
          <span className="kicker-dot" />
          {t("Schritt", "Step")} {story.step + 1} / {activeExample.steps.length} · 0{layer.id} {layer.short[language]}
        </p>
        <h2>{step.title[language]}</h2>
        <p className="card-body">{step.body[language]}</p>
        {step.evidence && (
          <p className={`evidence evidence--${step.evidence}`}>{evidenceLabels[step.evidence][language]}</p>
        )}
        {step.links.length > 0 && (
          <ul className="relation-list">{step.links.map(([from, to]) => relationRow(from, to))}</ul>
        )}
        <ol className="story-steps" aria-label={t("Schritte", "Steps")}>
          {activeExample.steps.map((item, index) => (
            <li key={index}>
              <button
                aria-current={index === story.step ? "step" : undefined}
                style={{ "--tone": layers[item.layer - 1].color } as CSSProperties}
                onClick={() => goToStep(activeExample.id, index)}
                title={item.title[language]}
              >
                <span className="sr-only">
                  {t("Schritt", "Step")} {index + 1}:{" "}
                </span>
                <span aria-hidden="true">{index + 1}</span>
                <span className="sr-only">{item.title[language]}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="story-nav">
          <button
            className="button-quiet"
            disabled={story.step === 0}
            onClick={() => goToStep(activeExample.id, story.step - 1)}
          >
            <Icon name="prev" size={18} />
            {t("Zurück", "Back")}
          </button>
          {last ? (
            <button className="button-strong" onClick={() => startStory(activeExample.id)}>
              {t("Noch einmal", "Start again")}
              <Icon name="turnLeft" size={18} />
            </button>
          ) : (
            <button className="button-strong" onClick={() => goToStep(activeExample.id, story.step + 1)}>
              {t("Weiter", "Next")}
              <Icon name="next" size={18} />
            </button>
          )}
        </div>
      </>
    );
  } else if (focus.type === "layer") {
    const layer = layers[focus.id - 1];
    const inbound = new Map<LayerId | EntityId, Set<string>>();
    const outbound = new Map<LayerId | EntityId, Set<string>>();
    for (const relation of relations) {
      const fromLayer = entities[relation.from].layer;
      const toLayer = entities[relation.to].layer;
      if (toLayer === layer.id && fromLayer !== layer.id) {
        const key = fromLayer ?? relation.from;
        inbound.set(key, (inbound.get(key) ?? new Set()).add(relation.verb[language]));
      }
      if (fromLayer === layer.id && toLayer !== layer.id) {
        const key = toLayer ?? relation.to;
        outbound.set(key, (outbound.get(key) ?? new Set()).add(relation.verb[language]));
      }
    }
    const self = (
      <span className="flow-self" style={{ "--tone": layer.color } as CSSProperties}>
        0{layer.id}
      </span>
    );
    const flows = [
      ...[...outbound].map(([other, verbs]) => ({ other, verbs, outward: true })),
      ...[...inbound].map(([other, verbs]) => ({ other, verbs, outward: false })),
    ];
    const layerTopics = topicsFor(
      (target) => "entity" in target && entities[target.entity].layer === layer.id,
    ).concat(topics.filter((topic) => topic.home === layer.id && !("entity" in topic.target)));
    card = (
      <>
        <div className="card-top">
          {crumbs([{ label: `0${layer.id} ${layer.title[language]}` }])}
          {closeButton}
        </div>
        <p className="card-kicker" style={{ "--tone": layer.color } as CSSProperties}>
          <span className="kicker-dot" />
          {t("Ebene", "Level")} 0{layer.id} · {t("der Platz", "the square")} {layer.lens[language]}
        </p>
        <h2>{layer.title[language]}</h2>
        <p className="card-question">{layer.question[language]}</p>
        <p className="card-body">{layer.description[language]}</p>
        <h3>{t("Auf dieser Ebene", "On this level")}</h3>
        <ul className="entity-chips">
          {layer.entities.map((id) => (
            <li key={id}>
              <button
                className="entity-chip"
                style={{ "--tone": KIND_COLORS[entities[id].kind] } as CSSProperties}
                onClick={() => selectEntity(id)}
              >
                {entities[id].name[language]}
              </button>
            </li>
          ))}
        </ul>
        <h3>{t("Verbunden mit dem Ganzen", "Connected to the whole")}</h3>
        <ul className="flow-list">
          {flows.map(({ other, verbs, outward }) => {
            const otherButton =
              typeof other === "number" ? (
                <button onClick={() => selectLayer(other)}>{`0${other} ${layers[other - 1].short[language]}`}</button>
              ) : (
                <button onClick={() => selectEntity(other)}>{entities[other].name[language]}</button>
              );
            return (
              <li key={`${outward ? "out" : "in"}-${other}`}>
                <span className="flow-pair">
                  {outward ? self : otherButton}
                  <span className="flow-arrow" aria-hidden="true">
                    →
                  </span>
                  {outward ? otherButton : self}
                </span>
                <span className="flow-verbs">{[...verbs].join(" · ")}</span>
              </li>
            );
          })}
        </ul>
        <details className="card-more">
          <summary>{t("Mehr über diese Ebene", "More about this level")}</summary>
          {layer.features.map((feature, index) => (
            <div key={index} className="feature">
              <h4>{feature.title[language]}</h4>
              <p>{feature.body[language]}</p>
            </div>
          ))}
        </details>
        <details className="card-more">
          <summary>{t("Bausteine & ursprüngliche Themen", "Components & original topics")}</summary>
          <ul className="block-list">
            {layer.blocks.map((block, index) => (
              <li key={index}>{block[language]}</li>
            ))}
          </ul>
          <ul className="topic-inline">
            {layerTopics.map((topic) => (
              <li key={topic.n}>
                <span className="topic-number">{topic.n}</span> {topic.name[language]}
              </li>
            ))}
          </ul>
        </details>
      </>
    );
  } else if (focus.type === "entity") {
    const entity = entities[focus.id];
    const layer = entity.layer ? layers[entity.layer - 1] : null;
    const incoming = relations.filter((relation) => relation.to === focus.id);
    const outgoing = relations.filter((relation) => relation.from === focus.id);
    const entityTopics = topicsFor((target) => "entity" in target && target.entity === focus.id);
    card = (
      <>
        <div className="card-top">
          {crumbs(
            layer
              ? [
                  { label: `0${layer.id} ${layer.short[language]}`, onClick: () => selectLayer(layer.id) },
                  { label: entity.name[language] },
                ]
              : [{ label: entity.name[language] }],
          )}
          {closeButton}
        </div>
        <p className="card-kicker" style={{ "--tone": KIND_COLORS[entity.kind] } as CSSProperties}>
          <KindIcon kind={entity.kind} />
          {kinds[entity.kind].label[language]}
        </p>
        <h2>{entity.name[language]}</h2>
        <p className="card-body">{entity.role[language]}</p>
        {incoming.length > 0 && (
          <>
            <h3>{t("Hängt ab von", "Depends on")}</h3>
            <ul className="relation-list">
              {incoming.map((relation) => relationRow(relation.from, relation.to, focus.id))}
            </ul>
          </>
        )}
        {outgoing.length > 0 && (
          <>
            <h3>{t("Informiert & ermöglicht", "Informs & enables")}</h3>
            <ul className="relation-list">
              {outgoing.map((relation) => relationRow(relation.from, relation.to, focus.id))}
            </ul>
          </>
        )}
        <dl className="facts">
          <div>
            <dt>{t("Verantwortlich", "Responsible")}</dt>
            <dd>{entity.responsible[language]}</dd>
          </div>
          {entity.trust && (
            <div>
              <dt>{t("Rechte & Vertrauen", "Rights & trust")}</dt>
              <dd>{entity.trust[language]}</dd>
            </div>
          )}
          {entityTopics.length > 0 && (
            <div>
              <dt>{t("Ursprüngliche Themen", "Original topics")}</dt>
              <dd>
                {entityTopics.map((topic) => (
                  <span key={topic.n} className="topic-chip">
                    <span className="topic-number">{topic.n}</span> {topic.name[language]}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </>
    );
  } else if (focus.type === "connection") {
    const connection = connections.find((item) => item.id === focus.id)!;
    const connectionTopics = topicsFor((target) => "connection" in target && target.connection === focus.id);
    card = (
      <>
        <div className="card-top">
          {crumbs([{ label: connection.short[language] }])}
          {closeButton}
        </div>
        <p className="card-kicker card-kicker--ink">
          <Icon name={connectionIcons[connection.id]} size={18} />
          {t("Wirkt über alle Ebenen hinweg", "Works across every level")}
        </p>
        <h2>{connection.short[language]}</h2>
        <p className="card-question">{connection.title[language]}</p>
        <p className="card-body">{connection.description[language]}</p>
        <ol className="connection-steps">
          {connection.steps.map((step, index) => (
            <li key={index}>{step[language]}</li>
          ))}
        </ol>
        {connection.id === "trust" ? (
          <>
            <h3>{t("So gilt es im Modell", "How it applies in the model")}</h3>
            <ul className="trust-list">
              {connection.focus.map((id) => (
                <li key={id}>
                  {entityButton(id)}
                  <span>{entities[id].trust?.[language]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3>{t("Richtung & Reichweite", "Direction & reach")}</h3>
            <ul className="relation-list">{connection.links.map(([from, to]) => relationRow(from, to))}</ul>
          </>
        )}
        <p className="card-note">{connection.note[language]}</p>
        {connectionTopics.length > 0 && (
          <p className="card-topics">
            {t("Ursprüngliche Themen", "Original topics")}:{" "}
            {connectionTopics.map((topic) => (
              <span key={topic.n} className="topic-chip">
                <span className="topic-number">{topic.n}</span> {topic.name[language]}
              </span>
            ))}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#explore">
        {t("Zum Modell springen", "Skip to the model")}
      </a>
      <header className="masthead">
        <a className="brand" href="#explore" onClick={wholeCity}>
          <Mark />
          <span>
            stadtstack<span className="brand-dot">.</span>
          </span>
        </a>
        <nav className="masthead-nav" aria-label={t("Seitenbereiche", "Page sections")}>
          <a href="#explore">{t("Modell", "Model")}</a>
          <a href="#legend">{t("Lesart", "How to read")}</a>
          <a href="#family">{family.nav[language]}</a>
        </nav>
        <div className="language-switch" role="group" aria-label={t("Sprache", "Language")}>
          {(["de", "en"] as const).map((lang) => (
            <button key={lang} lang={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
              {lang === "de" ? "Deutsch" : "English"}
            </button>
          ))}
        </div>
      </header>

      <main>
        <section
          id="explore"
          ref={heroRef}
          className={`hero${hasCard ? " has-card" : ""}${story ? " has-story" : ""}`}
          aria-labelledby="hero-title"
          data-stage
        >
          <div className="rail">
            <div className="intro">
              <p className="kicker">
                {t("Architekturmodell · illustrativ", "Architecture model · illustrative")}
              </p>
              <h1 id="hero-title">
                {t("Eine Stadt,", "One city,")} <em>{t("viermal gesehen.", "seen four ways.")}</em>
              </h1>
              <p className="lede">
                {t(
                  "Derselbe Platz – gebaut, gemessen, beraten, verändert. Wähle etwas aus und sieh, womit es zusammenhängt.",
                  "The same square – built, measured, discussed, changed. Select anything to see what it connects to.",
                )}
              </p>
            </div>

            <nav className="levels" aria-label={t("Die vier Ebenen", "The four levels")}>
              <p className="rail-label">{t("Vier Ebenen, ein Ort", "Four levels, one place")}</p>
              {[...layers].reverse().map((layer) => (
                <button
                  key={layer.id}
                  data-leader={layer.id}
                  className="level-button"
                  style={{ "--tone": layer.color } as CSSProperties}
                  aria-pressed={selectedLayerId === layer.id && !story}
                  aria-current={story && selectedLayerId === layer.id ? "step" : undefined}
                  onClick={() => selectLayer(layer.id)}
                >
                  <span className="level-number">0{layer.id}</span>
                  <span className="level-text">
                    <span className="level-title">{layer.title[language]}</span>
                    <span className="level-question">{layer.question[language]}</span>
                  </span>
                </button>
              ))}
            </nav>

            <aside ref={cardRef} className={`card${hasCard ? " is-open" : ""}`} aria-label={t("Details", "Details")}>
              {card ?? (
                <div className="card-hint">
                  <p>
                    {t(
                      "Tippe auf eine Ebene, ein Objekt im Modell oder ein Beispiel. Die Linien zeigen dann, was wovon abhängt, wer zuständig ist und wohin Ergebnisse zurückfließen.",
                      "Tap a level, an object in the model, or an example. The lines then show what depends on what, who is responsible, and where results flow back.",
                    )}
                  </p>
                </div>
              )}
            </aside>
          </div>

          <div className="stage">
            <StadtstackScene
              language={language}
              focus={focus}
              story={story}
              closeUp={closeUp && closeUpLayer !== null}
              resetKey={resetKey}
              turn={turn}
              onPick={pick}
            />
            <div className="view-controls" role="group" aria-label={t("Ansicht", "View")} data-stage-controls>
              <button
                onClick={() => setTurn((value) => ({ nonce: value.nonce + 1, direction: -1 }))}
                aria-label={t("Ansicht nach links drehen", "Rotate view left")}
                title={t("Nach links drehen", "Rotate left")}
              >
                <Icon name="turnLeft" size={19} />
              </button>
              <button
                onClick={() => setTurn((value) => ({ nonce: value.nonce + 1, direction: 1 }))}
                aria-label={t("Ansicht nach rechts drehen", "Rotate view right")}
                title={t("Nach rechts drehen", "Rotate right")}
              >
                <Icon name="turnRight" size={19} />
              </button>
              <button
                className="with-label"
                aria-pressed={closeUp && closeUpLayer !== null}
                disabled={closeUpLayer === null}
                onClick={() => setCloseUp((value) => !value)}
                title={
                  closeUpLayer === null
                    ? t("Zuerst eine Ebene oder ein Objekt wählen", "Choose a level or an object first")
                    : closeUpLabel
                }
              >
                <Icon name="zoom" size={19} />
                <span>{closeUpLabel}</span>
              </button>
              <button className="with-label" onClick={wholeCity} title={t("Ganze Stadt", "Whole city")}>
                <Icon name="whole" size={19} />
                <span>{t("Ganze Stadt", "Whole city")}</span>
              </button>
            </div>
          </div>

          <div className="across">
            <div className="across-group" role="group" aria-labelledby="relations-label">
              <p className="rail-label" id="relations-label">
                {t("Wirkt über alle Ebenen", "Across all levels")}
              </p>
              <ul className="callouts">
                {ACROSS_ORDER.map((id) => {
                  const connection = connections.find((item) => item.id === id)!;
                  return (
                    <li key={id}>
                      <button
                        className="callout"
                        data-relation-leader={id}
                        style={{ "--tone": RELATION_TONES[id] } as CSSProperties}
                        aria-pressed={focus.type === "connection" && focus.id === id}
                        onClick={() => selectConnection(id)}
                      >
                        <span className="callout-icon">
                          <Icon name={connectionIcons[id]} size={20} />
                        </span>
                        <span className="callout-text">
                          <span className="callout-title">{connection.short[language]}</span>
                          <span className="callout-sub">{connection.reach[language]}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="across-group" role="group" aria-labelledby="stories-label">
              <p className="rail-label" id="stories-label">
                {t("Einem Beispiel folgen", "Follow an example")}
              </p>
              <ul className="callouts">
                {examples.map((example) => (
                  <li key={example.id}>
                    <button
                      className="callout callout--story"
                      aria-pressed={story?.id === example.id}
                      onClick={() => startStory(example.id)}
                    >
                      <span className="callout-icon">
                        <Icon name={storyIcons[example.id]} size={20} />
                      </span>
                      <span className="callout-text">
                        <span className="callout-title">{example.title[language]}</span>
                        <span className="callout-sub">{example.teaser[language]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </section>

        <section id="legend" className="legend" aria-labelledby="legend-title">
          <div className="section-head">
            <p className="kicker">{t("Lesart", "How to read it")}</p>
            <h2 id="legend-title">
              {t("Formen für Dinge,", "Shapes for things,")} <em>{t("Linien für Beziehungen.", "lines for relationships.")}</em>
            </h2>
            <p>
              {t(
                "Jede Ebene zeigt denselben Ort. Die Farbe verrät die Ebene, die Form die Art des Dings, die Linie seine Beziehung zu anderen.",
                "Every level shows the same place. Color tells you the level, shape tells you the kind of thing, and a line tells you how it relates to others.",
              )}
            </p>
          </div>
          <ul className="kind-grid">
            {(Object.keys(kinds) as Kind[]).map((kind) => (
              <li key={kind} style={{ "--tone": KIND_COLORS[kind] } as CSSProperties}>
                <KindIcon kind={kind} />
                <h3>{kinds[kind].label[language]}</h3>
                <p>{kinds[kind].hint[language]}</p>
                <p className="kind-examples">
                  {Object.values(entities)
                    .filter((entity) => entity.kind === kind)
                    .map((entity) => entity.name[language])
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          <ul className="line-grid">
            {[
              {
                tone: "delivers" as Tone,
                dash: undefined,
                title: t("Führt zu", "Leads to"),
                text: t("versorgt, beobachtet, erklärt, entscheidet, setzt um", "powers, observes, explains, decides, delivers"),
              },
              {
                tone: "learns" as Tone,
                dash: "8 6",
                title: t("Fließt zurück", "Feeds back"),
                text: t("Wirkung wird gemessen und wird zu neuem Wissen", "Outcomes are measured and become new knowledge"),
              },
              {
                tone: "shares" as Tone,
                dash: "2 6",
                title: t("Zwischen Städten", "Between cities"),
                text: t("vergleichen, teilen, vor Ort anpassen", "compare, share, adapt locally"),
              },
              {
                tone: "rules" as Tone,
                dash: "11 5 2 5",
                title: t("An zuständige Stellen", "To responsible bodies"),
                text: t("Vorschlag hin, Prüfung und Antwort zurück", "Proposal out, review and response back"),
              },
            ].map((line) => (
              <li key={line.title}>
                <svg viewBox="0 0 120 24" aria-hidden="true">
                  <path
                    d="M4 16 C40 2 80 2 110 12"
                    fill="none"
                    stroke={TONE_COLORS[line.tone]}
                    strokeWidth="2.5"
                    strokeDasharray={line.dash}
                    strokeLinecap="round"
                  />
                  <path d="m104 6 9 7-11 3Z" fill={TONE_COLORS[line.tone]} />
                </svg>
                <div>
                  <h3>{line.title}</h3>
                  <p>{line.text}</p>
                </div>
              </li>
            ))}
            <li>
              <svg viewBox="0 0 120 24" aria-hidden="true">
                <rect x="4" y="3" width="112" height="18" rx="7" fill="none" stroke="#3d4fa8" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              <div>
                <h3>{t("Rahmen", "Frame")}</h3>
                <p>{t("Rechte, Datenschutz und Nachvollziehbarkeit gelten überall", "Rights, privacy, and traceability apply everywhere")}</p>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 120 24" aria-hidden="true">
                <path d="M60 1v22" stroke="#15263b" strokeWidth="2" strokeDasharray="3 4" />
                <circle cx="60" cy="4" r="3" fill="#15263b" />
                <circle cx="60" cy="20" r="3" fill="#15263b" />
              </svg>
              <div>
                <h3>{t("Lot", "Plumb line")}</h3>
                <p>{t("Derselbe Platz auf allen vier Ebenen", "The same square on all four levels")}</p>
              </div>
            </li>
            <li className="line-wide">
              <span className="evidence evidence--measured">{evidenceLabels.measured[language]}</span>
              <span className="evidence evidence--scenario">{t("Szenario", "Scenario")}</span>
              <div>
                <h3>{t("Gemessen oder angenommen", "Measured or assumed")}</h3>
                <p>
                  {t(
                    "Messwerte stehen durchgezogen, Szenarien gestrichelt. Beides bleibt unterscheidbar.",
                    "Measurements are solid, scenarios dashed. The two stay distinct.",
                  )}
                </p>
              </div>
            </li>
          </ul>
          <div className="loop-strip" aria-label={t("Der Kreislauf", "The cycle")}>
            {[
              [1, t("bereitstellen", "provide")],
              [2, t("beobachten & erklären", "observe & explain")],
              [3, t("beraten & entscheiden", "deliberate & decide")],
              [4, t("umsetzen & prüfen", "deliver & evaluate")],
            ].map(([id, label]) => (
              <span key={id} style={{ "--tone": layers[(id as number) - 1].color } as CSSProperties}>
                <b>0{id}</b> {label}
              </span>
            ))}
            <span className="loop-return">
              {t("… und was wirkt, fließt zurück ins Wissen.", "… and what works feeds back into knowledge.")}
            </span>
          </div>
        </section>

        <section id="family" className="family" aria-labelledby="family-title">
          <div className="section-head">
            <h2 id="family-title">{family.title[language]}</h2>
          </div>
          <ul className="family-grid">
            {family.cards.map((member) => (
              <li key={member.id} className="family-card">
                <div className="family-card-heading">
                  {member.id === "ledger" && (
                    <Image className="family-mark" src="/ledger-mark.svg" alt="" width={40} height={44} unoptimized />
                  )}
                  <h3>{member.title[language]}</h3>
                </div>
                <p className="family-badge">{member.badge[language]}</p>
                <p className="family-description">{member.description[language]}</p>
                <a className="family-link" href={member.href}>
                  {member.linkLabel[language]}
                  {member.id !== "stadtstack" && <Icon name="external" size={16} />}
                </a>
              </li>
            ))}
          </ul>
        </section>

      </main>

      <footer className="footer">
        <a className="brand" href="#explore" onClick={wholeCity}>
          <Mark />
          <span>
            stadtstack<span className="brand-dot">.</span>
          </span>
        </a>
        <p>
          {t(
            "Ein Architekturmodell für Städte, die gemeinsam handeln und aus Ergebnissen lernen.",
            "An architecture model for cities that act together and learn from results.",
          )}
          <small>
            {t(
              "Alle Szenen sind illustrativ: Sie zeigen keine Live-Daten einer Stadt, kein laufendes Stadtspiel, keine S2Vec-Anbindung und kein umgesetztes Verfahren zur Regeländerung.",
              "All scenes are illustrative: they show no live municipal data, no working city game, no S2Vec integration, and no implemented rule-change process.",
            )}
          </small>
        </p>
        <a
          className="footer-link"
          href="https://research.google/blog/mapping-the-modern-world-how-s2vec-learns-the-language-of-our-cities/"
          target="_blank"
          rel="noreferrer"
        >
          {t("Hintergrund: S2Vec", "Background: S2Vec")}
          <Icon name="external" size={16} />
        </a>
      </footer>
    </>
  );
}
