// src/ideas/005.ts
// "Radiant Polygons — 同心回転する放射ブロック" のための設計仕様。
// Three.js + post-processing による演出を前提に、パラメータと実装フローを整理する。

import type { SceneContext } from "../threeScene";

export type Idea005PolygonSides = 3 | 4 | 5 | 6 | 7 | 8;

export interface Idea005Palette {
  background: string;
  baseTint: string;
  accent: string;
}

export interface Idea005PolygonShapeSpec {
  sidesRange: [Idea005PolygonSides, Idea005PolygonSides];
  radiusRange: [number, number];
  heightRange: [number, number];
  thicknessRange: [number, number];
  reusePool: number;
}

export interface Idea005RingLayoutSpec {
  rings: number;
  totalCount: number;
  radiusInner: number;
  ringGap: number;
  angleJitter: number;
  radialJitter: number;
  verticalJitter: number;
  counterRotationProbability: number;
}

export interface Idea005MotionSpec {
  globalSpinBase: number;
  globalSpinVariation: number;
  easePeriod: number;
  easeStrength: number;
  ringPhaseOffsets: number[];
  localTiltRange: [number, number];
  localSpinRange: [number, number];
  driftNoiseScale: number;
}

export interface Idea005LightingSpec {
  hemisphere: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  directional: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  rim: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  exposure: number;
}

export interface Idea005MaterialSpec {
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenTint: string;
  envIntensity: number;
  envMap: "RoomEnvironment";
  highlightColor: string;
}

export interface Idea005AfterimageSpec {
  enabled: boolean;
  decay: number;
  dprMax: number;
}

export interface Idea005BloomSpec {
  threshold: number;
  strength: number;
  radius: number;
  selectiveLayers: number[];
}

export interface Idea005RadialBlurSpec {
  enabled: boolean;
  intervalRange: [number, number];
  durationRange: [number, number];
  strengthRange: [number, number];
  tapCount: number;
}

export interface Idea005PostProcessingSpec {
  fxaa: boolean;
  afterimage: Idea005AfterimageSpec;
  bloom: Idea005BloomSpec;
  radialBlur: Idea005RadialBlurSpec;
  toneMapping: "ACESFilmic";
  toneExposureRange: [number, number];
}

export interface Idea005InteractionSpec {
  enableOrbitDrag: boolean;
  orbit: {
    damping: number;
    minPolar: number;
    maxPolar: number;
  };
  rippleTorus: boolean;
  impulseBoost: {
    duration: number;
    multiplier: number;
    easing: "quintOut";
  };
  radialBlurTrigger: {
    duration: number;
    strengthMultiplier: number;
  };
}

export interface Idea005ImplementationNote {
  title: string;
  detail: string;
}

export interface Idea005Blueprint {
  id: string;
  name: string;
  palette: Idea005Palette;
  camera: {
    fov: number;
    position: [number, number, number];
    target: [number, number, number];
  };
  fog: {
    color: string;
    near: number;
    far: number;
  };
  geometry: Idea005PolygonShapeSpec;
  layout: Idea005RingLayoutSpec;
  motion: Idea005MotionSpec;
  lighting: Idea005LightingSpec;
  materials: Idea005MaterialSpec;
  post: Idea005PostProcessingSpec;
  interactions: Idea005InteractionSpec;
  parameters: Record<string, [number, number] | string | number | boolean>;
  implementationNotes: Idea005ImplementationNote[];
  cleanup: {
    disposeGeometries: boolean;
    disposeMaterials: boolean;
    disposePmrem: boolean;
    stopComposer: boolean;
  };
}

export const idea005Blueprint: Idea005Blueprint = {
  id: "005",
  name: "radiant-polygons",
  palette: {
    background: "#191925",
    baseTint: "#e6e6f6",
    accent: "#9aa3ff",
  },
  camera: {
    fov: 50,
    position: [0, 3.4, 7.2],
    target: [0, 0.6, 0],
  },
  fog: {
    color: "#11111d",
    near: 9,
    far: 24,
  },
  geometry: {
    sidesRange: [3, 8],
    radiusRange: [0.28, 1.4],
    heightRange: [0.4, 1.8],
    thicknessRange: [0.08, 0.28],
    reusePool: 12,
  },
  layout: {
    rings: 3,
    totalCount: 180,
    radiusInner: 1.6,
    ringGap: 1.05,
    angleJitter: 0.22,
    radialJitter: 0.28,
    verticalJitter: 0.32,
    counterRotationProbability: 0.45,
  },
  motion: {
    globalSpinBase: 0.08,
    globalSpinVariation: 0.2,
    easePeriod: 9.5,
    easeStrength: 0.2,
    ringPhaseOffsets: [0, Math.PI * -0.35, Math.PI * 0.5],
    localTiltRange: [0.03, 0.18],
    localSpinRange: [-0.35, 0.42],
    driftNoiseScale: 0.18,
  },
  lighting: {
    hemisphere: {
      skyColor: "#25253a",
      groundColor: "#0c0c15",
      intensity: 0.65,
    },
    directional: {
      color: "#f0f4ff",
      intensity: 1.35,
      position: [4.2, 6.5, 3.1],
    },
    rim: {
      color: "#9aa3ff",
      intensity: 0.55,
      position: [-3.5, 5.0, -4.4],
    },
    exposure: 0.05,
  },
  materials: {
    metalness: 0.28,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    sheen: 0.18,
    sheenTint: "#9aa3ff",
    envIntensity: 0.9,
    envMap: "RoomEnvironment",
    highlightColor: "#9aa3ff",
  },
  post: {
    fxaa: true,
    afterimage: { enabled: true, decay: 0.88, dprMax: 2 },
    bloom: {
      threshold: 1.25,
      strength: 0.72,
      radius: 0.46,
      selectiveLayers: [1],
    },
    radialBlur: {
      enabled: true,
      intervalRange: [0.6, 1.2],
      durationRange: [0.08, 0.12],
      strengthRange: [0.32, 0.58],
      tapCount: 10,
    },
    toneMapping: "ACESFilmic",
    toneExposureRange: [-0.1, 0.2],
  },
  interactions: {
    enableOrbitDrag: true,
    orbit: {
      damping: 0.1,
      minPolar: 0.45,
      maxPolar: 1.35,
    },
    rippleTorus: true,
    impulseBoost: {
      duration: 0.9,
      multiplier: 1.7,
      easing: "quintOut",
    },
    radialBlurTrigger: {
      duration: 0.1,
      strengthMultiplier: 1.3,
    },
  },
  parameters: {
    count_total: [120, 240],
    rings: [2, 4],
    radius_inner: [1.0, 2.1],
    ring_gap: [0.8, 1.4],
    angle_jitter: [0, 0.35],
    radial_jitter: [0, 0.4],
    sides_min: 3,
    sides_max: 8,
    height_range: [0.4, 1.8],
    thickness_range: [0.06, 0.3],
    spin_base: [0.05, 0.12],
    spin_variation: [0.12, 0.28],
    ring_counter_rot_prob: [0.25, 0.6],
    afterimage_decay: [0.82, 0.92],
    burst_blur_strength: [0.25, 0.65],
    burst_interval: [0.6, 1.2],
    burst_duration: [0.08, 0.12],
    dir_intensity: [1.0, 1.6],
    rim_intensity: [0.3, 0.7],
    env_intensity: [0.6, 1.1],
    bloom_threshold: [1.1, 1.4],
    bloom_strength: [0.6, 0.9],
    base_tint: "#e6e6f6",
    accent: "#9aa3ff",
    bg: "#191925",
  },
  implementationNotes: [
    {
      title: "Geometry batching",
      detail:
        "ランダム多角形を複数プリセットとしてExtrudeGeometryで生成し、InstancedMesh化して配置。pool数をreusePoolで管理する。",
    },
    {
      title: "Ring distribution",
      detail:
        "リングごとに中心角Δθを算出し、ノイズでジッター。内外方向にも微小ノイズを与えて規則性を崩す。",
    },
    {
      title: "Global spin modulation",
      detail:
        "clock経過時間をもとにquintInOutイーズのLFOを組み合わせ、±20%の速度変化を周期的に付与する。",
    },
    {
      title: "Local wobble",
      detail:
        "各プリズムに対してランダム軸を生成し、ピッチ/ヨーの微小揺動と角速度差を設定。noiseベースで位相をずらす。",
    },
    {
      title: "Selective bloom",
      detail:
        "リムハイライト用にonBeforeCompileでviewDotNormalに応じたエミッシブ成分を追加し、Bloom対象レイヤへ切り替える。",
    },
    {
      title: "Accumulation buffer",
      detail:
        "AfterimagePassをcomposerに組み込み、decay=0.88で長い残像を表現。DPRは2までに制限する。",
    },
    {
      title: "Radial burst blur",
      detail:
        "クリックまたは一定間隔でShaderPassによるスクリーンスペース放射ブラーを80-120msだけ有効化。強度は回転速度に連動。",
    },
    {
      title: "Interaction impulse",
      detail:
        "clickイベントでRaycasterから近傍インスタンスを探索し、角速度をmultiplier倍にブーストしてからquintOutで減衰させる。",
    },
    {
      title: "Cleanup",
      detail:
        "InstancedMesh/Material/PMREMGenerator/EffectPassを全てdisposeし、requestAnimationFrameとcomposerループを停止。",
    },
  ],
  cleanup: {
    disposeGeometries: true,
    disposeMaterials: true,
    disposePmrem: true,
    stopComposer: true,
  },
};

export type Idea005BlueprintExport = typeof idea005Blueprint;

export type Idea005Context = SceneContext;

export default function idea005(_: SceneContext) {
  console.info("idea005 is a design-only blueprint; implement rendering logic separately.");
  return () => {};
}
