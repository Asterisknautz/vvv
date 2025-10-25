// src/ideas/004.ts
// "4×4ワイヤーフレーム・ミニパッド" のための設計ブループリント。
// コード実装は含めず、Three.js / Vite プロジェクトでの構築指針を整理している。

import type { SceneContext } from "../threeScene";

export type Idea004EffectMode = "oneshot" | "momentary" | "latch";
export type Idea004EffectType = "post" | "overlay" | "geo";

export interface Idea004InteractionSpec {
  tapTempo: boolean;
  quantizeSteps: ("1/4" | "1/8" | "1/16" | "off")[];
  latchOnDoubleTap: boolean;
  twoFingerBoost: number;
}

export interface Idea004EffectSpec {
  key: string;
  name: string;
  type: Idea004EffectType;
  mode: Idea004EffectMode;
  xyMap: Record<string, string>;
}

export interface Idea004LimitsSpec {
  maxActivePost: number;
  maxActiveGeo: number;
}

export interface Idea004CleanupPolicy {
  disposeGeometries: boolean;
  disposeMaterials: boolean;
  cancelRaf: boolean;
}

export interface Idea004Blueprint {
  id: string;
  name: string;
  palette: {
    background: string;
    foreground: string;
    accent: string;
  };
  camera: {
    fov: number;
    position: [number, number, number];
  };
  fog: {
    color: string;
    near: number;
    far: number;
  };
  ui: {
    grid: {
      rows: number;
      cols: number;
      style: "wireframe";
      accent: string;
      interaction: Idea004InteractionSpec;
    };
    hud: {
      showsBpm: boolean;
      showsTapTempo: boolean;
      showsQuantize: boolean;
    };
  };
  timing: {
    bpm: number;
    quantize: "1/4" | "1/8" | "1/16" | "off";
    scheduler: "next_grid";
  };
  effects: Idea004EffectSpec[];
  limits: Idea004LimitsSpec;
  cleanup: Idea004CleanupPolicy;
  implementationNotes: string[];
  lookAndFeel: string[];
}

export const idea004Blueprint: Idea004Blueprint = {
  id: "004",
  name: "mini-pad-vj",
  palette: {
    background: "#191925",
    foreground: "#e6e6f6",
    accent: "#9aa3ff",
  },
  camera: {
    fov: 60,
    position: [4, 3, 6],
  },
  fog: {
    color: "#191925",
    near: 6,
    far: 18,
  },
  ui: {
    grid: {
      rows: 4,
      cols: 4,
      style: "wireframe",
      accent: "#9aa3ff",
      interaction: {
        tapTempo: true,
        quantizeSteps: ["1/4", "1/8", "1/16", "off"],
        latchOnDoubleTap: true,
        twoFingerBoost: 1.25,
      },
    },
    hud: {
      showsBpm: true,
      showsTapTempo: true,
      showsQuantize: true,
    },
  },
  timing: {
    bpm: 120,
    quantize: "1/8",
    scheduler: "next_grid",
  },
  effects: [
    { key: "r1c1", name: "bloom-kick", type: "post", mode: "oneshot", xyMap: { x: "threshold", y: "radius" } },
    { key: "r1c2", name: "chroma-punch", type: "post", mode: "momentary", xyMap: { x: "angle", y: "distance" } },
    { key: "r1c3", name: "white-strobe", type: "post", mode: "oneshot", xyMap: { x: "width", y: "curve" } },
    { key: "r1c4", name: "tiltshift-sweep", type: "post", mode: "latch", xyMap: { x: "focus", y: "spread" } },
    { key: "r2c1", name: "ripple-torus", type: "geo", mode: "oneshot", xyMap: { x: "radius", y: "thickness" } },
    { key: "r2c2", name: "metaball-splash", type: "geo", mode: "momentary", xyMap: { x: "viscosity", y: "count" } },
    { key: "r2c3", name: "light-fan", type: "overlay", mode: "momentary", xyMap: { x: "arc", y: "falloff" } },
    { key: "r2c4", name: "kaleido-tri", type: "post", mode: "latch", xyMap: { x: "segments", y: "rotation" } },
    { key: "r3c1", name: "pixel-shift", type: "post", mode: "momentary", xyMap: { x: "amplitude", y: "freq" } },
    { key: "r3c2", name: "scanline-film", type: "post", mode: "latch", xyMap: { x: "density", y: "grain" } },
    { key: "r3c3", name: "polar-distort", type: "post", mode: "momentary", xyMap: { x: "radius", y: "angle" } },
    { key: "r3c4", name: "crt-gate", type: "post", mode: "oneshot", xyMap: { x: "gate", y: "glow" } },
    { key: "r4c1", name: "fog-pulse", type: "overlay", mode: "latch", xyMap: { x: "density", y: "height" } },
    { key: "r4c2", name: "vignette-drift", type: "post", mode: "latch", xyMap: { x: "radius", y: "softness" } },
    { key: "r4c3", name: "displacement-wave", type: "post", mode: "momentary", xyMap: { x: "amp", y: "speed" } },
    { key: "r4c4", name: "vector-ribbons", type: "geo", mode: "momentary", xyMap: { x: "curl", y: "width" } },
  ],
  limits: {
    maxActivePost: 3,
    maxActiveGeo: 2,
  },
  cleanup: {
    disposeGeometries: true,
    disposeMaterials: true,
    cancelRaf: true,
  },
  implementationNotes: [
    "Pad UIはRaycasterを用いたメッシュヒット、またはDOMレイヤでのPointerEventsからEventBusへ橋渡しする。",
    "Effect APIは trigger/update/release を共通IFとしてエフェクトをモジュール化する。",
    "ClockとQuantizerで次グリッドへのスケジューリングを行い、テンポと同期させる。",
    "Post-processingチェーンはFXAAの後に個別パス、Bloomを控えめに追加する。",
    "モバイルではhalf-resバッファと事前生成したノイズテクスチャを用いてパフォーマンスを確保する。",
  ],
  lookAndFeel: [
    "背景#191925に対して前景#e6e6f6、アクセント#9aa3ffで柔らかいコントラストを構成する。",
    "発光はキックから指数減衰で尾を引かせ、スミアを抑えたソフトグローに留める。",
    "霧やビネットは薄く掛け、黒を潰さずに空気感を与える。",
    "量子化された発火とスイープ表現で音がなくてもリズム感を伝える。",
  ],
};

export default function idea004(_: SceneContext) {
  console.info("idea004 is a design-only blueprint; implement rendering logic separately.");
  return () => {};
}
