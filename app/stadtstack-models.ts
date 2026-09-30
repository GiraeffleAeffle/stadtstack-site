import * as THREE from "three";
import {
  layers,
  type EntityId,
  type LayerId,
  type SceneCue,
} from "./stadtstack-content";

/** Everything selectable or dimmable belongs to an entity or to one plate's backdrop. */
export type Owner = EntityId | `plate-${LayerId}`;
export type CueState = Record<keyof SceneCue, number>;

export type OwnerModel = {
  id: Owner;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  dim: number;
};

export type CityModel = {
  root: THREE.Group;
  plates: Record<LayerId, THREE.Group>;
  neighbor: THREE.Group;
  higher: THREE.Group;
  owners: Map<Owner, OwnerModel>;
  pickables: THREE.Object3D[];
  anchors: {
    entity: Record<EntityId, THREE.Object3D>;
    plateLeft: Record<LayerId, THREE.Object3D>;
    plateTag: Record<LayerId, THREE.Object3D>;
    /** Far end of the front edge a plate tag sits on; the tag slides toward it to stay in view. */
    plateTagEnd: Record<LayerId, THREE.Object3D>;
    squareCenter: Record<LayerId, THREE.Object3D>;
    /** The vacant lot and the community center on each plate, for stories set there. */
    lot: Record<LayerId, THREE.Object3D>;
    center: Record<LayerId, THREE.Object3D>;
  };
  setDim(owner: OwnerModel, value: number): void;
  applyCues(state: CueState, time: number): void;
  dispose(): void;
};

export const PLATE_WIDTH = 12;
export const PLATE_DEPTH = 7.6;
export const PLATE_THICKNESS = 0.42;
const PLATE_GAP = 4.9;
const PAPER = "#f3f4ef";

const INK = "#15263b";
const GROUND: Record<LayerId, string> = {
  1: "#b3cc92",
  2: "#dbeef1",
  3: "#f3e8d0",
  4: "#bcd99b",
};
const STREET = "#e4ded2";
const WALL = "#f6f1e7";
const WALL_WARM = "#f2dfc2";
const ROOF = "#c65a41";
const SLATE = "#50627a";
const WINDOW = "#2d4a6c";
const LEAF = ["#4f9a3e", "#5fa843", "#3f8a3a", "#76b24c"];
const TRUNK = "#7a5a3d";
const METAL = "#94a1b0";
const DARK = "#26374c";
const TEAL = "#1b98b1";
const AMBER = "#e19a12";
const CORAL = "#df5536";
const YELLOW = "#f3c33b";
const WHITE = "#fbfbf8";
const CARD = "#fbf8f0";
const SKIN = ["#f0cfb0", "#d6a37b", "#a86f4c", "#6f4731"];
const CLOTH = [
  "#2f6fb2",
  "#df5536",
  "#e19a12",
  "#4f9a3e",
  "#7a4dc2",
  "#1b98b1",
  "#34495e",
  "#c2476b",
];
const PAPER_COLOR = new THREE.Color(PAPER);

/** Shared footprints: every plate shows the same city block. */
const SITE = {
  street: { z: -0.55, depth: 0.9 },
  lane: { x: -0.3, width: 0.9 },
  hall: { x: 1.85, z: -2.4, w: 2.9, d: 1.75, h: 1.05 },
  tower: { x: 3.66, z: -2.25, w: 0.66, d: 0.66, h: 2.05 },
  houses: [
    { x: -5.25, z: -2.45, w: 1.0, d: 1.5, h: 0.72 },
    { x: -4.0, z: -2.4, w: 1.15, d: 1.6, h: 0.86 },
    { x: -2.7, z: -2.45, w: 1.05, d: 1.5, h: 0.78 },
  ],
  lot: { x: 5.05, z: -2.4, w: 1.6, d: 1.75 },
  center: { x: -3.65, z: 1.35, w: 3.4, d: 1.8, h: 0.8 },
  annex: { x: -5.1, z: 3.0, w: 1.0, d: 0.75, h: 0.62 },
  battery: { x: -3.3, z: 3.05 },
  mast: { x: -1.55, z: 3.05 },
  square: { x: 3.1, z: 1.9, w: 5.2, d: 3.3 },
};

type MatOptions = {
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  flat?: boolean;
  map?: THREE.Texture;
  side?: THREE.Side;
  fade?: boolean;
  /** Skip the per-owner cache so the material can change on its own. */
  unique?: boolean;
};
type Vec = [number, number, number];

class Kit {
  owner: Owner = "plate-1";
  owners = new Map<Owner, OwnerModel>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materialCache = new Map<string, THREE.Material>();
  private edgeCache = new Map<string, THREE.EdgesGeometry>();
  extraGeometries = new Set<THREE.BufferGeometry>();
  textures = new Set<THREE.Texture>();
  pickables: THREE.Object3D[] = [];
  shadowTexture = softTexture(false);
  squareShadowTexture = softTexture(true);

  constructor() {
    this.textures.add(this.shadowTexture);
    this.textures.add(this.squareShadowTexture);
  }

  model(owner: Owner = this.owner) {
    let model = this.owners.get(owner);
    if (!model) {
      model = { id: owner, meshes: [], materials: [], dim: 0 };
      this.owners.set(owner, model);
    }
    return model;
  }

  use<T>(owner: Owner, build: () => T) {
    const previous = this.owner;
    this.owner = owner;
    const result = build();
    this.owner = previous;
    return result;
  }

  geometry(key: string, create: () => THREE.BufferGeometry) {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = create();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  register<T extends THREE.Material>(material: T, fade = false) {
    const model = this.model();
    material.userData.fade = fade;
    material.userData.baseOpacity = material.opacity;
    if ("color" in material && material.color instanceof THREE.Color)
      material.userData.base = material.color.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.userData.baseEmissive = material.emissiveIntensity;
      material.userData.baseEmissiveColor = material.emissive.clone();
    }
    model.materials.push(material);
    return material;
  }

  standard(color: THREE.ColorRepresentation, options: MatOptions = {}) {
    const key = `${this.owner}|s|${new THREE.Color(color).getHexString()}|${JSON.stringify({
      ...options,
      map: options.map?.uuid,
    })}`;
    const cached = options.unique ? undefined : this.materialCache.get(key);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const opacity = options.opacity ?? 1;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: options.emissive ?? "#000000",
      emissiveIntensity: options.emissiveIntensity ?? 0,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0.02,
      flatShading: options.flat ?? false,
      transparent: opacity < 1 || !!options.fade,
      opacity,
      map: options.map ?? null,
      side: options.side ?? THREE.FrontSide,
      depthWrite: opacity >= 1,
    });
    if (!options.unique) this.materialCache.set(key, material);
    return this.register(material, options.fade || opacity < 1);
  }

  lineMaterial(color: THREE.ColorRepresentation, opacity: number, dashed = false) {
    const key = `${this.owner}|l|${new THREE.Color(color).getHexString()}|${opacity}|${dashed}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached as THREE.LineBasicMaterial;
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.12,
          gapSize: 0.08,
          depthWrite: false,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.materialCache.set(key, material);
    return this.register(material, true);
  }

  mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    position: Vec,
    rotation: Vec = [0, 0, 0],
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.userData.owner = this.owner;
    parent.add(mesh);
    this.model().meshes.push(mesh);
    this.pickables.push(mesh);
    return mesh;
  }

  /** Box resting on `y`. */
  box(
    parent: THREE.Object3D,
    [w, h, d]: Vec,
    [x, y, z]: Vec,
    color: THREE.ColorRepresentation,
    options: MatOptions & { edges?: string; edgeOpacity?: number; rotY?: number } = {},
  ) {
    const geometry = this.geometry(`box${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    const mesh = this.mesh(parent, geometry, this.standard(color, options), [x, y + h / 2, z], [
      0,
      options.rotY ?? 0,
      0,
    ]);
    if (options.edges) this.edges(mesh, options.edges, options.edgeOpacity ?? 0.34);
    return mesh;
  }

  cylinder(
    parent: THREE.Object3D,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    [x, y, z]: Vec,
    color: THREE.ColorRepresentation,
    segments = 12,
    options: MatOptions = {},
  ) {
    const geometry = this.geometry(
      `cyl${radiusTop}:${radiusBottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    );
    return this.mesh(parent, geometry, this.standard(color, options), [x, y + height / 2, z]);
  }

  ball(
    parent: THREE.Object3D,
    radius: number,
    position: Vec,
    color: THREE.ColorRepresentation,
    detail = 1,
    options: MatOptions = {},
  ) {
    const geometry = this.geometry(
      `ball${radius}:${detail}`,
      () => new THREE.IcosahedronGeometry(radius, detail),
    );
    return this.mesh(parent, geometry, this.standard(color, options), position);
  }

  /** Gable roof: a triangular prism resting on `y`, ridge along z. */
  gable(
    parent: THREE.Object3D,
    [w, h, d]: Vec,
    [x, y, z]: Vec,
    color: THREE.ColorRepresentation,
    options: MatOptions & { edges?: string; rotY?: number } = {},
  ) {
    const geometry = this.geometry(`gable${w}:${h}:${d}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(0, h);
      shape.closePath();
      const extruded = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
      extruded.translate(0, 0, -d / 2);
      return extruded;
    });
    const mesh = this.mesh(parent, geometry, this.standard(color, { ...options, flat: true }), [
      x,
      y,
      z,
    ]);
    mesh.rotation.y = options.rotY ?? 0;
    if (options.edges) this.edges(mesh, options.edges, 0.34);
    return mesh;
  }

  /** Four-sided roof stretched over a rectangle. */
  hip(
    parent: THREE.Object3D,
    [w, h, d]: Vec,
    [x, y, z]: Vec,
    color: THREE.ColorRepresentation,
    edges?: string,
  ) {
    const geometry = this.geometry("hip", () => {
      const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
      cone.rotateY(Math.PI / 4);
      cone.translate(0, 0.5, 0);
      return cone;
    });
    const mesh = this.mesh(parent, geometry, this.standard(color, { flat: true }), [x, y, z]);
    mesh.scale.set(w, h, d);
    if (edges) this.edges(mesh, edges, 0.3);
    return mesh;
  }

  edges(mesh: THREE.Mesh, color: string, opacity: number, dashed = false) {
    const key = `${mesh.geometry.uuid}`;
    let geometry = this.edgeCache.get(key);
    if (!geometry) {
      geometry = new THREE.EdgesGeometry(mesh.geometry, 28);
      this.edgeCache.set(key, geometry);
    }
    const lines = new THREE.LineSegments(geometry, this.lineMaterial(color, opacity, dashed));
    if (dashed) lines.computeLineDistances();
    lines.raycast = () => {};
    mesh.add(lines);
    return lines;
  }

  shadow(parent: THREE.Object3D, [x, y, z]: Vec, w: number, d: number, opacity = 0.2, square = false) {
    const geometry = this.geometry("shadowPlane", () => {
      const plane = new THREE.PlaneGeometry(1, 1);
      plane.rotateX(-Math.PI / 2);
      return plane;
    });
    const key = `${this.owner}|shadow|${square}|${opacity}`;
    let material = this.materialCache.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!material) {
      material = this.register(
        new THREE.MeshBasicMaterial({
          color: "#1d2a33",
          map: square ? this.squareShadowTexture : this.shadowTexture,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
        true,
      );
      this.materialCache.set(key, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y + 0.03, z);
    mesh.scale.set(w, 1, d);
    mesh.renderOrder = 1;
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  }

  group(parent: THREE.Object3D, [x, y, z]: Vec, rotY = 0, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    group.scale.setScalar(scale);
    parent.add(group);
    return group;
  }

  anchor(parent: THREE.Object3D, position: Vec) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...position);
    parent.add(anchor);
    return anchor;
  }
}

function softTexture(square: boolean) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d")!;
  if (square) {
    pen.filter = "blur(10px)";
    pen.fillStyle = "rgba(0,0,0,0.9)";
    pen.fillRect(22, 22, size - 44, size - 44);
  } else {
    const gradient = pen.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0.85)");
    gradient.addColorStop(0.55, "rgba(0,0,0,0.35)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    pen.fillStyle = gradient;
    pen.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function patternTexture(
  kit: Kit,
  width: number,
  height: number,
  draw: (pen: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  kit.textures.add(texture);
  return texture;
}

/* ------------------------------------------------------------------ */
/* Small civic objects                                                  */
/* ------------------------------------------------------------------ */

function tree(kit: Kit, parent: THREE.Object3D, x: number, z: number, scale = 1, tone = 0) {
  const group = kit.group(parent, [x, 0, z], (x * 7 + z * 3) % Math.PI, scale);
  kit.cylinder(group, 0.045, 0.06, 0.34, [0, 0, 0], TRUNK, 6);
  kit.ball(group, 0.34, [0, 0.62, 0], LEAF[tone % LEAF.length], 0, { flat: true });
  kit.ball(group, 0.24, [0.14, 0.82, -0.06], LEAF[(tone + 1) % LEAF.length], 0, { flat: true });
  kit.shadow(group, [0, 0, 0], 0.9, 0.9, 0.22);
  return group;
}

function person(
  kit: Kit,
  parent: THREE.Object3D,
  x: number,
  z: number,
  seed: number,
  rotY = 0,
  scale = 1,
  cloth?: string,
) {
  const group = kit.group(parent, [x, 0, z], rotY, scale);
  for (const side of [-0.045, 0.045])
    kit.cylinder(group, 0.032, 0.03, 0.2, [side, 0, 0], DARK, 6);
  const body = kit.geometry("body", () => new THREE.CapsuleGeometry(0.085, 0.16, 3, 8));
  kit.mesh(group, body, kit.standard(cloth ?? CLOTH[seed % CLOTH.length]), [0, 0.33, 0]);
  kit.ball(group, 0.07, [0, 0.54, 0], SKIN[seed % SKIN.length], 1);
  kit.ball(group, 0.072, [0, 0.575, -0.012], seed % 3 ? "#3b2a22" : "#d8c1a0", 1).scale.set(
    1,
    0.6,
    1,
  );
  kit.shadow(group, [0, 0, 0], 0.3, 0.3, 0.22);
  return group;
}

function bench(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY = 0) {
  const group = kit.group(parent, [x, 0, z], rotY);
  kit.box(group, [0.62, 0.05, 0.2], [0, 0.14, 0], "#9a7651");
  kit.box(group, [0.62, 0.14, 0.04], [0, 0.19, -0.09], "#9a7651");
  for (const side of [-0.25, 0.25]) kit.box(group, [0.04, 0.14, 0.18], [side, 0, 0], DARK);
  return group;
}

function lamp(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  kit.cylinder(parent, 0.018, 0.024, 0.78, [x, 0, z], DARK, 6);
  kit.ball(parent, 0.055, [x, 0.8, z], "#fff1c9", 1, {
    emissive: "#ffd98a",
    emissiveIntensity: 0.6,
  });
}

function windowsBand(
  kit: Kit,
  parent: THREE.Object3D,
  width: number,
  y: number,
  z: number,
  count: number,
  size = 0.16,
) {
  for (let i = 0; i < count; i += 1) {
    const x = -width / 2 + ((i + 0.5) * width) / count;
    kit.box(parent, [size, size * 1.15, 0.02], [x, y, z], WINDOW, { roughness: 0.4 });
  }
}

function house(
  kit: Kit,
  parent: THREE.Object3D,
  spec: { x: number; z: number; w: number; d: number; h: number },
  index: number,
  style: "real" | "glass" | "card",
) {
  const group = kit.group(parent, [spec.x, 0, spec.z]);
  const roofHeight = spec.w * 0.42;
  if (style === "glass") {
    glassVolume(kit, group, [spec.w, spec.h, spec.d], [0, 0, 0]);
    glassVolume(kit, group, [spec.w, roofHeight, spec.d], [0, spec.h, 0], true);
    return group;
  }
  const wall = style === "card" ? CARD : index % 2 ? WALL_WARM : WALL;
  const edge = style === "card" ? "#8b98a6" : INK;
  kit.box(group, [spec.w, spec.h, spec.d], [0, 0, 0], wall, { edges: edge, edgeOpacity: 0.28 });
  kit.gable(group, [spec.w + 0.12, roofHeight, spec.d + 0.12], [0, spec.h, 0], style === "card" ? CARD : ROOF, {
    edges: edge,
  });
  if (style === "real") {
    windowsBand(kit, group, spec.w * 0.8, spec.h * 0.55, spec.d / 2 + 0.005, 2);
    kit.box(group, [0.18, 0.32, 0.02], [0, 0, spec.d / 2 + 0.006], DARK);
  }
  kit.shadow(parent, [spec.x, 0, spec.z], spec.w + 0.5, spec.d + 0.5, 0.18, true);
  return group;
}

function glassVolume(
  kit: Kit,
  parent: THREE.Object3D,
  [w, h, d]: Vec,
  [x, y, z]: Vec,
  roof = false,
) {
  const geometry = roof
    ? kit.geometry(`gable${w}:${h}:${d}`, () => {
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, 0);
        shape.lineTo(w / 2, 0);
        shape.lineTo(0, h);
        shape.closePath();
        const extruded = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
        extruded.translate(0, 0, -d / 2);
        return extruded;
      })
    : kit.geometry(`box${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  const mesh = kit.mesh(
    parent,
    geometry,
    kit.standard("#bfe6ee", { opacity: 0.26, roughness: 0.2 }),
    [x, roof ? y : y + h / 2, z],
  );
  mesh.renderOrder = 2;
  kit.edges(mesh, "#127f96", 0.75);
  return mesh;
}

function townHall(kit: Kit, parent: THREE.Object3D, style: "real" | "glass" | "card" | "chamber") {
  const { hall, tower } = SITE;
  const group = kit.group(parent, [hall.x, 0, hall.z]);
  const towerGroup = kit.group(parent, [tower.x, 0, tower.z]);
  if (style === "glass") {
    glassVolume(kit, group, [hall.w, hall.h, hall.d], [0, 0, 0]);
    glassVolume(kit, towerGroup, [tower.w, tower.h, tower.d], [0, 0, 0]);
    return group;
  }
  const card = style === "card" || style === "chamber";
  const wall = card ? CARD : WALL;
  const edge = card ? "#8b98a6" : INK;
  if (style === "chamber") {
    const wallHeight = 0.34;
    kit.box(group, [hall.w, 0.04, hall.d], [0, 0, 0], "#efe6d2");
    kit.box(group, [hall.w, wallHeight, 0.07], [0, 0, -hall.d / 2 + 0.035], wall, { edges: edge });
    kit.box(group, [0.07, wallHeight, hall.d], [-hall.w / 2 + 0.035, 0, 0], wall, { edges: edge });
    kit.box(group, [0.07, wallHeight, hall.d], [hall.w / 2 - 0.035, 0, 0], wall, { edges: edge });
    kit.box(group, [hall.w * 0.36, wallHeight, 0.07], [-hall.w * 0.32, 0, hall.d / 2 - 0.035], wall, {
      edges: edge,
    });
    kit.box(group, [hall.w * 0.36, wallHeight, 0.07], [hall.w * 0.32, 0, hall.d / 2 - 0.035], wall, {
      edges: edge,
    });
  } else {
    kit.box(group, [hall.w, 0.1, hall.d + 0.1], [0, 0, 0], card ? CARD : "#d9d2c3");
    kit.box(group, [hall.w - 0.1, hall.h, hall.d - 0.1], [0, 0.1, 0], wall, {
      edges: edge,
      edgeOpacity: 0.3,
    });
    kit.hip(group, [hall.w + 0.05, 0.5, hall.d + 0.05], [0, hall.h + 0.1, 0], card ? CARD : SLATE, edge);
    if (!card) {
      windowsBand(kit, group, hall.w * 0.86, 0.62, hall.d / 2 - 0.045, 6, 0.15);
      windowsBand(kit, group, hall.w * 0.86, 0.62, -hall.d / 2 + 0.045, 6, 0.15);
      for (const cx of [-0.42, -0.14, 0.14, 0.42])
        kit.cylinder(group, 0.045, 0.05, 0.62, [cx, 0.1, hall.d / 2 + 0.02], WHITE, 8);
      kit.box(group, [1.1, 0.06, 0.12], [0, 0.72, hall.d / 2 + 0.03], WHITE);
      kit.box(group, [0.26, 0.42, 0.02], [0, 0.1, hall.d / 2 - 0.04], DARK);
      for (let step = 0; step < 3; step += 1)
        kit.box(group, [1.2 - step * 0.12, 0.035, 0.12], [0, step * 0.035, hall.d / 2 + 0.12 - step * 0.05], "#cfc6b4");
    }
  }
  kit.box(towerGroup, [tower.w, tower.h, tower.d], [0, 0, 0], wall, { edges: edge, edgeOpacity: 0.3 });
  kit.hip(towerGroup, [tower.w + 0.08, 0.55, tower.d + 0.08], [0, tower.h, 0], card ? CARD : SLATE, edge);
  if (!card) {
    const clock = kit.cylinder(towerGroup, 0.19, 0.19, 0.03, [0, 0, 0], WHITE, 20);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(0, tower.h - 0.42, tower.d / 2 + 0.02);
    const hand = kit.box(towerGroup, [0.02, 0.12, 0.012], [0, tower.h - 0.42, tower.d / 2 + 0.04], DARK);
    hand.rotation.z = 0.7;
    const ring = kit.cylinder(towerGroup, 0.21, 0.21, 0.02, [0, 0, 0], DARK, 20);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, tower.h - 0.42, tower.d / 2 + 0.01);
  }
  kit.shadow(parent, [hall.x, 0, hall.z], hall.w + 0.6, hall.d + 0.6, 0.2, true);
  kit.shadow(parent, [tower.x, 0, tower.z], tower.w + 0.5, tower.d + 0.5, 0.22, true);
  return group;
}

function communityCenter(kit: Kit, parent: THREE.Object3D, style: "real" | "glass" | "card") {
  const { center } = SITE;
  const group = kit.group(parent, [center.x, 0, center.z]);
  if (style === "glass") {
    glassVolume(kit, group, [center.w, center.h, center.d], [0, 0, 0]);
    return group;
  }
  const card = style === "card";
  const edge = card ? "#8b98a6" : INK;
  kit.box(group, [center.w, center.h, center.d], [0, 0, 0], card ? CARD : WALL_WARM, {
    edges: edge,
    edgeOpacity: 0.3,
  });
  kit.box(group, [center.w + 0.08, 0.06, center.d + 0.08], [0, center.h, 0], card ? CARD : "#d8cfbd", {
    edges: edge,
    edgeOpacity: 0.3,
  });
  if (!card) {
    kit.box(group, [center.w * 0.72, 0.34, 0.02], [-0.25, 0.26, center.d / 2 + 0.006], "#9fd0dc", {
      roughness: 0.25,
      emissive: "#bfe8f0",
      emissiveIntensity: 0.12,
    });
    kit.box(group, [0.36, 0.5, 0.02], [center.w / 2 - 0.45, 0, center.d / 2 + 0.008], DARK);
    kit.box(group, [0.7, 0.04, 0.34], [center.w / 2 - 0.45, 0.58, center.d / 2 + 0.16], CORAL);
  }
  kit.shadow(parent, [center.x, 0, center.z], center.w + 0.6, center.d + 0.6, 0.18, true);
  return group;
}

function solarRoof(kit: Kit, parent: THREE.Object3D) {
  const { center } = SITE;
  const texture = patternTexture(kit, 64, 64, (pen) => {
    pen.fillStyle = "#1e4b86";
    pen.fillRect(0, 0, 64, 64);
    pen.strokeStyle = "#7fb2e0";
    pen.lineWidth = 2;
    for (let i = 0; i <= 64; i += 16) {
      pen.beginPath();
      pen.moveTo(i, 0);
      pen.lineTo(i, 64);
      pen.moveTo(0, i);
      pen.lineTo(64, i);
      pen.stroke();
    }
  });
  const group = kit.group(parent, [center.x, center.h + 0.06, center.z]);
  for (let row = 0; row < 4; row += 1) {
    const panel = kit.box(group, [center.w - 0.4, 0.04, 0.34], [0, 0.12, -0.6 + row * 0.42], "#ffffff", {
      map: texture,
      roughness: 0.35,
      metalness: 0.1,
    });
    panel.rotation.x = -0.42;
    kit.box(group, [0.04, 0.12, 0.04], [-center.w / 2 + 0.3, 0, -0.6 + row * 0.42 + 0.1], METAL);
    kit.box(group, [0.04, 0.12, 0.04], [center.w / 2 - 0.3, 0, -0.6 + row * 0.42 + 0.1], METAL);
  }
  return group;
}

function battery(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z], -0.05);
  kit.box(group, [1.0, 0.56, 0.52], [0, 0, 0], "#2f5a4a", { edges: INK, metalness: 0.15 });
  for (const side of [-0.33, 0, 0.33])
    kit.box(group, [0.02, 0.4, 0.02], [side, 0.08, 0.265], "#4b7a67");
  const bolt = kit.group(group, [0.17, 0.28, 0.27]);
  kit.box(bolt, [0.07, 0.2, 0.02], [0, -0.1, 0], YELLOW, {
    emissive: YELLOW,
    emissiveIntensity: 0.5,
    rotY: 0,
  }).rotation.z = -0.45;
  kit.shadow(group, [0, 0, 0], 1.3, 0.8, 0.22, true);
  return group;
}

function mast(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z]);
  const height = 2.0;
  for (let leg = 0; leg < 3; leg += 1) {
    const angle = (leg / 3) * Math.PI * 2;
    const foot = new THREE.Vector3(Math.cos(angle) * 0.28, 0, Math.sin(angle) * 0.28);
    const top = new THREE.Vector3(Math.cos(angle) * 0.05, height, Math.sin(angle) * 0.05);
    strut(kit, group, foot, top, 0.018, METAL);
  }
  for (const y of [0.55, 1.05, 1.5]) {
    const ring = kit.cylinder(group, 0.24 - y * 0.1, 0.24 - y * 0.1, 0.02, [0, y, 0], METAL, 3);
    ring.rotation.y = 0.3;
  }
  kit.box(group, [0.12, 0.34, 0.06], [0.1, height - 0.45, 0], WHITE, { edges: INK });
  kit.box(group, [0.12, 0.34, 0.06], [-0.1, height - 0.45, 0.02], WHITE, { edges: INK });
  kit.cylinder(group, 0.012, 0.012, 0.5, [0, height, 0], DARK, 6);
  kit.ball(group, 0.04, [0, height + 0.52, 0], CORAL, 1, { emissive: CORAL, emissiveIntensity: 0.6 });
  kit.shadow(group, [0, 0, 0], 0.9, 0.9, 0.22);
  const waves: THREE.Object3D[] = [];
  for (const radius of [0.36, 0.56, 0.78]) {
    const geometry = kit.geometry(`wave${radius}`, () => new THREE.TorusGeometry(radius, 0.022, 6, 36, Math.PI * 1.2));
    const wave = kit.mesh(group, geometry, kit.standard(TEAL, { emissive: TEAL, emissiveIntensity: 0.55, opacity: 0.9 }), [
      0,
      height - 0.25,
      0,
    ], [0, -0.55, -Math.PI * 0.1]);
    wave.userData.baseScale = 1;
    waves.push(wave);
  }
  return { group, waves };
}

function strut(
  kit: Kit,
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  color: string,
) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const geometry = kit.geometry(`strut${radius}:${length.toFixed(3)}`, () => new THREE.CylinderGeometry(radius, radius, length, 6));
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const mesh = kit.mesh(parent, geometry, kit.standard(color, { metalness: 0.2 }), [mid.x, mid.y, mid.z]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function serverPavilion(kit: Kit, parent: THREE.Object3D) {
  const { annex } = SITE;
  const group = kit.group(parent, [annex.x, 0, annex.z]);
  kit.box(group, [annex.w, 0.05, annex.d], [0, 0, 0], "#d8d2c4");
  for (const rx of [-0.22, 0.2]) {
    kit.box(group, [0.28, 0.5, 0.36], [rx, 0.05, -0.05], DARK, { metalness: 0.3, edges: INK });
    for (let slot = 0; slot < 4; slot += 1)
      kit.box(group, [0.2, 0.025, 0.01], [rx, 0.12 + slot * 0.1, 0.135], slot === 2 ? AMBER : "#5fd1e0", {
        emissive: slot === 2 ? AMBER : "#5fd1e0",
        emissiveIntensity: 0.9,
      });
  }
  const glass = kit.box(group, [annex.w, annex.h - 0.05, annex.d], [0, 0.05, 0], "#cfe9ef", {
    opacity: 0.28,
    roughness: 0.15,
  });
  glass.renderOrder = 2;
  kit.edges(glass, INK, 0.45);
  kit.box(group, [annex.w + 0.08, 0.05, annex.d + 0.08], [0, annex.h, 0], "#d8d2c4", { edges: INK });
  kit.shadow(parent, [annex.x, 0, annex.z], annex.w + 0.4, annex.d + 0.4, 0.2, true);
  return group;
}

function fiber(kit: Kit, parent: THREE.Object3D) {
  const color = "#23b3c9";
  const options = { emissive: color, emissiveIntensity: 0.5 };
  const z = SITE.street.z + 0.33;
  kit.box(parent, [11.4, 0.012, 0.045], [0, 0.04, z], color, options);
  kit.box(parent, [0.045, 0.012, 7.0], [SITE.lane.x + 0.3, 0.04, 0], color, options);
  for (const [x, length, direction] of [
    [-3.6, 1.05, 1],
    [2.4, 1.05, -1],
    [-4.5, 1.1, -1],
  ] as const) {
    kit.box(parent, [0.045, 0.012, length], [x, 0.04, z + (direction * length) / 2], color, options);
  }
}

function paving(kit: Kit) {
  return patternTexture(kit, 256, 160, (pen) => {
    pen.fillStyle = "#f0dcc1";
    pen.fillRect(0, 0, 256, 160);
    for (let y = 0; y < 160; y += 16)
      for (let x = (y / 16) % 2 ? -12 : 0; x < 256; x += 24) {
        const shade = 226 - ((x * 13 + y * 7) % 23);
        pen.fillStyle = `rgb(${shade + 14}, ${shade - 2}, ${shade - 30})`;
        pen.fillRect(x + 1, y + 1, 22, 14);
      }
  });
}

function sensorPole(kit: Kit, parent: THREE.Object3D, x: number, z: number, accent = TEAL, height = 0.9) {
  const group = kit.group(parent, [x, 0, z]);
  kit.cylinder(group, 0.12, 0.14, 0.05, [0, 0, 0], "#56687c", 12);
  kit.cylinder(group, 0.025, 0.03, height, [0, 0.05, 0], DARK, 8);
  kit.box(group, [0.22, 0.16, 0.16], [0, height, 0], WHITE, { edges: INK });
  kit.box(group, [0.24, 0.04, 0.18], [0, height - 0.04, 0], accent, { emissive: accent, emissiveIntensity: 0.4 });
  kit.ball(group, 0.035, [0, height + 0.08, 0.085], accent, 1, { emissive: accent, emissiveIntensity: 1.2 });
  for (const radius of [0.2, 0.32]) {
    const geometry = kit.geometry(`ring${radius}`, () => new THREE.TorusGeometry(radius, 0.012, 5, 32));
    kit.mesh(group, geometry, kit.standard(accent, { emissive: accent, emissiveIntensity: 0.6, opacity: 0.85 }), [
      0,
      height + 0.08,
      0,
    ], [Math.PI / 2, 0, 0]);
  }
  kit.shadow(group, [0, 0, 0], 0.45, 0.45, 0.24);
  return group;
}

function database(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number) {
  const group = kit.group(parent, [x, y, z]);
  for (let disc = 0; disc < 3; disc += 1) {
    kit.cylinder(group, 0.42, 0.42, 0.17, [0, disc * 0.22, 0], disc === 1 ? "#dff4f7" : WHITE, 28, {
      roughness: 0.4,
    });
    kit.cylinder(group, 0.425, 0.425, 0.03, [0, disc * 0.22 + 0.17, 0], TEAL, 28, {
      emissive: TEAL,
      emissiveIntensity: 0.35,
    });
  }
  const shackle = kit.geometry("shackle", () => new THREE.TorusGeometry(0.12, 0.025, 8, 20, Math.PI));
  const lock = kit.group(group, [0.52, 0.34, 0.22], -0.5);
  kit.box(lock, [0.26, 0.2, 0.08], [0, 0, 0], AMBER, { edges: INK });
  kit.mesh(lock, shackle, kit.standard(DARK, { metalness: 0.4 }), [0.09, 0.2, 0], [0, 0, 0.35]);
  return group;
}

function mapScreen(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number) {
  const texture = patternTexture(kit, 256, 170, (pen) => {
    pen.fillStyle = "#f5f8f2";
    pen.fillRect(0, 0, 256, 170);
    pen.fillStyle = "#d7e9c8";
    pen.fillRect(10, 10, 236, 150);
    pen.strokeStyle = "#ffffff";
    pen.lineWidth = 12;
    pen.beginPath();
    pen.moveTo(10, 70);
    pen.lineTo(246, 70);
    pen.moveTo(96, 10);
    pen.lineTo(96, 160);
    pen.stroke();
    const blobs: [number, number, number, string][] = [
      [170, 120, 34, "rgba(223,85,54,0.8)"],
      [205, 110, 22, "rgba(225,154,18,0.8)"],
      [140, 130, 20, "rgba(225,154,18,0.7)"],
      [50, 120, 18, "rgba(27,152,177,0.7)"],
      [50, 35, 16, "rgba(27,152,177,0.7)"],
    ];
    for (const [bx, by, radius, fill] of blobs) {
      pen.fillStyle = fill;
      pen.beginPath();
      pen.arc(bx, by, radius, 0, Math.PI * 2);
      pen.fill();
    }
    pen.setLineDash([6, 5]);
    pen.strokeStyle = "#15263b";
    pen.lineWidth = 3;
    pen.beginPath();
    pen.arc(186, 118, 44, 0, Math.PI * 2);
    pen.stroke();
  });
  const group = kit.group(parent, [x, 0, z], rotY);
  kit.cylinder(group, 0.03, 0.04, 0.55, [0, 0, 0], DARK, 8);
  kit.box(group, [0.5, 0.04, 0.3], [0, 0, 0], DARK);
  kit.box(group, [1.34, 0.9, 0.07], [0, 0.55, 0], DARK, { edges: INK });
  const face = kit.geometry("screenFace", () => new THREE.PlaneGeometry(1.24, 0.8));
  kit.mesh(group, face, kit.standard("#ffffff", { map: texture, roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.12 }), [
    0,
    1.0,
    0.037,
  ]);
  const table = kit.group(group, [0.05, 0, 0.7]);
  kit.box(table, [0.8, 0.05, 0.45], [0, 0.32, 0], "#e9e2d2", { edges: INK });
  for (const lx of [-0.35, 0.35]) kit.box(table, [0.04, 0.32, 0.04], [lx, 0, 0], DARK);
  const pad = kit.group(table, [-0.18, 0.37, 0.02], 0.2);
  kit.box(pad, [0.3, 0.025, 0.21], [0, 0, 0], DARK);
  kit.box(pad, [0.26, 0.01, 0.17], [0, 0.025, 0], "#7fd0dd", { emissive: "#7fd0dd", emissiveIntensity: 0.3 });
  const controller = kit.group(table, [0.2, 0.37, 0.02], -0.3);
  kit.box(controller, [0.22, 0.05, 0.1], [0, 0, 0], DARK);
  kit.ball(controller, 0.06, [-0.1, 0.02, 0.02], DARK, 1);
  kit.ball(controller, 0.06, [0.1, 0.02, 0.02], DARK, 1);
  kit.ball(controller, 0.018, [0.06, 0.06, 0.0], CORAL, 1);
  kit.ball(controller, 0.018, [0.1, 0.06, -0.02], "#4f9a3e", 1);
  kit.shadow(group, [0, 0, 0.3], 1.6, 1.2, 0.18, true);
  return group;
}

function magnifier(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number) {
  const tilt = new THREE.Euler(-0.5, 0, 0);
  const group = kit.group(parent, [x, y, z], -0.55);
  const rim = kit.geometry("lensRim", () => new THREE.TorusGeometry(0.46, 0.06, 10, 40));
  kit.mesh(group, rim, kit.standard(DARK, { metalness: 0.35, roughness: 0.4 }), [0, 0, 0], [tilt.x, 0, 0]);
  const glass = kit.geometry("lensGlass", () => new THREE.CircleGeometry(0.44, 36));
  kit.mesh(
    group,
    glass,
    kit.standard("#bdeaf2", {
      opacity: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.1,
      emissive: "#bdeaf2",
      emissiveIntensity: 0.2,
    }),
    [0, 0, 0],
    [tilt.x, 0, 0],
  );
  const direction = new THREE.Vector3(Math.SQRT1_2, -Math.SQRT1_2, 0).applyEuler(tilt);
  const handle = kit.cylinder(group, 0.05, 0.06, 0.62, [0, 0, 0], "#7a4dc2", 10);
  handle.position.copy(direction.clone().multiplyScalar(0.8));
  handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const tiles = kit.group(parent, [x, 0.24, z + 0.2]);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const radius = i === 6 ? 0 : 0.34;
    kit.cylinder(tiles, 0.18, 0.18, 0.04, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius], i % 2 ? "#7a4dc2" : "#b69ae6", 6, {
      emissive: "#7a4dc2",
      emissiveIntensity: 0.25,
    });
  }
  return group;
}

function pin(kit: Kit, parent: THREE.Object3D, x: number, z: number, color: string) {
  const group = kit.group(parent, [x, 0, z]);
  const cone = kit.geometry("pinCone", () => {
    const geometry = new THREE.ConeGeometry(0.09, 0.26, 12);
    geometry.rotateX(Math.PI);
    geometry.translate(0, 0.13, 0);
    return geometry;
  });
  kit.mesh(group, cone, kit.standard(color, { emissive: color, emissiveIntensity: 0.25 }), [0, 0.02, 0]);
  kit.ball(group, 0.09, [0, 0.3, 0], color, 1, { emissive: color, emissiveIntensity: 0.25 });
  kit.ball(group, 0.035, [0, 0.31, 0.075], WHITE, 1);
  kit.shadow(group, [0, 0, 0], 0.3, 0.3, 0.3);
  return group;
}

function ghostTree(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z]);
  const crown = kit.geometry("ghostCrown", () => new THREE.IcosahedronGeometry(0.36, 0));
  const material = kit.standard("#dff3f6", { opacity: 0.18 });
  const mesh = kit.mesh(group, crown, material, [0, 0.66, 0]);
  kit.edges(mesh, "#0e5f71", 0.95, true);
  const trunk = kit.geometry("ghostTrunk", () => new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6));
  const stem = kit.mesh(group, trunk, material, [0, 0.2, 0]);
  kit.edges(stem, "#0e5f71", 0.95, true);
  return group;
}

function card(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number, icon: "tree" | "sail" | "water") {
  const group = kit.group(parent, [x, 0, z], rotY);
  for (const lx of [-0.2, 0.2]) {
    const leg = kit.box(group, [0.03, 0.5, 0.03], [lx, 0, -0.06], "#8a6a48");
    leg.rotation.x = 0.18;
  }
  kit.box(group, [0.56, 0.62, 0.035], [0, 0.32, 0], WHITE, { edges: AMBER, edgeOpacity: 0.95 });
  kit.box(group, [0.56, 0.08, 0.04], [0, 0.86, 0], AMBER, { emissive: AMBER, emissiveIntensity: 0.2 });
  const iconGroup = kit.group(group, [0, 0.46, 0.03]);
  if (icon === "tree") {
    kit.ball(iconGroup, 0.13, [0, 0.12, 0], LEAF[0], 0, { flat: true });
    kit.box(iconGroup, [0.03, 0.12, 0.02], [0, -0.06, 0], TRUNK);
  } else if (icon === "sail") {
    const sail = kit.geometry("iconSail", () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.16, -0.06);
      shape.lineTo(0.16, 0.02);
      shape.lineTo(-0.08, 0.2);
      shape.closePath();
      return new THREE.ShapeGeometry(shape);
    });
    kit.mesh(iconGroup, sail, kit.standard(CORAL, { side: THREE.DoubleSide }), [0, 0, 0.005]);
  } else {
    kit.ball(iconGroup, 0.09, [0, 0.05, 0], "#3aa6d8", 1);
    const drop = kit.geometry("iconDrop", () => new THREE.ConeGeometry(0.075, 0.12, 12));
    kit.mesh(iconGroup, drop, kit.standard("#3aa6d8"), [0, 0.15, 0]);
  }
  return group;
}

function check(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number, color = "#3f9a45") {
  const group = kit.group(parent, [x, y, z]);
  const disc = kit.geometry("checkDisc", () => {
    const geometry = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  });
  kit.mesh(group, disc, kit.standard(color, { emissive: color, emissiveIntensity: 0.35 }), [0, 0, 0]);
  const short = kit.box(group, [0.05, 0.1, 0.03], [-0.045, -0.06, 0.035], WHITE);
  short.rotation.z = 0.8;
  const long = kit.box(group, [0.05, 0.19, 0.03], [0.04, -0.07, 0.035], WHITE);
  long.rotation.z = -0.65;
  return group;
}

function barrier(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number) {
  const group = kit.group(parent, [x, 0, z], rotY);
  for (const px of [-0.42, 0.42]) {
    kit.box(group, [0.07, 0.46, 0.07], [px, 0, 0], DARK);
    kit.box(group, [0.16, 0.04, 0.2], [px, 0, 0], DARK);
  }
  for (let segment = 0; segment < 6; segment += 1)
    kit.box(group, [0.16, 0.12, 0.05], [-0.4 + segment * 0.16, 0.3, 0.04], segment % 2 ? WHITE : "#d6362c", {
      emissive: segment % 2 ? "#000000" : "#d6362c",
      emissiveIntensity: 0.15,
    });
  const board = kit.group(group, [0.72, 0, 0.18], -0.35);
  kit.box(board, [0.04, 0.55, 0.04], [0, 0, 0], "#8a6a48");
  kit.box(board, [0.4, 0.5, 0.03], [0, 0.42, 0.03], WHITE, { edges: INK });
  for (let line = 0; line < 3; line += 1)
    kit.box(board, [0.26 - line * 0.04, 0.025, 0.01], [-0.02, 0.72 - line * 0.08, 0.05], "#8b98a6");
  const seal = kit.geometry("seal", () => {
    const geometry = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  });
  kit.mesh(board, seal, kit.standard("#b5352b"), [0.1, 0.5, 0.055]);
  kit.shadow(group, [0, 0, 0], 1.4, 0.6, 0.2, true);
  return group;
}

function roundTable(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z]);
  kit.cylinder(group, 0.08, 0.12, 0.36, [0, 0, 0], DARK, 12);
  kit.cylinder(group, 0.82, 0.82, 0.06, [0, 0.36, 0], "#e7d3ae", 40);
  const map = patternTexture(kit, 128, 128, (pen) => {
    pen.fillStyle = "#f7f1e4";
    pen.fillRect(0, 0, 128, 128);
    pen.strokeStyle = "#d9c49c";
    pen.lineWidth = 8;
    pen.beginPath();
    pen.moveTo(0, 50);
    pen.lineTo(128, 50);
    pen.moveTo(52, 0);
    pen.lineTo(52, 128);
    pen.stroke();
    pen.fillStyle = "rgba(223,85,54,0.55)";
    pen.beginPath();
    pen.arc(92, 90, 22, 0, Math.PI * 2);
    pen.fill();
  });
  const face = kit.geometry("tableMap", () => {
    const geometry = new THREE.CircleGeometry(0.66, 36);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  });
  kit.mesh(group, face, kit.standard("#ffffff", { map }), [0, 0.425, 0]);
  kit.shadow(group, [0, 0, 0], 2.2, 2.2, 0.2);
  return group;
}

function van(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number) {
  const group = kit.group(parent, [x, 0, z], rotY);
  kit.box(group, [1.0, 0.44, 0.5], [-0.1, 0.1, 0], WHITE, { edges: INK });
  kit.box(group, [0.34, 0.34, 0.5], [0.55, 0.1, 0], WHITE, { edges: INK });
  kit.box(group, [0.02, 0.18, 0.4], [0.72, 0.28, 0], WINDOW);
  kit.box(group, [1.0, 0.07, 0.51], [-0.1, 0.3, 0], CORAL);
  kit.box(group, [0.2, 0.05, 0.3], [0.1, 0.54, 0], AMBER, { emissive: AMBER, emissiveIntensity: 0.6 });
  for (const wx of [-0.38, 0.5])
    for (const wz of [-0.26, 0.26]) {
      const wheel = kit.cylinder(group, 0.1, 0.1, 0.06, [0, 0, 0], DARK, 12);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.1, wz);
    }
  kit.shadow(group, [0, 0, 0], 1.5, 0.8, 0.25, true);
  return group;
}

function worker(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number, seed: number) {
  const figure = person(kit, parent, x, z, seed, rotY, 1, CORAL);
  kit.ball(figure, 0.078, [0, 0.6, 0], YELLOW, 1).scale.set(1, 0.55, 1);
  kit.box(figure, [0.19, 0.03, 0.17], [0, 0.34, 0], YELLOW, { emissive: YELLOW, emissiveIntensity: 0.3 });
  return figure;
}

function shadeSail(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z], 0.25);
  const corners = [
    new THREE.Vector3(-1.05, 1.12, -0.55),
    new THREE.Vector3(1.0, 0.95, -0.75),
    new THREE.Vector3(0.2, 1.2, 0.85),
  ];
  for (const corner of corners) {
    kit.cylinder(group, 0.025, 0.03, corner.y + 0.08, [corner.x, 0, corner.z], DARK, 6);
  }
  const geometry = kit.geometry("sail", () => {
    const sail = new THREE.BufferGeometry().setFromPoints(corners);
    sail.setIndex([0, 1, 2]);
    sail.computeVertexNormals();
    return sail;
  });
  kit.mesh(group, geometry, kit.standard("#fbe6de", { side: THREE.DoubleSide, emissive: "#fbe6de", emissiveIntensity: 0.1 }), [0, 0, 0]);
  const hem = new THREE.LineLoop(
    kit.geometry("sailHem", () => new THREE.BufferGeometry().setFromPoints(corners)),
    kit.lineMaterial(CORAL, 0.9),
  );
  hem.raycast = () => {};
  group.add(hem);
  kit.shadow(group, [0.05, 0, 0.05], 2.1, 1.6, 0.26);
  return group;
}

function fountain(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z]);
  kit.cylinder(group, 0.36, 0.4, 0.12, [0, 0, 0], "#cfc6b4", 24);
  kit.cylinder(group, 0.3, 0.3, 0.02, [0, 0.11, 0], "#6cc3e0", 24, { emissive: "#6cc3e0", emissiveIntensity: 0.25 });
  kit.cylinder(group, 0.03, 0.05, 0.3, [0, 0.12, 0], "#cfc6b4", 8);
  kit.ball(group, 0.06, [0, 0.46, 0], "#9fdcf0", 1, { emissive: "#9fdcf0", emissiveIntensity: 0.4, opacity: 0.8 });
  return group;
}

function gauge(kit: Kit, parent: THREE.Object3D, x: number, z: number) {
  const group = kit.group(parent, [x, 0, z]);
  kit.cylinder(group, 0.12, 0.14, 0.05, [0, 0, 0], "#56687c", 12);
  kit.cylinder(group, 0.025, 0.03, 0.95, [0, 0.05, 0], DARK, 8);
  kit.box(group, [0.34, 0.26, 0.08], [0, 0.95, 0], WHITE, { edges: INK });
  kit.box(group, [0.26, 0.16, 0.01], [0, 1.0, 0.045], "#fdf2e9");
  const needle = kit.box(group, [0.02, 0.1, 0.012], [0, 1.02, 0.055], CORAL);
  needle.rotation.z = 0.6;
  const ringGeometry = kit.geometry("gaugeRing", () => new THREE.TorusGeometry(0.62, 0.035, 6, 48));
  const ring = kit.mesh(
    group,
    ringGeometry,
    kit.standard("#9aa7b3", { emissive: "#3f9a45", emissiveIntensity: 0, unique: true }),
    [0, 0.04, 0],
    [Math.PI / 2, 0, 0],
  );
  kit.shadow(group, [0, 0, 0], 0.45, 0.45, 0.24);
  return { group, ring, needle };
}

function statusBoard(kit: Kit, parent: THREE.Object3D, x: number, z: number, rotY: number) {
  const group = kit.group(parent, [x, 0, z], rotY);
  for (const lx of [-0.3, 0.3]) kit.box(group, [0.04, 0.5, 0.04], [lx, 0, 0], DARK);
  kit.box(group, [0.78, 0.46, 0.05], [0, 0.42, 0], WHITE, { edges: INK });
  const dots: THREE.Mesh[] = [];
  for (let step = 0; step < 3; step += 1) {
    kit.box(group, [0.34, 0.03, 0.01], [0.1, 0.72 - step * 0.13, 0.03], "#b6bfc9");
    const dot = kit.ball(group, 0.04, [-0.24, 0.735 - step * 0.13, 0.03], "#c8ced6", 1, {
      unique: true,
    });
    dots.push(dot);
  }
  kit.shadow(group, [0, 0, 0], 0.9, 0.4, 0.2, true);
  return { group, dots };
}

function scaffoldBuilding(kit: Kit, parent: THREE.Object3D) {
  const { lot } = SITE;
  const group = kit.group(parent, [lot.x, 0, lot.z]);
  const building = kit.group(group, [0, 0, 0]);
  kit.box(building, [1.45, 1.0, 1.25], [0, 0, 0], WALL, { edges: INK, edgeOpacity: 0.3 });
  kit.box(building, [1.52, 0.06, 1.32], [0, 1.0, 0], "#d8cfbd", { edges: INK });
  windowsBand(kit, building, 1.2, 0.25, 0.63, 3, 0.14);
  windowsBand(kit, building, 1.2, 0.65, 0.63, 3, 0.14);
  kit.box(building, [0.9, 0.08, 0.35], [0.1, 1.06, -0.1], "#b9c3cc", { edges: INK });
  const scaffold = kit.group(group, [0, 0, 0]);
  for (const sx of [-0.82, 0.82])
    for (const sz of [-0.72, 0.72]) kit.box(scaffold, [0.03, 1.25, 0.03], [sx, 0, sz], "#c9a24a");
  for (const y of [0.35, 0.75, 1.15]) {
    kit.box(scaffold, [1.66, 0.025, 0.03], [0, y, 0.72], "#c9a24a");
    kit.box(scaffold, [0.03, 0.025, 1.46], [0.82, y, 0], "#c9a24a");
    kit.box(scaffold, [1.6, 0.02, 0.18], [0, y - 0.02, 0.8], "#b88f3c");
  }
  const fence = kit.group(group, [0, 0, 0]);
  for (let post = 0; post < 9; post += 1) {
    const t = post / 8;
    kit.box(fence, [0.03, 0.22, 0.03], [-lot.w / 2 + t * lot.w, 0, lot.d / 2], "#9a7651");
    kit.box(fence, [0.03, 0.22, 0.03], [-lot.w / 2 + t * lot.w, 0, -lot.d / 2], "#9a7651");
  }
  kit.box(fence, [lot.w, 0.03, 0.02], [0, 0.16, lot.d / 2], "#9a7651");
  kit.box(fence, [lot.w, 0.03, 0.02], [0, 0.16, -lot.d / 2], "#9a7651");
  kit.shadow(parent, [lot.x, 0, lot.z], 2.1, 1.9, 0.18, true);
  return { building, scaffold, fence };
}

function beacon(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number) {
  const group = kit.group(parent, [x, y, z]);
  kit.cylinder(group, 0.07, 0.09, 0.08, [0, 0, 0], DARK, 12);
  const light = kit.ball(group, 0.11, [0, 0.16, 0], CORAL, 1, { emissive: CORAL, emissiveIntensity: 1.1 });
  const halo = kit.geometry("beaconHalo", () => new THREE.TorusGeometry(0.28, 0.02, 6, 32));
  const ring = kit.mesh(group, halo, kit.standard(CORAL, { emissive: CORAL, emissiveIntensity: 0.9, opacity: 0.8 }), [
    0,
    0.16,
    0,
  ], [Math.PI / 2, 0, 0]);
  return { group, light, ring };
}

/* ------------------------------------------------------------------ */
/* Plates                                                               */
/* ------------------------------------------------------------------ */

function plateSlab(kit: Kit, plate: THREE.Group, id: LayerId) {
  const color = layers[id - 1].color;
  const side = kit.standard(color, { roughness: 0.7 });
  const top = kit.standard(GROUND[id], { roughness: 0.95 });
  const bottom = kit.standard(new THREE.Color(color).multiplyScalar(0.7), { roughness: 0.9 });
  const geometry = kit.geometry(
    "slab",
    () => new THREE.BoxGeometry(PLATE_WIDTH, PLATE_THICKNESS, PLATE_DEPTH),
  );
  const slab = kit.mesh(plate, geometry, [side, side, top, bottom, side, side], [
    0,
    -PLATE_THICKNESS / 2,
    0,
  ]);
  kit.edges(slab, INK, 0.5);
  const lip = kit.geometry("lip", () => new THREE.BoxGeometry(PLATE_WIDTH + 0.02, 0.05, PLATE_DEPTH + 0.02));
  kit.mesh(plate, lip, kit.standard(new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35)), [
    0,
    -0.028,
    0,
  ]);
}

function streets(kit: Kit, plate: THREE.Group, color: string, lineColor?: string) {
  kit.box(plate, [PLATE_WIDTH - 0.08, 0.02, SITE.street.depth], [0, 0, SITE.street.z], color);
  kit.box(plate, [SITE.lane.width, 0.02, PLATE_DEPTH - 0.08], [SITE.lane.x, 0, 0], color);
  if (lineColor)
    for (let dash = -5.4; dash < 5.6; dash += 0.6)
      if (Math.abs(dash - SITE.lane.x) > 0.6)
        kit.box(plate, [0.3, 0.005, 0.04], [dash, 0.02, SITE.street.z], lineColor);
}

function buildPlateOne(kit: Kit, plate: THREE.Group) {
  const paveTexture = paving(kit);
  paveTexture.wrapS = paveTexture.wrapT = THREE.RepeatWrapping;
  paveTexture.repeat.set(2.4, 1.6);
  kit.use("plate-1", () => streets(kit, plate, STREET, "#fbfaf6"));

  const squareMaterial = kit.use("square", () => {
    const { square } = SITE;
    const pave = kit.box(plate, [square.w, 0.02, square.d], [square.x, 0, square.z], "#ffffff", {
      map: paveTexture,
      emissive: "#ff7a3d",
      emissiveIntensity: 0,
      roughness: 0.9,
      unique: true,
    });
    kit.edges(pave, INK, 0.25);
    tree(kit, plate, 5.25, 0.55, 0.75, 2);
    bench(kit, plate, 2.1, 2.6, 0.2);
    bench(kit, plate, 4.1, 1.2, -0.3);
    lamp(kit, plate, 1.1, 0.7);
    lamp(kit, plate, 5.2, 3.2);
    person(kit, plate, 3.3, 2.2, 2, 0.8);
    person(kit, plate, 2.4, 1.1, 5, -1.9);
    return pave.material as THREE.MeshStandardMaterial;
  });
  const foundationTrees = kit.use("square", () =>
    [
      [1.6, 1.25],
      [2.8, 0.75],
      [4.4, 1.9],
      [1.9, 3.0],
    ].map(([x, z], index) => tree(kit, plate, x, z, 0.62, index)),
  );

  kit.use("buildings", () => {
    townHall(kit, plate, "real");
    SITE.houses.forEach((spec, index) => house(kit, plate, spec, index, "real"));
    communityCenter(kit, plate, "real");
    const { lot } = SITE;
    kit.box(plate, [lot.w, 0.02, lot.d], [lot.x, 0, lot.z], "#cdbf9f");
    for (let post = 0; post < 7; post += 1)
      kit.box(plate, [0.03, 0.2, 0.03], [lot.x - lot.w / 2 + (post / 6) * lot.w, 0, lot.z + lot.d / 2], "#9a7651");
    kit.box(plate, [lot.w, 0.03, 0.02], [lot.x, 0.14, lot.z + lot.d / 2], "#9a7651");
    tree(kit, plate, lot.x + 0.5, lot.z - 0.45, 0.55, 3);
  });
  kit.use("energy", () => {
    solarRoof(kit, plate);
    battery(kit, plate, SITE.battery.x, SITE.battery.z);
  });
  const radio = kit.use("network", () => {
    fiber(kit, plate);
    return mast(kit, plate, SITE.mast.x, SITE.mast.z);
  });
  kit.use("compute", () => serverPavilion(kit, plate));
  kit.use("plate-1", () => {
    tree(kit, plate, -5.5, -1.3, 0.7, 1);
    tree(kit, plate, 0.9, -1.35, 0.7, 2);
    tree(kit, plate, -0.95, 2.4, 0.65, 0);
    tree(kit, plate, 5.55, -1.4, 0.7, 3);
    person(kit, plate, -2.4, -0.3, 1, 1.6);
    person(kit, plate, 0.9, -0.75, 6, -1.4);
  });
  return { squareMaterial, foundationTrees, waves: radio.waves };
}

const HEX_RADIUS = 0.27;
function heatAt(x: number, z: number, after: boolean) {
  const { square } = SITE;
  const inSquare =
    Math.abs(x - square.x) < square.w / 2 && Math.abs(z - square.z) < square.d / 2;
  const onStreet =
    Math.abs(z - SITE.street.z) < SITE.street.depth / 2 + 0.15 ||
    Math.abs(x - SITE.lane.x) < SITE.lane.width / 2 + 0.15;
  const distance = Math.hypot((x - square.x) / (square.w / 2), (z - square.z) / (square.d / 2));
  let heat = 0.16 + Math.sin(x * 1.7) * 0.05 + Math.cos(z * 2.3) * 0.05;
  if (onStreet) heat = 0.52 + Math.sin(x * 0.9) * 0.05;
  if (inSquare) heat = after ? 0.3 + distance * 0.14 : 0.97 - distance * 0.18;
  if (Math.abs(x - SITE.center.x) < SITE.center.w / 2 && Math.abs(z - SITE.center.z) < SITE.center.d / 2)
    heat = 0.4;
  return THREE.MathUtils.clamp(heat, 0, 1);
}
const HEAT_STOPS = ["#2aa7c0", "#bfe5e3", "#f3e3b5", "#f2a93b", "#df5536"].map(
  (color) => new THREE.Color(color),
);
function heatColor(value: number, target: THREE.Color) {
  const scaled = THREE.MathUtils.clamp(value, 0, 0.999) * (HEAT_STOPS.length - 1);
  const index = Math.floor(scaled);
  return target.copy(HEAT_STOPS[index]).lerp(HEAT_STOPS[index + 1], scaled - index);
}

function buildPlateTwo(kit: Kit, plate: THREE.Group) {
  const hex = kit.use("plate-2", () => {
    const positions: [number, number][] = [];
    const dx = Math.sqrt(3) * HEX_RADIUS;
    const dz = 1.5 * HEX_RADIUS;
    for (let row = 0, z = -PLATE_DEPTH / 2 + HEX_RADIUS; z < PLATE_DEPTH / 2 - HEX_RADIUS * 0.6; row += 1, z += dz)
      for (let x = -PLATE_WIDTH / 2 + dx / 2 + (row % 2 ? dx / 2 : 0); x < PLATE_WIDTH / 2 - dx * 0.4; x += dx)
        positions.push([x, z]);
    const geometry = new THREE.CylinderGeometry(HEX_RADIUS * 0.93, HEX_RADIUS * 0.93, 1, 6);
    geometry.translate(0, 0.5, 0);
    kit.extraGeometries.add(geometry);
    const material = kit.standard("#ffffff", { roughness: 0.75 });
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    mesh.userData.owner = "plate-2";
    kit.model("plate-2").meshes.push(mesh);
    kit.pickables.push(mesh);
    plate.add(mesh);
    const before = positions.map(([x, z]) => heatAt(x, z, false));
    const after = positions.map(([x, z]) => heatAt(x, z, true));
    return { mesh, positions, before, after };
  });

  kit.use("plate-2", () => {
    townHall(kit, plate, "glass");
    SITE.houses.forEach((spec, index) => house(kit, plate, spec, index, "glass"));
    communityCenter(kit, plate, "glass");
    const { annex } = SITE;
    glassVolume(kit, plate, [annex.w, annex.h, annex.d], [annex.x, 0, annex.z]);
  });
  kit.use("sensors", () => {
    sensorPole(kit, plate, 1.35, 3.05);
    sensorPole(kit, plate, 4.95, 1.05);
    sensorPole(kit, plate, -2.1, -0.05, TEAL, 0.75);
  });
  kit.use("openData", () => database(kit, plate, 4.95, 0.18, 2.9));
  const mapObjects = kit.use("map", () => {
    mapScreen(kit, plate, -1.85, 2.55, 0.35);
    person(kit, plate, -2.25, 3.55, 3, Math.PI + 0.3);
    person(kit, plate, -1.45, 3.6, 4, Math.PI - 0.2);
    const scenario = kit.group(plate, [0, 0, 0]);
    for (const [x, z] of [
      [1.6, 1.25],
      [2.8, 0.75],
      [4.4, 1.9],
      [1.9, 3.0],
      [3.5, 2.8],
    ])
      ghostTree(kit, scenario, x, z);
    const reports = kit.group(plate, [0, 0, 0]);
    for (const [x, z, color] of [
      [-4.2, -0.55, CORAL],
      [1.2, -0.55, AMBER],
      [-0.3, 1.8, CORAL],
      [3.9, 3.0, AMBER],
    ] as const)
      pin(kit, reports, x, z, color);
    const housing = kit.group(plate, [SITE.lot.x, 0, SITE.lot.z]);
    const ghost = kit.box(housing, [1.45, 1.0, 1.25], [0, 0, 0], "#e7f5f7", { opacity: 0.2 });
    kit.edges(ghost, "#0e5f71", 0.95, true);
    return { scenario, reports, housing };
  });
  kit.use("analysis", () => magnifier(kit, plate, 5.2, 1.5, -0.6));
  return { hex, ...mapObjects };
}

function buildPlateThree(kit: Kit, plate: THREE.Group) {
  kit.use("plate-3", () => {
    streets(kit, plate, "#e8d9b9");
    SITE.houses.forEach((spec, index) => house(kit, plate, spec, index, "card"));
    communityCenter(kit, plate, "card");
    const { annex, lot, square } = SITE;
    kit.box(plate, [annex.w, annex.h, annex.d], [annex.x, 0, annex.z], CARD, { edges: "#8b98a6" });
    const lotOutline = kit.box(plate, [lot.w, 0.02, lot.d], [lot.x, 0, lot.z], "#efe3c7");
    kit.edges(lotOutline, "#8b98a6", 0.8, true);
    const plaza = kit.box(plate, [square.w, 0.02, square.d], [square.x, 0, square.z], "#f7eedb");
    kit.edges(plaza, "#b99a5e", 0.6);
    tree(kit, plate, -5.5, -1.3, 0.62, 1);
    tree(kit, plate, 5.55, -1.4, 0.62, 3);
    person(kit, plate, -1.0, -0.4, 7, 0.9);
    person(kit, plate, 0.4, 0.8, 1, -2.6);
  });
  kit.use("council", () => {
    townHall(kit, plate, "chamber");
    const { hall } = SITE;
    for (let seat = 0; seat < 7; seat += 1) {
      const angle = Math.PI * (0.12 + (seat / 6) * 0.76);
      const x = hall.x + Math.cos(angle) * 1.05;
      const z = hall.z - 0.55 + Math.sin(angle) * 0.85;
      person(kit, plate, x, z, seat + 2, Math.atan2(-Math.cos(angle), -Math.sin(angle)), 0.85);
    }
    kit.box(plate, [0.5, 0.3, 0.26], [hall.x, 0.04, hall.z - 0.6], "#b0895a", { edges: INK });
  });
  const decision = kit.use("council", () => {
    const marks = kit.group(plate, [0, 0, 0]);
    check(kit, marks, 1.05, 1.22, 1.35);
    check(kit, marks, 1.05, 1.22, 2.2);
    const document = kit.group(marks, [SITE.hall.x, 0.36, SITE.hall.z - 0.6], 0.2);
    kit.box(document, [0.3, 0.02, 0.22], [0, 0, 0], WHITE, { edges: INK });
    const stamp = kit.geometry("stamp", () => new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16));
    kit.mesh(document, stamp, kit.standard("#3f9a45"), [0.08, 0.02, 0.05]);
    return marks;
  });
  kit.use("assembly", () => {
    const { square } = SITE;
    const tableX = square.x + 0.55;
    const tableZ = square.z;
    roundTable(kit, plate, tableX, tableZ);
    for (let seat = 0; seat < 8; seat += 1) {
      const angle = (seat / 8) * Math.PI * 2 + 0.2;
      person(
        kit,
        plate,
        tableX + Math.cos(angle) * 1.12,
        tableZ + Math.sin(angle) * 1.12,
        seat,
        Math.atan2(-Math.cos(angle), -Math.sin(angle)),
      );
    }
  });
  const options = kit.use("proposal", () => {
    const group = kit.group(plate, [0, 0, 0]);
    card(kit, group, 1.05, 1.35, 1.35, "tree");
    card(kit, group, 1.05, 2.2, 1.25, "sail");
    card(kit, group, 1.05, 3.05, 1.15, "water");
    return group;
  });
  const housingProposal = kit.use("proposal", () => {
    const group = kit.group(plate, [SITE.lot.x, 0, SITE.lot.z]);
    kit.box(group, [1.2, 0.7, 1.0], [0, 0, 0], CARD, { edges: AMBER, edgeOpacity: 1 });
    kit.gable(group, [1.3, 0.45, 1.1], [0, 0.7, 0], CARD, { edges: AMBER });
    return group;
  });
  kit.use("ruleCase", () => barrier(kit, plate, 5.35, SITE.street.z, -Math.PI / 2 + 0.1));
  return { decision, options, housingProposal };
}

function buildPlateFour(kit: Kit, plate: THREE.Group) {
  const paveTexture = paving(kit);
  paveTexture.wrapS = paveTexture.wrapT = THREE.RepeatWrapping;
  paveTexture.repeat.set(2.4, 1.6);
  kit.use("plate-4", () => {
    streets(kit, plate, STREET, "#fbfaf6");
    SITE.houses.forEach((spec, index) => house(kit, plate, spec, index, "real"));
    serverPavilion(kit, plate);
    battery(kit, plate, SITE.battery.x, SITE.battery.z);
    communityCenter(kit, plate, "real");
    mast(kit, plate, SITE.mast.x, SITE.mast.z);
    const { square } = SITE;
    const pave = kit.box(plate, [square.w, 0.02, square.d], [square.x, 0, square.z], "#ffffff", {
      map: paveTexture,
      roughness: 0.9,
    });
    kit.edges(pave, INK, 0.25);
    tree(kit, plate, 5.25, 0.55, 0.75, 2);
    tree(kit, plate, -5.5, -1.3, 0.7, 1);
    tree(kit, plate, 0.9, -1.35, 0.7, 2);
    tree(kit, plate, -0.95, 2.4, 0.65, 0);
  });
  const assistance = kit.use("change", () => {
    const { center } = SITE;
    const sign = kit.group(plate, [center.x + center.w / 2 - 0.45, 0.68, center.z + center.d / 2 + 0.2]);
    kit.box(sign, [0.44, 0.3, 0.05], [0, 0, 0], "#3f9a45", { emissive: "#3f9a45", emissiveIntensity: 0.5 });
    kit.box(sign, [0.26, 0.07, 0.02], [0, 0.115, 0.03], WHITE);
    kit.box(sign, [0.07, 0.22, 0.02], [0, 0.04, 0.03], WHITE);
    const arrivals = [
      person(kit, plate, -1.75, 2.1, 1, 2.5),
      person(kit, plate, -2.05, 2.55, 4, 2.7),
      person(kit, plate, -1.2, 1.6, 6, 2.4),
    ];
    return { sign, arrivals };
  });
  const change = kit.use("change", () => {
    const trees = [
      [1.6, 1.25],
      [2.8, 0.75],
      [4.4, 1.9],
      [1.9, 3.0],
    ].map(([x, z], index) => tree(kit, plate, x, z, 0.95, index));
    const sail = shadeSail(kit, plate, 3.3, 2.55);
    const water = fountain(kit, plate, 4.75, 3.05);
    const sitting = [person(kit, plate, 3.0, 2.3, 3, 0.4), person(kit, plate, 3.55, 2.65, 7, -2.2)];
    const benches = [bench(kit, plate, 2.4, 2.2, 0.4), bench(kit, plate, 3.9, 2.25, -0.5)];
    return { trees, sail, water, sitting, benches };
  });
  const construction = kit.use("change", () => scaffoldBuilding(kit, plate));
  const admin = kit.use("administration", () => {
    townHall(kit, plate, "real");
    const board = statusBoard(kit, plate, 0.85, -1.35, 0.15);
    person(kit, plate, 1.4, -1.45, 6, -0.4);
    const alarm = beacon(kit, plate, SITE.tower.x, SITE.tower.h + 0.55, SITE.tower.z);
    return { board, alarm };
  });
  kit.use("works", () => {
    van(kit, plate, 4.1, SITE.street.z, 0);
    worker(kit, plate, 1.25, 0.55, 0.6, 1);
    worker(kit, plate, 2.05, 0.45, -0.4, 4);
    const shovel = kit.group(plate, [1.47, 0, 0.62], 0.3);
    kit.box(shovel, [0.02, 0.5, 0.02], [0, 0.05, 0], "#8a6a48").rotation.z = 0.35;
    kit.box(shovel, [0.1, 0.12, 0.02], [0.08, 0, 0], METAL);
    kit.box(plate, [0.32, 0.12, 0.26], [0.75, 0, 0.9], "#8a6a48");
    kit.cylinder(plate, 0.2, 0.26, 0.12, [1.6, 0, 1.25], "#7a5a3d", 12);
  });
  const evaluation = kit.use("evaluation", () => gauge(kit, plate, 5.45, 3.2));
  return { change, construction, admin, assistance, evaluation };
}

/* ------------------------------------------------------------------ */
/* Beyond the city                                                      */
/* ------------------------------------------------------------------ */

function miniCity(kit: Kit, parent: THREE.Group, x: number, y: number, z: number, scale: number) {
  const group = kit.group(parent, [x, y, z], -0.25, scale);
  const plateGeometry = kit.geometry("miniPlate", () => new THREE.BoxGeometry(3.6, 0.16, 2.3));
  layers.forEach((layer, index) => {
    const level = kit.group(group, [0, index * 1.25, 0]);
    const top = kit.standard(GROUND[layer.id]);
    const side = kit.standard(layer.color);
    kit.mesh(level, plateGeometry, [side, side, top, side, side, side], [0, -0.08, 0]);
    const seed = index * 3;
    if (index === 1) {
      for (let i = 0; i < 5; i += 1)
        kit.cylinder(level, 0.14, 0.14, 0.05 + ((i * 7) % 3) * 0.04, [-1.2 + i * 0.55, 0, 0.35], i % 2 ? "#f2a93b" : "#2aa7c0", 6);
      kit.box(level, [0.7, 0.35, 0.5], [0.8, 0, -0.5], "#bfe6ee", { opacity: 0.4 });
    } else if (index === 2) {
      kit.cylinder(level, 0.35, 0.35, 0.08, [0.4, 0, 0.1], "#e7d3ae", 20);
      for (let i = 0; i < 4; i += 1) person(kit, level, 0.4 + Math.cos(i * 1.6) * 0.55, 0.1 + Math.sin(i * 1.6) * 0.45, seed + i, 0, 0.7);
    } else {
      kit.box(level, [0.9, 0.45, 0.6], [-0.9, 0, -0.4], WALL, { edges: INK });
      kit.gable(level, [0.95, 0.35, 0.65], [-0.9, 0.45, -0.4], ROOF);
      kit.box(level, [0.55, 0.35, 0.5], [0.3, 0, -0.5], WALL_WARM, { edges: INK });
      tree(kit, level, 1.1, 0.5, 0.6, index);
      tree(kit, level, 0.4, 0.6, 0.5, index + 1);
    }
  });
  return group;
}

function parliament(kit: Kit, parent: THREE.Group) {
  const group = kit.group(parent, [0, 0, 0]);
  const base = kit.box(group, [3.4, 0.3, 2.3], [0, -0.3, 0], "#d9d3e6", { edges: INK });
  base.userData.plinth = true;
  kit.box(group, [2.6, 0.12, 1.5], [0, 0, 0.1], "#e8e4ef", { edges: INK });
  kit.box(group, [2.3, 0.85, 1.1], [0, 0.12, -0.05], WALL, { edges: INK });
  for (let column = 0; column < 6; column += 1)
    kit.cylinder(group, 0.06, 0.07, 0.78, [-0.95 + column * 0.38, 0.12, 0.62], WHITE, 10);
  kit.box(group, [2.4, 0.1, 1.35], [0, 0.95, 0.08], "#e8e4ef", { edges: INK });
  kit.gable(group, [2.4, 0.42, 1.35], [0, 1.05, 0.08], "#e8e4ef", { edges: INK, rotY: 0 });
  for (let step = 0; step < 3; step += 1)
    kit.box(group, [2.2 - step * 0.2, 0.04, 0.16], [0, step * 0.04, 0.82 - step * 0.06], "#cfc8dc");
  const pennants = ["#7a4dc2", "#2f6fb2", "#3f5aa8"];
  pennants.forEach((color, index) => {
    const x = -1.35 + index * 0.18;
    kit.cylinder(group, 0.015, 0.015, 0.9, [x, 0, 0.95], DARK, 6);
    kit.box(group, [0.2, 0.12, 0.01], [x + 0.1, 0.72, 0.95], color);
  });
  return group;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                             */
/* ------------------------------------------------------------------ */

export function plateY(id: LayerId) {
  return (id - 1) * PLATE_GAP;
}

export function buildCity(): CityModel {
  const kit = new Kit();
  const root = new THREE.Group();
  const plates = {} as Record<LayerId, THREE.Group>;
  for (const layer of layers) {
    const plate = new THREE.Group();
    plate.position.y = plateY(layer.id);
    plate.userData.layerId = layer.id;
    root.add(plate);
    plates[layer.id] = plate;
    kit.use(`plate-${layer.id}`, () => plateSlab(kit, plate, layer.id));
  }
  const one = buildPlateOne(kit, plates[1]);
  const two = buildPlateTwo(kit, plates[2]);
  const three = buildPlateThree(kit, plates[3]);
  const four = buildPlateFour(kit, plates[4]);

  const neighbor = new THREE.Group();
  root.add(neighbor);
  kit.use("neighbor", () => {
    miniCity(kit, neighbor, 0, 0, 0, 1);
    miniCity(kit, neighbor, 2.6, -0.8, -3.2, 0.62);
  });
  const higher = new THREE.Group();
  root.add(higher);
  kit.use("higher", () => parliament(kit, higher));

  const entityAnchor = {} as Record<EntityId, THREE.Object3D>;
  const put = (id: EntityId, plate: THREE.Object3D, position: Vec) => {
    entityAnchor[id] = kit.anchor(plate, position);
  };
  put("square", plates[1], [SITE.square.x, 0.3, SITE.square.z]);
  put("buildings", plates[1], [SITE.hall.x - 0.4, SITE.hall.h + 0.6, SITE.hall.z]);
  put("energy", plates[1], [SITE.center.x, SITE.center.h + 0.45, SITE.center.z]);
  put("network", plates[1], [SITE.mast.x, 2.2, SITE.mast.z]);
  put("compute", plates[1], [SITE.annex.x, SITE.annex.h + 0.1, SITE.annex.z]);
  put("sensors", plates[2], [4.95, 1.2, 1.05]);
  put("openData", plates[2], [4.95, 1.05, 2.9]);
  put("map", plates[2], [-1.85, 1.5, 2.55]);
  put("analysis", plates[2], [5.2, 1.95, -0.6]);
  put("assembly", plates[3], [SITE.square.x + 0.55, 0.9, SITE.square.z]);
  put("proposal", plates[3], [1.05, 1.1, 2.2]);
  put("council", plates[3], [SITE.hall.x, 0.8, SITE.hall.z]);
  put("ruleCase", plates[3], [5.35, 0.75, SITE.street.z]);
  put("administration", plates[4], [SITE.hall.x, SITE.hall.h + 0.7, SITE.hall.z]);
  put("works", plates[4], [2.6, 0.8, 0.2]);
  put("change", plates[4], [3.3, 1.45, 2.3]);
  put("evaluation", plates[4], [5.45, 1.35, 3.2]);
  put("neighbor", neighbor, [0, 4.2, 0]);
  put("higher", higher, [0, 1.6, 0]);

  const plateAnchors = (position: (id: LayerId) => Vec) =>
    Object.fromEntries(
      layers.map((layer) => [layer.id, kit.anchor(plates[layer.id], position(layer.id))]),
    ) as Record<LayerId, THREE.Object3D>;

  const hexColor = new THREE.Color();
  let lastMeasured = -1;
  const status = [AMBER, "#f2c14b", "#3f9a45"].map((color) => new THREE.Color(color));
  const grey = new THREE.Color("#c8ced6");
  const ringIdle = new THREE.Color("#9aa7b3");
  const ringDone = new THREE.Color("#3f9a45");
  const ringMaterial = four.evaluation.ring.material as THREE.MeshStandardMaterial;
  ringMaterial.userData.base = ringIdle.clone();
  const refresh = (id: Owner) => {
    const owner = kit.owners.get(id);
    if (owner) model.setDim(owner, owner.dim);
  };

  const model: CityModel = {
    root,
    plates,
    neighbor,
    higher,
    owners: kit.owners,
    pickables: kit.pickables,
    anchors: {
      entity: entityAnchor,
      plateLeft: plateAnchors(() => [-PLATE_WIDTH / 2, -PLATE_THICKNESS / 2, PLATE_DEPTH / 2]),
      plateTag: plateAnchors(() => [-PLATE_WIDTH / 2 + 0.35, 0.05, PLATE_DEPTH / 2]),
      plateTagEnd: plateAnchors(() => [PLATE_WIDTH / 2, 0.05, PLATE_DEPTH / 2]),
      squareCenter: plateAnchors(() => [SITE.square.x, 0.04, SITE.square.z]),
      lot: plateAnchors((id) => [SITE.lot.x, id === 1 ? 0.45 : 1.25, SITE.lot.z]),
      center: plateAnchors((id) => [SITE.center.x + 1.25, id === 4 ? 1.25 : 1.05, SITE.center.z + 0.5]),
    },
    setDim(owner, value) {
      owner.dim = value;
      for (const material of owner.materials) {
        if (material.userData.fade) {
          material.opacity = material.userData.baseOpacity * (1 - value * 0.8);
          material.visible = material.opacity > 0.01;
        }
        const base = material.userData.base as THREE.Color | undefined;
        if (base && "color" in material && material.color instanceof THREE.Color)
          material.color.copy(base).lerp(PAPER_COLOR, value * 0.72);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.copy(material.userData.baseEmissiveColor).lerp(PAPER_COLOR, value);
          material.emissiveIntensity = THREE.MathUtils.lerp(material.userData.baseEmissive, 0.3, value);
        }
      }
    },
    applyCues(state, time) {
      const grow = (object: THREE.Object3D, amount: number, base = 1) => {
        const eased = THREE.MathUtils.smoothstep(amount, 0, 1);
        object.scale.setScalar(Math.max(eased, 0.0001) * base);
        object.visible = eased > 0.01;
      };
      one.squareMaterial.userData.baseEmissive = state.heat * 0.34;
      one.foundationTrees.forEach((tree) => grow(tree, state.foundation, 0.62));
      one.waves.forEach((wave, index) => {
        const pulse = time ? (Math.sin(time * 3 - index * 0.9) + 1) / 2 : 1;
        wave.visible = state.radio > 0.02;
        wave.scale.setScalar(0.6 + state.radio * (0.4 + pulse * 0.25));
      });

      if (Math.abs(state.measured - lastMeasured) > 0.001) {
        lastMeasured = state.measured;
        const matrix = new THREE.Matrix4();
        two.hex.positions.forEach(([x, z], index) => {
          const value = THREE.MathUtils.lerp(two.hex.before[index], two.hex.after[index], state.measured);
          matrix.makeScale(1, 0.05 + value * 0.16, 1);
          matrix.setPosition(x, 0.005, z);
          two.hex.mesh.setMatrixAt(index, matrix);
          two.hex.mesh.setColorAt(index, heatColor(value, hexColor));
        });
        two.hex.mesh.instanceMatrix.needsUpdate = true;
        if (two.hex.mesh.instanceColor) two.hex.mesh.instanceColor.needsUpdate = true;
        two.hex.mesh.computeBoundingSphere();
      }
      grow(two.scenario, state.scenario);
      grow(two.reports, state.reports);
      two.housing.visible = state.housingScenario > 0.02;
      two.housing.scale.set(1, Math.max(state.housingScenario, 0.001), 1);

      grow(three.options, state.options);
      grow(three.decision, state.decided);
      grow(three.housingProposal, state.housingProposal);

      four.change.trees.forEach((tree, index) =>
        grow(tree, THREE.MathUtils.clamp(state.delivered * 1.6 - index * 0.15, 0, 1), 0.95),
      );
      grow(four.change.sail, THREE.MathUtils.clamp(state.delivered * 1.4 - 0.3, 0, 1));
      grow(four.change.water, THREE.MathUtils.clamp(state.delivered * 1.4 - 0.4, 0, 1));
      four.change.sitting.forEach((figure) => grow(figure, THREE.MathUtils.clamp(state.delivered * 2 - 1, 0, 1)));
      four.change.benches.forEach((item) => grow(item, THREE.MathUtils.clamp(state.delivered * 2 - 0.6, 0, 1)));

      const build = state.construction;
      four.construction.building.visible = build > 0.02;
      four.construction.building.scale.set(1, Math.max(build, 0.001), 1);
      four.construction.scaffold.visible = build > 0.02 && build < 0.98;
      four.construction.fence.visible = build < 0.98;

      const progress = Math.max(state.delivered, state.construction);
      four.admin.board.dots.forEach((dot, index) => {
        const reached =
          index === 0 ? state.decided > 0.5 || progress > 0 : index === 1 ? progress > 0.05 : progress > 0.98;
        (dot.material as THREE.MeshStandardMaterial).userData.base = reached ? status[index] : grey;
      });
      const alarm = state.warning;
      four.admin.alarm.group.visible = alarm > 0.02;
      const blink = time ? (Math.sin(time * 6) + 1) / 2 : 1;
      four.admin.alarm.ring.scale.setScalar(0.6 + alarm * (0.5 + blink * 0.6));
      grow(four.assistance.sign, alarm);
      four.assistance.arrivals.forEach((figure) => grow(figure, alarm));

      ringMaterial.userData.base.copy(ringIdle).lerp(ringDone, state.evaluated);
      ringMaterial.userData.baseEmissive = state.evaluated * 0.6;
      four.evaluation.needle.rotation.z = THREE.MathUtils.lerp(0.6, -0.4, state.evaluated);
      refresh("square");
      refresh("administration");
      refresh("evaluation");
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(kit.extraGeometries);
      const materials = new Set<THREE.Material>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.LineLoop) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      kit.textures.forEach((texture) => texture.dispose());
    },
  };
  return model;
}
