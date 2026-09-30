"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  c,
  connections,
  entities,
  evidenceLabels,
  examples,
  findRelation,
  kinds,
  layers,
  relations,
  restingCue,
  type ConnectionId,
  type EntityId,
  type Evidence,
  type ExampleId,
  type Language,
  type LayerId,
  type SceneCue,
  type Tone,
} from "./stadtstack-content";
import {
  buildCity,
  plateY,
  PLATE_DEPTH,
  PLATE_THICKNESS,
  PLATE_WIDTH,
  type CityModel,
  type CueState,
  type Owner,
} from "./stadtstack-models";

export type Focus =
  | { type: "overview" }
  | { type: "layer"; id: LayerId }
  | { type: "entity"; id: EntityId }
  | { type: "connection"; id: ConnectionId };
export type StoryPosition = { id: ExampleId; step: number } | null;
export type PickTarget = { entity: EntityId } | { layer: LayerId };

type Props = {
  language: Language;
  focus: Focus;
  story: StoryPosition;
  closeUp: boolean;
  resetKey: number;
  turn: { nonce: number; direction: -1 | 1 };
  onPick: (target: PickTarget) => void;
};

const ink = {
  sameSquare: c("derselbe Platz", "the same square"),
  loop: c("Wirkung fließt zurück", "outcomes feed back"),
  trust: c("Rechte & Vertrauen gelten überall", "Rights & trust apply everywhere"),
  canvas: c(
    "3D-Modell: derselbe Platz auf vier Ebenen – gebaut, gemessen, beraten, verändert. Alle Inhalte sind auch über die Schaltflächen erreichbar.",
    "3D model: the same square on four levels – built, measured, discussed, changed. Everything is also available through the buttons.",
  ),
  stage: c(
    "3D-Ansicht. Mit den Pfeiltasten drehen, mit Escape zurück.",
    "3D view. Use the arrow keys to rotate and Escape to step back.",
  ),
  fallback: c(
    "Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar. Alle Ebenen, Verbindungen und Beispiele bleiben über die Schaltflächen erreichbar.",
    "3D is not available on this device. Every level, connection, and example remains available through the buttons.",
  ),
  fallbackAlt: c(
    "Derselbe Platz auf vier Ebenen – gebaut, gemessen, beraten, verändert – mit einer vergleichbaren Stadt und übergeordneten Stellen.",
    "The same square on four levels – built, measured, discussed, changed – with a comparable city and higher institutions.",
  ),
};

const TONES: Record<Tone, { color: string; dash?: string }> = {
  enables: { color: "#3b7d2d" },
  observes: { color: "#0d7f96" },
  informs: { color: "#0d7f96" },
  decides: { color: "#a56a00" },
  delivers: { color: "#c33f27" },
  learns: { color: "#256b39", dash: "8 6" },
  shares: { color: "#2d5fb3", dash: "2 6" },
  rules: { color: "#6a43b5", dash: "11 5 2 5" },
};
const KIND_COLORS = {
  place: "#4f9a3e",
  observation: "#1b98b1",
  people: "#e19a12",
  decision: "#df5536",
  outcome: "#7a4dc2",
};
const TRUST_COLOR = "#3d4fa8";
const SHIELD =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 20 6v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6l8-3Z"/><path d="m8.5 12 2.4 2.4 4.9-4.9"/></svg>';
const SVG_NS = "http://www.w3.org/2000/svg";
const REST = { azimuth: 0.62, elevation: 0.47 };
/** Offsets tried, in order, when a label would cover another: [across, up/down]. */
const NUDGES = [
  [0, 0],
  [0, -1],
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -2],
  [0, 2],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [0, -3],
  [0, 3],
  [2, 0],
  [-2, 0],
] as const;
const LIMITS = { azimuth: [-0.35, 1.3], elevation: [0.18, 0.95] } as const;

type End = EntityId[];
type Thread = { from: End; to: End; verb: string; tone: Tone };
type Tag = { entity: EntityId; strong: boolean; trust?: string };
type Note = { anchor: EntityId | "scenario"; evidence: Evidence };
type Plan = {
  dim: (owner: Owner) => number;
  threads: Thread[];
  tags: Tag[];
  notes: Note[];
  emphasis: { plumb: boolean; loop: boolean; trust: boolean };
  fit: Owner[] | null;
  openAt: LayerId | null;
  activeLayer: LayerId | null;
  kind: "overview" | "story" | "layer" | "entity" | "connection";
  /** Where a story happens, so its labels land on the right building. */
  site: "lot" | "center" | null;
  cue: SceneCue;
};

const ownerLayer = (owner: Owner): LayerId | null =>
  owner.startsWith("plate-")
    ? (Number(owner.slice(6)) as LayerId)
    : entities[owner as EntityId].layer;

function relationThread([from, to]: readonly [EntityId, EntityId], language: Language): Thread | null {
  const relation = findRelation([from, to]);
  return relation
    ? { from: [from], to: [to], verb: relation.verb[language], tone: relation.tone }
    : null;
}

function layerBundles(layerId: LayerId, language: Language): Thread[] {
  const side = (id: EntityId) => String(entities[id].layer ?? id);
  const bundles = new Map<string, { from: Set<EntityId>; to: Set<EntityId>; verbs: string[]; tone: Tone }>();
  for (const relation of relations) {
    const a = side(relation.from);
    const b = side(relation.to);
    if (a === b || (a !== String(layerId) && b !== String(layerId))) continue;
    const key = `${a}>${b}`;
    const bundle = bundles.get(key) ?? { from: new Set(), to: new Set(), verbs: [], tone: relation.tone };
    bundle.from.add(relation.from);
    bundle.to.add(relation.to);
    const verb = relation.verb[language];
    if (!bundle.verbs.includes(verb)) bundle.verbs.push(verb);
    bundles.set(key, bundle);
  }
  return [...bundles.values()].map((bundle) => ({
    from: [...bundle.from],
    to: [...bundle.to],
    verb: bundle.verbs.slice(0, 3).join(" · ") + (bundle.verbs.length > 3 ? " …" : ""),
    tone: bundle.tone,
  }));
}

function makePlan(props: Props): Plan {
  const { focus, story, closeUp, language } = props;
  const resting = { ...restingCue };
  if (story) {
    const example = examples.find((item) => item.id === story.id)!;
    const step = example.steps[story.step];
    const focusSet = new Set<EntityId>(step.focus);
    for (const [from, to] of step.links) {
      focusSet.add(from);
      focusSet.add(to);
    }
    const threads = step.links.flatMap((link) => relationThread(link, language) ?? []);
    const notes: Note[] = [];
    if (step.evidence === "measured") notes.push({ anchor: "sensors", evidence: "measured" });
    if (step.evidence === "scenario") notes.push({ anchor: "scenario", evidence: "scenario" });
    if (step.evidence === "decision")
      notes.push({ anchor: focusSet.has("ruleCase") ? "ruleCase" : "council", evidence: "decision" });
    if (step.evidence === "outcome") notes.push({ anchor: "evaluation", evidence: "outcome" });
    return {
      dim: (owner) =>
        focusSet.has(owner as EntityId)
          ? 0
          : owner === `plate-${step.layer}`
            ? 0.15
            : owner.startsWith("plate-")
              ? 0.5
              : 0.62,
      threads,
      tags: [...focusSet].map((entity) => ({ entity, strong: step.focus[0] === entity })),
      notes,
      emphasis: {
        plumb: story.id === "heat" && (focusSet.has("square") || focusSet.has("change") || focusSet.has("sensors")),
        loop: step.links.some(([from, to]) => from === "evaluation" && to === "openData"),
        trust: false,
      },
      fit: [...focusSet],
      openAt: null,
      kind: "story",
      site: story.id === "housing" ? "lot" : story.id === "resilience" ? "center" : null,
      activeLayer: step.layer,
      cue: { ...resting, options: false, ...step.cue },
    };
  }
  if (focus.type === "layer" || (focus.type === "entity" && closeUp)) {
    const layerId = focus.type === "layer" ? focus.id : entities[focus.id].layer;
    if (layerId && (focus.type === "layer" || closeUp)) {
      const members = new Set<EntityId>(layers[layerId - 1].entities);
      const entityFocus = focus.type === "entity" ? focus.id : null;
      const linked = new Set<EntityId>();
      for (const relation of relations) {
        if (members.has(relation.from)) linked.add(relation.to);
        if (members.has(relation.to)) linked.add(relation.from);
      }
      const incident = entityFocus
        ? relations.filter((relation) => relation.from === entityFocus || relation.to === entityFocus)
        : [];
      const related = new Set<EntityId>(incident.flatMap((relation) => [relation.from, relation.to]));
      const threads = entityFocus
        ? incident.map((relation) => relationThread([relation.from, relation.to], language)!)
        : layerBundles(layerId, language);
      return {
        dim: (owner) => {
          const layerOf = ownerLayer(owner);
          if (closeUp && layerOf !== null && layerOf < layerId) return 0.88;
          if (entityFocus) {
            if (owner === entityFocus || related.has(owner as EntityId)) return 0;
            return layerOf === layerId ? 0.35 : 0.8;
          }
          if (layerOf === layerId) return 0;
          return linked.has(owner as EntityId) ? 0.28 : 0.62;
        },
        threads,
        tags: entityFocus
          ? [...new Set<EntityId>([entityFocus, ...related])].map((entity) => ({
              entity,
              strong: entity === entityFocus,
            }))
          : [...members].map((entity) => ({ entity, strong: false })),
        notes: [],
        emphasis: { plumb: false, loop: false, trust: false },
        fit: closeUp ? [`plate-${layerId}`, ...members] : null,
        openAt: closeUp ? layerId : null,
        kind: entityFocus ? "entity" : "layer",
        site: null,
        activeLayer: layerId,
        cue: resting,
      };
    }
  }
  if (focus.type === "entity") {
    const id = focus.id;
    const incident = relations.filter((relation) => relation.from === id || relation.to === id);
    const related = new Set<EntityId>(incident.flatMap((relation) => [relation.from, relation.to]));
    related.add(id);
    const plates = new Set([...related].map((entity) => entities[entity].layer));
    return {
      dim: (owner) => {
        if (related.has(owner as EntityId)) return 0;
        const layerOf = ownerLayer(owner);
        if (owner.startsWith("plate-")) return plates.has(layerOf) ? 0.32 : 0.62;
        return 0.66;
      },
      threads: incident.map((relation) => relationThread([relation.from, relation.to], language)!),
      tags: [...related].map((entity) => ({ entity, strong: entity === id })),
      notes: [],
      emphasis: {
        plumb: id === "square" || id === "change",
        loop: false,
        trust: false,
      },
      fit: [...related],
      openAt: null,
      kind: "entity",
      site: null,
      activeLayer: entities[id].layer,
      cue: resting,
    };
  }
  if (focus.type === "connection") {
    const connection = connections.find((item) => item.id === focus.id)!;
    const members = new Set<EntityId>(connection.focus);
    const trust = focus.id === "trust";
    return {
      dim: (owner) =>
        members.has(owner as EntityId) ? 0 : owner.startsWith("plate-") ? (trust ? 0.2 : 0.5) : 0.62,
      threads: connection.links.flatMap((link) => relationThread(link, language) ?? []),
      tags: connection.focus.map((entity) => ({
        entity,
        strong: !trust,
        trust: trust ? entities[entity].trust?.[language] : undefined,
      })),
      notes: [],
      emphasis: { plumb: false, loop: false, trust },
      fit: trust ? null : [...members],
      openAt: null,
      kind: "connection",
      site: null,
      activeLayer: null,
      cue: resting,
    };
  }
  return {
    dim: () => 0,
    threads: [],
    tags: [],
    notes: [],
    emphasis: { plumb: false, loop: false, trust: false },
    fit: null,
    openAt: null,
    kind: "overview",
    site: null,
    activeLayer: null,
    cue: resting,
  };
}

const cueNumbers = (cue: SceneCue): CueState => ({
  heat: cue.heat,
  measured: cue.measured === "after" ? 1 : 0,
  scenario: Number(cue.scenario),
  options: Number(cue.options),
  decided: Number(cue.decided),
  delivered: cue.delivered,
  evaluated: Number(cue.evaluated),
  foundation: Number(cue.foundation),
  radio: Number(cue.radio),
  reports: Number(cue.reports),
  warning: Number(cue.warning),
  housingScenario: Number(cue.housingScenario),
  housingProposal: Number(cue.housingProposal),
  construction: cue.construction,
});

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  parent?: Element,
) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  parent?.appendChild(element);
  return element;
}

function isShown(object: THREE.Object3D | null) {
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current.scale.x < 0.02) return false;
  }
  return true;
}

export default function StadtstackScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<SVGSVGElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const host = hostRef.current!;
    const canvasHost = canvasHostRef.current!;
    const inkLayer = inkRef.current!;
    const labelLayer = labelsRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.fallback = "true";
      return;
    }
    delete host.dataset.fallback;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvasHost.appendChild(canvas);

    const scene = new THREE.Scene();
    const model: CityModel = buildCity();
    scene.add(model.root);
    scene.add(new THREE.HemisphereLight("#ffffff", "#a9b3bf", 1.25));
    const key = new THREE.DirectionalLight("#fff2dc", 2.1);
    key.position.set(-8, 18, 12);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#dce8ff", 0.6);
    fill.position.set(12, 6, -8);
    scene.add(fill);

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    const rig = {
      target: new THREE.Vector3(0, plateY(2), 0),
      azimuth: REST.azimuth,
      elevation: REST.elevation,
      span: 30,
      ox: 0.5,
      oy: 0.5,
    };
    const goal = { ...rig, target: rig.target.clone() };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reduceMotion.matches;
    const onMotion = () => {
      reduced = reduceMotion.matches;
      dirty = true;
    };
    reduceMotion.addEventListener("change", onMotion);

    let width = 1;
    let height = 1;
    let dirty = true;
    let visible = true;
    let frameId = 0;
    let lastTime = performance.now();
    let plan: Plan = makePlan(propsRef.current);
    let planKey = "";
    let viewKey = "";
    let layoutKey = "";
    let turnNonce = propsRef.current.turn.nonce;
    let overviewSpan = 30;
    let inkDirty = false;
    let hovered: Owner | null = null;
    let pendingHover: { x: number; y: number } | null = null;

    const dimGoal = new Map<Owner, number>();
    const plateOffset: Record<LayerId, { current: number; goal: number }> = {
      1: { current: 0, goal: 0 },
      2: { current: 0, goal: 0 },
      3: { current: 0, goal: 0 },
      4: { current: 0, goal: 0 },
    };
    let cueGoal = cueNumbers(plan.cue);
    const cueCurrent: CueState = { ...cueGoal };
    model.applyCues(cueCurrent, 0);

    // Desktop layouts ask for the comparable city and the higher institutions beside the stack,
    // next to the column whose leaders point at them. Elsewhere the stage shape decides.
    const externalsBeside = () => {
      const forced = getComputedStyle(host).getPropertyValue("--externals").trim();
      return forced ? forced === "side" : width / Math.max(height, 1) >= 0.95;
    };
    const layoutExternals = () => {
      if (externalsBeside()) {
        model.neighbor.position.set(11.4, plateY(2) - 1.25, 1.4);
        model.higher.position.set(10.8, plateY(3) + 3.1, -1.8);
      } else {
        model.neighbor.position.set(3.2, -1.2, 11.2);
        model.higher.position.set(0.6, plateY(4) + 0.4, -9.6);
      }
      model.root.updateMatrixWorld(true);
    };
    const cornersOf = (owners: Owner[] | null) => {
      // Measure the closed stack so an opening close-up never distorts the frame.
      const saved = layers.map((layer) => [model.plates[layer.id].position.y, model.plates[layer.id].visible] as const);
      for (const layer of layers) {
        model.plates[layer.id].position.y = plateY(layer.id);
        model.plates[layer.id].visible = true;
      }
      model.root.updateMatrixWorld(true);
      const points: THREE.Vector3[] = [];
      for (const owner of model.owners.values()) {
        if (owners && !owners.includes(owner.id)) continue;
        for (const mesh of owner.meshes) {
          if (!isShown(mesh)) continue;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const { min, max } = mesh.geometry.boundingBox!;
          for (const x of [min.x, max.x])
            for (const y of [min.y, max.y])
              for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
        }
      }
      layers.forEach((layer, index) => {
        [model.plates[layer.id].position.y, model.plates[layer.id].visible] = saved[index];
      });
      model.root.updateMatrixWorld(true);
      return points;
    };

    const insets = () => {
      const style = getComputedStyle(host);
      const read = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
      return {
        top: read("--safe-top"),
        right: read("--safe-right"),
        bottom: read("--safe-bottom"),
        left: read("--safe-left"),
      };
    };

    const direction = (azimuth: number, elevation: number) =>
      new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation),
      );

    const fitGoal = (points: THREE.Vector3[], padding: number, minSpan = 0) => {
      if (!points.length) return;
      const view = direction(goal.azimuth, goal.elevation);
      const right = new THREE.Vector3(0, 1, 0).cross(view).normalize();
      const up = view.clone().cross(right).normalize();
      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      let depth = 0;
      for (const point of points) {
        const u = point.dot(right);
        const v = point.dot(up);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
        depth += point.dot(view);
      }
      goal.target
        .copy(right)
        .multiplyScalar((minU + maxU) / 2)
        .addScaledVector(up, (minV + maxV) / 2)
        .addScaledVector(view, depth / points.length);
      const inset = insets();
      const safeWidth = Math.max(width - inset.left - inset.right, width * 0.3);
      const safeHeight = Math.max(height - inset.top - inset.bottom, height * 0.3);
      goal.span =
        Math.max((maxV - minV) * (height / safeHeight), ((maxU - minU) * height) / safeWidth, minSpan) * padding;
      goal.ox = (inset.left + safeWidth / 2) / width;
      goal.oy = (inset.top + safeHeight / 2) / height;
    };

    const applyCamera = () => {
      camera.position.copy(rig.target).addScaledVector(direction(rig.azimuth, rig.elevation), 80);
      camera.up.set(0, 1, 0);
      camera.lookAt(rig.target);
      const aspect = width / height;
      camera.left = -rig.ox * rig.span * aspect;
      camera.right = (1 - rig.ox) * rig.span * aspect;
      camera.top = rig.oy * rig.span;
      camera.bottom = -(1 - rig.oy) * rig.span;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    };

    let wasOpen = false;
    const setView = (instant: boolean) => {
      const current = propsRef.current;
      layoutExternals();
      const overview = !current.story && current.focus.type === "overview";
      if (plan.openAt) goal.elevation = 0.66;
      else if (wasOpen || overview) goal.elevation = REST.elevation;
      if (overview) goal.azimuth = REST.azimuth;
      wasOpen = plan.openAt !== null;
      const portrait = !externalsBeside();
      const everything = cornersOf(
        portrait ? [...model.owners.keys()].filter((owner) => owner !== "neighbor" && owner !== "higher") : null,
      );
      const { azimuth, elevation } = goal;
      Object.assign(goal, REST);
      fitGoal(everything, 1.04);
      overviewSpan = goal.span;
      Object.assign(goal, { azimuth, elevation });
      if (plan.fit) fitGoal(cornersOf(plan.fit), plan.openAt ? 1.1 : 1.16, plan.openAt ? 0 : overviewSpan * 0.6);
      else fitGoal(everything, 1.04);
      if (instant || reduced) {
        rig.target.copy(goal.target);
        Object.assign(rig, {
          azimuth: goal.azimuth,
          elevation: goal.elevation,
          span: goal.span,
          ox: goal.ox,
          oy: goal.oy,
        });
        applyCamera();
      }
      dirty = true;
    };

    /* ---------------- ink overlay ---------------- */
    inkLayer.replaceChildren();
    const defs = svg("defs", {}, inkLayer);
    const markerTones: [string, string][] = [
      ...Object.entries(TONES).map(([tone, style]) => [tone, style.color] as [string, string]),
      ["trust", TRUST_COLOR],
    ];
    for (const [tone, color] of markerTones) {
      const marker = svg(
        "marker",
        {
          id: `ss-arrow-${tone}`,
          viewBox: "0 0 10 10",
          refX: 7,
          refY: 5,
          markerWidth: 11,
          markerHeight: 11,
          orient: "auto-start-reverse",
          markerUnits: "userSpaceOnUse",
        },
        defs,
      );
      svg("path", { d: "M0,1 L10,5 L0,9 z", fill: color }, marker);
    }
    const leaderGroup = svg("g", { class: "ink-leaders" }, inkLayer);
    // Threads and ambient marks stay on the stage; only leaders reach out to the side columns.
    const stageClip = svg("rect", { x: 0, y: 0, width: 1, height: 1 }, svg("clipPath", { id: "ss-stage-clip" }, defs));
    const ambientGroup = svg("g", { class: "ink-ambient", "clip-path": "url(#ss-stage-clip)" }, inkLayer);
    const threadGroup = svg("g", { class: "ink-threads", "clip-path": "url(#ss-stage-clip)" }, inkLayer);
    const trustFrame = svg("path", { class: "ink-trust-frame" }, ambientGroup);
    const trustLabel = svg("text", { class: "ink-trust-label" }, ambientGroup);
    const plumb = svg("path", { class: "ink-plumb" }, ambientGroup);
    const plumbDots = svg("g", { class: "ink-plumb-dots" }, ambientGroup);
    const plumbLabel = svg("text", { class: "ink-plumb-label" }, ambientGroup);
    const loopHalo = svg("path", { class: "ink-halo" }, ambientGroup);
    const loopPath = svg("path", { class: "ink-loop", "marker-end": "url(#ss-arrow-learns)" }, ambientGroup);
    const loopLabel = svg("text", { class: "ink-loop-label" }, ambientGroup);
    const leaders = new Map<LayerId, SVGPathElement>();
    for (const layer of layers) {
      const path = svg("path", { class: "ink-leader", stroke: layer.color }, leaderGroup);
      leaders.set(layer.id, path);
    }
    const relationLeaders: Record<ConnectionId, SVGPathElement> = {
      trust: svg("path", { class: "ink-leader", stroke: TRUST_COLOR }, leaderGroup),
      rules: svg("path", { class: "ink-leader", stroke: TONES.rules.color }, leaderGroup),
      exchange: svg("path", { class: "ink-leader", stroke: TONES.shares.color }, leaderGroup),
    };
    type ThreadView = {
      thread: Thread;
      halo: SVGPathElement;
      line: SVGPathElement;
      flow: SVGPathElement;
      text: SVGTextElement;
    };
    let threadViews: ThreadView[] = [];
    type TagView = {
      element: HTMLElement;
      anchor: THREE.Object3D;
      priority: number;
      /** Plate tags sit right of a plate corner and slide toward this point instead of dodging. */
      edge: THREE.Object3D | null;
      width: number;
      height: number;
    };
    let tagViews: TagView[] = [];
    let hoverView: TagView | null = null;

    const makeTag = (
      text: string,
      anchor: THREE.Object3D,
      className: string,
      options: { color?: string; detail?: string; priority?: number; edge?: THREE.Object3D } = {},
    ): TagView => {
      const element = document.createElement("div");
      element.className = className;
      if (options.color) element.style.setProperty("--tone", options.color);
      const title = document.createElement("span");
      title.className = "ink-tag-title";
      title.textContent = text;
      element.appendChild(title);
      if (options.detail) {
        const detail = document.createElement("span");
        detail.className = "ink-tag-detail";
        detail.textContent = options.detail;
        element.appendChild(detail);
      }
      labelLayer.appendChild(element);
      return {
        element,
        anchor,
        priority: options.priority ?? 5,
        edge: options.edge ?? null,
        width: 0,
        height: 0,
      };
    };

    const scenarioAnchor = new THREE.Object3D();
    scenarioAnchor.position.set(3.2, 1.25, 1.9);
    model.plates[2].add(scenarioAnchor);
    const siteAnchors: Record<"lot" | "center", Partial<Record<EntityId, THREE.Object3D>>> = {
      lot: {
        buildings: model.anchors.lot[1],
        proposal: model.anchors.lot[3],
        change: model.anchors.lot[4],
      },
      center: {
        buildings: model.anchors.center[1],
        change: model.anchors.center[4],
      },
    };
    const anchorOf = (id: EntityId) =>
      (plan.site && siteAnchors[plan.site][id]) || model.anchors.entity[id];

    const rebuildInk = () => {
      const { language } = propsRef.current;
      canvas.setAttribute("aria-label", ink.canvas[language]);
      host.setAttribute("aria-label", ink.stage[language]);
      for (const view of threadViews) {
        view.halo.remove();
        view.line.remove();
        view.flow.remove();
        view.text.remove();
      }
      labelLayer.replaceChildren();
      tagViews = [];
      hoverView = null;
      threadViews = plan.threads.map((thread) => {
        const tone = TONES[thread.tone];
        const halo = svg("path", { class: "ink-halo" }, threadGroup);
        const line = svg(
          "path",
          {
            class: "ink-thread",
            stroke: tone.color,
            "stroke-dasharray": tone.dash ?? "none",
            "marker-end": `url(#ss-arrow-${thread.tone})`,
          },
          threadGroup,
        );
        const flow = svg("path", { class: "ink-flow", stroke: tone.color }, threadGroup);
        const text = svg("text", { class: "ink-verb", fill: tone.color }, threadGroup);
        text.textContent = thread.verb;
        return { thread, halo, line, flow, text };
      });
      for (const layer of layers) {
        tagViews.push(
          makeTag(`0${layer.id}`, model.anchors.plateTag[layer.id], "plate-tag", {
            color: layer.color,
            detail: layer.short[language],
            priority: 8,
            edge: model.anchors.plateTagEnd[layer.id],
          }),
        );
      }
      // Small stages keep the relationship ink and drop names the card already lists.
      const compact = width < 560;
      const tagged = new Set(plan.tags.map((tag) => tag.entity));
      for (const external of ["neighbor", "higher"] as const)
        if (!tagged.has(external) && !(compact && plan.kind !== "overview"))
          tagViews.push(
            makeTag(entities[external].name[language], model.anchors.entity[external], "ink-tag ink-tag--quiet", {
              priority: 2,
            }),
          );
      for (const tag of plan.tags) {
        if (compact && plan.kind === "layer" && !plan.openAt) continue;
        const entity = entities[tag.entity];
        if (tag.trust) {
          const badge = makeTag("", anchorOf(tag.entity), "trust-badge", { priority: 4 });
          badge.element.innerHTML = SHIELD;
          tagViews.push(badge);
          continue;
        }
        tagViews.push(
          makeTag(
            entity.name[language],
            anchorOf(tag.entity),
            `ink-tag${tag.strong ? " ink-tag--strong" : ""}`,
            {
              color: KIND_COLORS[entity.kind],
              detail: tag.strong ? kinds[entity.kind].label[language] : undefined,
              priority: tag.strong ? 10 : 5,
            },
          ),
        );
      }
      for (const note of plan.notes) {
        tagViews.push(
          makeTag(
            evidenceLabels[note.evidence][language],
            note.anchor === "scenario"
              ? plan.site === "lot"
                ? model.anchors.lot[2]
                : scenarioAnchor
              : anchorOf(note.anchor),
            `ink-note ink-note--${note.evidence}`,
            { priority: 9 },
          ),
        );
      }
      trustLabel.textContent = ink.trust[language];
      plumbLabel.textContent = ink.sameSquare[language];
      loopLabel.textContent = ink.loop[language];
      for (const label of [trustLabel, plumbLabel, loopLabel]) delete label.dataset.width;
      inkLayer.classList.toggle("is-trust", plan.emphasis.trust);
      inkLayer.classList.toggle("is-plumb", plan.emphasis.plumb);
      inkLayer.classList.toggle("is-loop", plan.emphasis.loop);
      inkLayer.classList.toggle("has-threads", plan.threads.length > 0);
      dirty = true;
    };

    const textWidth = (element: SVGTextElement) =>
      Number((element.dataset.width ??= String(element.getComputedTextLength())));
    const screen = new THREE.Vector3();
    const toScreen = (object: THREE.Object3D) => {
      screen.setFromMatrixPosition(object.matrixWorld).project(camera);
      return { x: ((screen.x + 1) / 2) * width, y: ((1 - screen.y) / 2) * height };
    };
    const centroid = (end: End) => {
      const points = end
        .filter((id) => isShown(anchorOf(id).parent))
        .map((id) => toScreen(anchorOf(id)));
      if (!points.length) return null;
      return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      };
    };
    const stackCenterAnchor = new THREE.Object3D();
    stackCenterAnchor.position.set(0, plateY(2) + plateY(2) / 2, 0);
    model.root.add(stackCenterAnchor);
    const stackCenter = () => toScreen(stackCenterAnchor);

    const curve = (
      p: { x: number; y: number },
      q: { x: number; y: number },
      center: { x: number; y: number },
      bend = 0.3,
    ) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const length = Math.hypot(dx, dy) || 1;
      let nx = -dy / length;
      let ny = dx / length;
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      if ((mx - center.x) * nx + (my - center.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const offset = Math.min(Math.max(length * bend, 26), 130);
      const start = { x: p.x + (dx / length) * 10, y: p.y + (dy / length) * 10 };
      const end = { x: q.x - (dx / length) * 12, y: q.y - (dy / length) * 12 };
      const c1 = { x: start.x + dx * 0.2 + nx * offset, y: start.y + dy * 0.2 + ny * offset };
      const c2 = { x: end.x - dx * 0.2 + nx * offset, y: end.y - dy * 0.2 + ny * offset };
      const mid = {
        x: 0.125 * start.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * end.x,
        y: 0.125 * start.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * end.y,
      };
      return {
        d: `M${start.x.toFixed(1)},${start.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`,
        mid,
      };
    };

    const drawInk = () => {
      inkLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
      stageClip.setAttribute("width", String(width));
      stageClip.setAttribute("height", String(height));
      const center = stackCenter();
      const hostRect = host.getBoundingClientRect();
      const stage = host.closest("[data-stage]");
      // The view buttons sit on top of the stage, so a level tag beneath them would be cut off.
      const controls = [...(stage?.querySelectorAll("[data-stage-controls] > *") ?? [])].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x0: rect.left - hostRect.left - 4,
          y0: rect.top - hostRect.top - 4,
          x1: rect.right - hostRect.left + 4,
          y1: rect.bottom - hostRect.top + 4,
        };
      });
      // Leaders join the side columns to the model; stacked layouts have no side columns.
      for (const layer of layers) {
        const path = leaders.get(layer.id)!;
        const rect = stage?.querySelector<HTMLElement>(`[data-leader="${layer.id}"]`)?.getBoundingClientRect();
        const anchor = model.anchors.plateLeft[layer.id];
        const point = isShown(anchor.parent) ? toScreen(anchor) : null;
        const bx = rect ? rect.right - hostRect.left + 4 : 0;
        const by = rect ? rect.top + rect.height / 2 - hostRect.top : 0;
        if (!rect?.width || !point || rect.right > hostRect.left + 4 || by < 0 || by > height || point.x < bx + 24) {
          path.setAttribute("d", "");
          continue;
        }
        path.setAttribute("d", `M${bx},${by} H${bx + 14} L${point.x - 4},${point.y}`);
        path.classList.toggle("is-active", plan.activeLayer === layer.id);
      }

      const visiblePlates = layers.filter((layer) => isShown(model.plates[layer.id]));
      const squares = visiblePlates.map((layer) => toScreen(model.anchors.squareCenter[layer.id]));
      if (squares.length > 1) {
        const top = squares[squares.length - 1];
        const lift = Math.min(70, Math.max(top.y - 18, 0));
        plumb.setAttribute("d", `M${squares[0].x},${squares[0].y} L${top.x},${top.y - lift}`);
        plumbDots.replaceChildren();
        for (const point of squares) svg("circle", { cx: point.x, cy: point.y, r: 3.5 }, plumbDots);
        plumbLabel.setAttribute("x", String(Math.min(top.x + 8, width - textWidth(plumbLabel) - 8)));
        plumbLabel.setAttribute("y", String(top.y - lift + 4));
      } else {
        plumb.setAttribute("d", "");
        plumbDots.replaceChildren();
        plumbLabel.setAttribute("x", "-999");
      }

      const showLoop =
        !plan.openAt &&
        !plan.threads.some((thread) => thread.from.includes("evaluation") && thread.to.includes("openData"));
      if (showLoop) {
        const shape = curve(
          toScreen(model.anchors.entity.evaluation),
          toScreen(model.anchors.entity.openData),
          center,
          0.42,
        );
        loopHalo.setAttribute("d", shape.d);
        loopPath.setAttribute("d", shape.d);
        loopLabel.setAttribute("x", String(Math.min(shape.mid.x + 10, width - textWidth(loopLabel) - 8)));
        loopLabel.setAttribute("y", String(shape.mid.y + 4));
      } else {
        loopHalo.setAttribute("d", "");
        loopPath.setAttribute("d", "");
        loopLabel.setAttribute("x", "-999");
      }

      const wholeStack = !plan.openAt && (plan.kind === "overview" || plan.kind === "layer" || plan.emphasis.trust);
      let trustBounds: { x1: number; y0: number; y1: number } | null = null;
      if (wholeStack) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const corner = new THREE.Vector3();
        for (const layer of layers) {
          const plate = model.plates[layer.id];
          for (const x of [-PLATE_WIDTH / 2, PLATE_WIDTH / 2])
            for (const z of [-PLATE_DEPTH / 2, PLATE_DEPTH / 2])
              for (const y of [-PLATE_THICKNESS, layer.id === 4 ? 2.4 : 0]) {
                corner.set(x, y, z).applyMatrix4(plate.matrixWorld).project(camera);
                const sx = ((corner.x + 1) / 2) * width;
                const sy = ((1 - corner.y) / 2) * height;
                minX = Math.min(minX, sx);
                maxX = Math.max(maxX, sx);
                minY = Math.min(minY, sy);
                maxY = Math.max(maxY, sy);
              }
        }
        const pad = 18;
        const r = 18;
        const x0 = Math.max(minX - pad, 6);
        const y0 = Math.max(minY - pad, 30);
        const x1 = Math.min(maxX + pad, width - 6);
        const y1 = Math.min(maxY + pad, height - 6);
        const arm = 28;
        trustFrame.setAttribute(
          "d",
          plan.emphasis.trust
            ? `M${x0 + r},${y0} H${x1 - r} Q${x1},${y0} ${x1},${y0 + r} V${y1 - r} Q${x1},${y1} ${x1 - r},${y1} H${x0 + r} Q${x0},${y1} ${x0},${y1 - r} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} Z`
            : `M${x0},${y0 + arm} V${y0} H${x0 + arm} M${x1 - arm},${y0} H${x1} V${y0 + arm} M${x1},${y1 - arm} V${y1} H${x1 - arm} M${x0 + arm},${y1} H${x0} V${y1 - arm}`,
        );
        trustLabel.setAttribute("x", String(Math.max(Math.min(x1 - r, width - 8), textWidth(trustLabel) + 8)));
        trustLabel.setAttribute("y", String(y0 - 8));
        trustBounds = { x1, y0, y1 };
      } else {
        trustFrame.setAttribute("d", "");
        trustLabel.setAttribute("x", "-999");
      }

      const focus = propsRef.current.focus;
      for (const id of ["trust", "rules", "exchange"] as const) {
        const path = relationLeaders[id];
        const rect = stage?.querySelector<HTMLElement>(`[data-relation-leader="${id}"]`)?.getBoundingClientRect();
        const bx = rect ? rect.left - hostRect.left - 4 : 0;
        const by = rect ? rect.top + rect.height / 2 - hostRect.top : 0;
        let target: { x: number; y: number } | null = null;
        if (id === "trust") {
          if (trustBounds)
            target = {
              x: trustBounds.x1 + 3,
              y: THREE.MathUtils.clamp(by, trustBounds.y0 + 20, trustBounds.y1 - 20),
            };
        } else {
          // The rightmost visible parts of the comparable city or the parliament, not their
          // bounding box, which overshoots the stage when the model is framed tightly.
          let minY = Infinity;
          let maxY = -Infinity;
          let maxX = -Infinity;
          for (const mesh of model.owners.get(id === "rules" ? "higher" : "neighbor")?.meshes ?? []) {
            const { x, y } = toScreen(mesh);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
          if (maxX > 0 && maxY > 0 && minY < height)
            target = { x: Math.min(maxX + 10, width - 6), y: THREE.MathUtils.clamp((minY + maxY) / 2, 0, height) };
        }
        if (!rect?.width || !target || rect.left < hostRect.right - 4 || by < 0 || by > height || target.x > bx - 24) {
          path.setAttribute("d", "");
          continue;
        }
        path.setAttribute(
          "d",
          Math.abs(target.y - by) < 2 ? `M${bx},${by} H${target.x}` : `M${bx},${by} H${bx - 14} L${target.x},${target.y}`,
        );
        path.classList.toggle("is-active", focus.type === "connection" && focus.id === id);
      }

      type Box = { x0: number; y0: number; x1: number; y1: number };
      const placed: Box[] = [...controls];
      for (const [label, anchorEnd] of [
        [trustLabel, true],
        [plumbLabel, false],
        [loopLabel, false],
      ] as const) {
        const x = Number(label.getAttribute("x"));
        const y = Number(label.getAttribute("y"));
        if (x < 0) continue;
        const length = textWidth(label);
        const x0 = anchorEnd ? x - length : x;
        placed.push({ x0: x0 - 4, y0: y - 14, x1: x0 + length + 4, y1: y + 5 });
      }
      const free = (box: Box) =>
        box.x0 >= 2 &&
        box.x1 <= width - 2 &&
        box.y0 >= 2 &&
        box.y1 <= height - 2 &&
        !placed.some((other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0);
      const nudge = (box: Box, step: number) => {
        const across = (box.x1 - box.x0) * 0.6 + 6;
        for (const [sx, sy] of NUDGES) {
          const dx = sx * across;
          const dy = sy * step;
          if (free({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy })) return { dx, dy };
        }
        return null;
      };
      // Values of t for which start + t·step stays within [min, max].
      const within = (start: number, step: number, min: number, max: number): [number, number] => {
        if (Math.abs(step) < 1e-6) return start >= min && start <= max ? [-Infinity, Infinity] : [Infinity, -Infinity];
        const a = (min - start) / step;
        const b = (max - start) / step;
        return step > 0 ? [a, b] : [b, a];
      };
      // A plate tag rides along its plate's front edge to the first spot where it shows whole,
      // so zooming in never cuts a level name; with no such spot it hides like a minor label.
      const slide = (box: Box, from: { x: number; y: number }, to: { x: number; y: number }) => {
        const ax = to.x - from.x;
        const ay = to.y - from.y;
        const w = box.x1 - box.x0;
        const h = box.y1 - box.y0;
        const [x0, x1] = within(box.x0, ax, 2, width - 2 - w);
        const [y0, y1] = within(box.y0, ay, 2, height - 2 - h);
        // The tag stays on its edge, at most at the far corner.
        const last = Math.min(1, x1, y1);
        const blocked = controls.map((control) => {
          const [cx0, cx1] = within(box.x0, ax, control.x0 - w, control.x1);
          const [cy0, cy1] = within(box.y0, ay, control.y0 - h, control.y1);
          return [Math.max(cx0, cy0), Math.min(cx1, cy1)] as const;
        });
        let t = Math.max(0, x0, y0);
        for (let moved = true; moved; ) {
          moved = false;
          for (const [enter, leave] of blocked)
            if (t > enter && t < leave) {
              t = leave;
              moved = true;
            }
        }
        return t <= last ? { dx: ax * t, dy: ay * t } : null;
      };

      const mids: ({ x: number; y: number } | null)[] = [];
      for (const view of threadViews) {
        const p = centroid(view.thread.from);
        const q = centroid(view.thread.to);
        if (!p && !q) {
          for (const element of [view.halo, view.line, view.flow]) element.setAttribute("d", "");
          view.text.setAttribute("x", "-999");
          mids.push(null);
          continue;
        }
        let start = p;
        let end = q;
        if (!start || !end) {
          const known = (start ?? end)!;
          const hiddenEnd = start ? view.thread.to : view.thread.from;
          const toward = toScreen(anchorOf(hiddenEnd[0]));
          const dx = toward.x - known.x;
          const dy = toward.y - known.y;
          const length = Math.hypot(dx, dy) || 1;
          const stub = { x: known.x + (dx / length) * 110, y: known.y + (dy / length) * 110 };
          if (start) end = stub;
          else start = stub;
        }
        const shape = curve(start!, end!, center, view.thread.from.length > 1 || view.thread.to.length > 1 ? 0.22 : 0.3);
        view.halo.setAttribute("d", shape.d);
        view.line.setAttribute("d", shape.d);
        view.flow.setAttribute("d", shape.d);
        mids.push(shape.mid);
      }

      const views = [...tagViews, ...(hoverView ? [hoverView] : [])];
      for (const view of views)
        if (!view.width) {
          view.width = view.element.offsetWidth;
          view.height = view.element.offsetHeight;
        }
      for (const view of [...views].sort((a, b) => b.priority - a.priority)) {
        const point = isShown(view.anchor.parent) ? toScreen(view.anchor) : null;
        if (!point) {
          view.element.style.visibility = "hidden";
          continue;
        }
        const left = view.edge ? point.x + 4 : point.x - view.width / 2;
        const top = view.edge ? point.y + 8 : point.y - view.height - 10;
        const box = { x0: left, y0: top, x1: left + view.width, y1: top + view.height };
        const found = view.edge ? slide(box, point, toScreen(view.edge)) : nudge(box, view.height + 4);
        // A minor label with no free spot stays hidden; the card still lists it.
        if (!found && view.priority < 9) {
          view.element.style.visibility = "hidden";
          continue;
        }
        // Key labels stay even when crowded, but never past the stage edge.
        const { dx, dy } = found ?? {
          dx: THREE.MathUtils.clamp(0, 2 - box.x0, width - 2 - box.x1),
          dy: THREE.MathUtils.clamp(0, 2 - box.y0, height - 2 - box.y1),
        };
        placed.push({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy });
        view.element.style.visibility = "visible";
        view.element.style.transform = `translate(${(point.x + dx).toFixed(1)}px, ${(point.y + dy).toFixed(1)}px)`;
      }

      threadViews.forEach((view, index) => {
        const mid = mids[index];
        if (!mid) return;
        const half = textWidth(view.text) / 2 + 4;
        const x = THREE.MathUtils.clamp(mid.x, half + 2, width - half - 2);
        const box = { x0: x - half, y0: mid.y - 10, x1: x + half, y1: mid.y + 8 };
        const { dx, dy } = nudge(box, 18) ?? { dx: 0, dy: 0 };
        placed.push({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy });
        view.text.setAttribute("x", (x + dx).toFixed(1));
        view.text.setAttribute("y", (mid.y + 4 + dy).toFixed(1));
      });
    };

    /* ---------------- sizing ---------------- */
    const resize = () => {
      width = canvasHost.clientWidth;
      height = canvasHost.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      layoutKey = "";
      dirty = true;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasHost);
    resize();
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) dirty = true;
    });
    visibilityObserver.observe(host);
    document.fonts?.ready.then(() => {
      dirty = true;
    });

    /* ---------------- pointer & keyboard ---------------- */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickAt = (clientX: number, clientY: number): Owner | null => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(model.pickables, false);
      for (const hit of hits) {
        if (!isShown(hit.object)) continue;
        const owner = hit.object.userData.owner as Owner | undefined;
        if (owner) return owner;
      }
      return null;
    };
    const ownerTarget = (owner: Owner): PickTarget =>
      owner.startsWith("plate-") ? { layer: Number(owner.slice(6)) as LayerId } : { entity: owner as EntityId };

    let drag: { id: number; x: number; y: number; startX: number; startY: number; touch: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        touch: event.pointerType !== "mouse",
      };
      if (!drag.touch) canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
        goal.azimuth = THREE.MathUtils.clamp(goal.azimuth - dx * 0.0065, ...LIMITS.azimuth);
        if (!drag.touch)
          goal.elevation = THREE.MathUtils.clamp(goal.elevation + dy * 0.004, ...LIMITS.elevation);
        rig.azimuth = goal.azimuth;
        rig.elevation = goal.elevation;
        applyCamera();
        dirty = true;
        canvas.classList.add("is-dragging");
        return;
      }
      if (event.pointerType === "mouse") pendingHover = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.touch && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      canvas.classList.remove("is-dragging");
      if (moved > 6) return;
      const owner = pickAt(event.clientX, event.clientY);
      if (owner) propsRef.current.onPick(ownerTarget(owner));
    };
    const onPointerCancel = () => {
      drag = null;
      canvas.classList.remove("is-dragging");
    };
    const onPointerLeave = () => {
      pendingHover = null;
      if (hovered) {
        hovered = null;
        hoverView?.element.remove();
        hoverView = null;
        canvas.style.cursor = "";
        dirty = true;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== host) return;
      const step = { ArrowLeft: [-0.18, 0], ArrowRight: [0.18, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[
        event.key
      ];
      if (!step) return;
      event.preventDefault();
      goal.azimuth = THREE.MathUtils.clamp(goal.azimuth + step[0], ...LIMITS.azimuth);
      goal.elevation = THREE.MathUtils.clamp(goal.elevation + step[1], ...LIMITS.elevation);
      dirty = true;
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      host.dataset.fallback = "true";
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("webglcontextlost", onContextLost);
    host.addEventListener("keydown", onKeyDown);
    // Side columns scroll past the sticky stage, so their leaders follow the page.
    const onScroll = () => {
      inkDirty = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---------------- frame loop ---------------- */
    const ease = (rate: number, dt: number) => (reduced ? 1 : 1 - Math.exp(-dt * rate));

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);
      if (!visible || document.hidden || !width || !height) {
        lastTime = now;
        return;
      }
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const current = propsRef.current;

      const nextPlanKey = JSON.stringify([
        current.language,
        current.focus,
        current.story,
        current.closeUp,
        width < 560,
      ]);
      if (nextPlanKey !== planKey) {
        planKey = nextPlanKey;
        plan = makePlan(current);
        for (const owner of model.owners.values()) {
          const layerOf = ownerLayer(owner.id);
          const hiddenAbove = plan.openAt !== null && layerOf !== null && layerOf > plan.openAt;
          dimGoal.set(owner.id, hiddenAbove ? 1 : plan.dim(owner.id));
        }
        for (const layer of layers)
          plateOffset[layer.id].goal = plan.openAt !== null && layer.id > plan.openAt ? 16 : 0;
        cueGoal = cueNumbers(plan.cue);
        rebuildInk();
      }
      const nextViewKey = JSON.stringify([current.focus, current.story, current.closeUp, current.resetKey]);
      const nextLayoutKey = `${width}x${height}`;
      if (nextViewKey !== viewKey || nextLayoutKey !== layoutKey) {
        const first = !viewKey;
        const layoutOnly = nextViewKey === viewKey;
        viewKey = nextViewKey;
        layoutKey = nextLayoutKey;
        setView(first || layoutOnly);
      }
      if (current.turn.nonce !== turnNonce) {
        turnNonce = current.turn.nonce;
        goal.azimuth = THREE.MathUtils.clamp(goal.azimuth + current.turn.direction * 0.3, ...LIMITS.azimuth);
      }

      let moving = false;
      const cameraEase = ease(5.5, dt);
      const rigBefore = [rig.azimuth, rig.elevation, rig.span, rig.ox, rig.oy, rig.target.x, rig.target.y, rig.target.z];
      rig.target.lerp(goal.target, cameraEase);
      rig.azimuth += (goal.azimuth - rig.azimuth) * cameraEase;
      rig.elevation += (goal.elevation - rig.elevation) * cameraEase;
      rig.span += (goal.span - rig.span) * cameraEase;
      rig.ox += (goal.ox - rig.ox) * cameraEase;
      rig.oy += (goal.oy - rig.oy) * cameraEase;
      const rigAfter = [rig.azimuth, rig.elevation, rig.span, rig.ox, rig.oy, rig.target.x, rig.target.y, rig.target.z];
      if (rigAfter.some((value, index) => Math.abs(value - rigBefore[index]) > 1e-4)) {
        moving = true;
        applyCamera();
      }

      const plateEase = ease(4.5, dt);
      for (const layer of layers) {
        const offset = plateOffset[layer.id];
        if (Math.abs(offset.goal - offset.current) > 0.002) {
          offset.current += (offset.goal - offset.current) * plateEase;
          moving = true;
        } else offset.current = offset.goal;
        const plate = model.plates[layer.id];
        plate.position.y = plateY(layer.id) + offset.current;
        plate.visible = offset.current < 11;
      }

      const dimEase = ease(8, dt);
      for (const owner of model.owners.values()) {
        const target = dimGoal.get(owner.id) ?? 0;
        if (Math.abs(owner.dim - target) > 0.003) {
          model.setDim(owner, owner.dim + (target - owner.dim) * dimEase);
          moving = true;
        } else if (owner.dim !== target) {
          model.setDim(owner, target);
          moving = true;
        }
      }

      const cueEase = ease(2.4, dt);
      let cueChanged = false;
      for (const name of Object.keys(cueGoal) as (keyof CueState)[]) {
        const delta = cueGoal[name] - cueCurrent[name];
        if (Math.abs(delta) > 0.002) {
          cueCurrent[name] += delta * cueEase;
          cueChanged = true;
        } else if (delta !== 0) {
          cueCurrent[name] = cueGoal[name];
          cueChanged = true;
        }
      }
      const pulsing = !reduced && (cueCurrent.radio > 0.02 || cueCurrent.warning > 0.02);
      if (cueChanged || pulsing) {
        model.applyCues(cueCurrent, pulsing ? now / 1000 : 0);
        moving = true;
      }

      if (pendingHover && !drag) {
        const owner = pickAt(pendingHover.x, pendingHover.y);
        pendingHover = null;
        if (owner !== hovered) {
          hovered = owner;
          hoverView?.element.remove();
          hoverView = null;
          canvas.style.cursor = owner ? "pointer" : "";
          const tagged = plan.tags.some((tag) => tag.entity === owner);
          if (owner && !owner.startsWith("plate-") && !tagged) {
            const entity = entities[owner as EntityId];
            hoverView = makeTag(
              entity.name[current.language],
              model.anchors.entity[owner as EntityId],
              "ink-tag ink-tag--hover",
              { color: KIND_COLORS[entity.kind], priority: 11 },
            );
          }
          dirty = true;
        }
      }

      if (moving || dirty) {
        model.root.updateMatrixWorld(true);
        renderer.render(scene, camera);
        drawInk();
        dirty = false;
        inkDirty = false;
      } else if (inkDirty) {
        drawInk();
        inkDirty = false;
      }
    };
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      reduceMotion.removeEventListener("change", onMotion);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      host.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      model.dispose();
      renderer.dispose();
      canvas.remove();
      inkLayer.replaceChildren();
      labelLayer.replaceChildren();
    };
  }, []);

  const { language } = props;
  return (
    <div className="scene" ref={hostRef} tabIndex={0} data-scene>
      <div className="scene-canvas" ref={canvasHostRef} />
      <svg className="scene-ink" ref={inkRef} aria-hidden="true" />
      <div className="scene-labels" ref={labelsRef} aria-hidden="true" />
      <div className="scene-fallback">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stadtstack-overview.png" alt={ink.fallbackAlt[language]} />
        <p>{ink.fallback[language]}</p>
      </div>
    </div>
  );
}
