// src/ideas/003.ts
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import type { SceneContext } from "../threeScene";

type Mode = "shader" | "wireframe" | "monochrome";

type Fish = {
  group: THREE.Group;
  body: THREE.Mesh;
  tail: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  tailMaterial: THREE.MeshStandardMaterial;
  radius: number;
  baseHeight: number;
  sway: number;
  speed: number;
  offset: number;
  roll: number;
};

const MODES: Mode[] = ["shader", "wireframe", "monochrome"];

const refractionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uDistortion: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDistortion;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float t = 0.0;
      float amp = 0.55;
      float freq = 1.5;
      for (int i = 0; i < 4; i++) {
        t += noise(p * freq) * amp;
        freq *= 1.9;
        amp *= 0.55;
      }
      return t;
    }

    void main() {
      vec2 uv = vUv;
      float time = uTime * 0.08;
      vec2 flow = vec2(
        fbm(vec2(uv.y * 2.2 + time * 0.6, time * 0.4)) - 0.5,
        fbm(vec2(uv.x * 1.8 - time * 0.5, time * 0.35 + 3.4)) - 0.5
      );
      uv += flow * 0.015 * uDistortion;
      vec4 color = texture2D(tDiffuse, uv);
      gl_FragColor = color;
    }
  `,
};

const monochromeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uIntensity;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float g = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 mixed = mix(color.rgb, vec3(g), clamp(uIntensity, 0.0, 1.0));
      gl_FragColor = vec4(mixed, color.a);
    }
  `,
};

const causticsShader = {
  uniforms: {
    uTime: { value: 0 },
    uIntensity: { value: 0.4 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;

    float wave(vec2 p, float shift) {
      float t = uTime * 0.5 + shift;
      vec2 q = vec2(
        sin(p.x * 8.0 + t * 2.2),
        cos(p.y * 9.0 - t * 2.5)
      );
      return sin(q.x + q.y + shift * 2.0);
    }

    void main() {
      vec2 uv = vUv * 4.0;
      float c = wave(uv, 0.0) + wave(uv * 1.3, 1.7) * 0.7 + wave(uv * 0.9 + 0.3, 3.2) * 0.5;
      c = smoothstep(0.6, 1.4, c);
      vec3 color = vec3(0.22, 0.33, 0.66) * c * uIntensity;
      gl_FragColor = vec4(color, c * 0.4 * uIntensity);
    }
  `,
};

export default function idea003({ scene, camera, renderer, root, clock }: SceneContext) {
  const ideaRoot = new THREE.Group();
  root.add(ideaRoot);

  const disposableMaterials = new Set<THREE.Material>();
  const disposableGeometries = new Set<THREE.BufferGeometry>();

  const registerMaterial = (material: THREE.Material) => {
    disposableMaterials.add(material);
    return material;
  };

  const registerGeometry = (geometry: THREE.BufferGeometry) => {
    disposableGeometries.add(geometry);
    return geometry;
  };

  const originalFog = scene.fog;
  scene.fog = new THREE.Fog(0x191925, 2, 10);

  const originalToneMapping = renderer.toneMapping;
  const originalExposure = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const originalClear = renderer.getClearColor(new THREE.Color()).clone();
  const originalClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x191925, 1);

  const originalBackground = scene.background;
  scene.background = null;

  const previousLights: { light: THREE.Light; visible: boolean }[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) {
      previousLights.push({ light: obj, visible: obj.visible });
      obj.visible = false;
    }
  });

  const hemi = new THREE.HemisphereLight(0x9aa3ff, 0x191925, 0.6);
  const dir = new THREE.DirectionalLight(0xb5c3ff, 0.38);
  dir.position.set(-2.4, 3.2, 2.2);
  dir.target.position.set(0.3, 0.4, -0.4);
  ideaRoot.add(hemi, dir, dir.target);

  const fishGroup = new THREE.Group();
  fishGroup.position.y = 0.6;
  ideaRoot.add(fishGroup);

  const fishBodyGeometry = registerGeometry(new THREE.CapsuleGeometry(0.18, 0.48, 6, 16));
  const fishTailGeometry = registerGeometry(new THREE.PlaneGeometry(0.32, 0.42, 1, 6));
  fishTailGeometry.translate(-0.16, 0, 0);

  const fishes: Fish[] = [];
  const fishColors = [0x7f8cff, 0x9eb4ff, 0x6b7bdc];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group();
    group.scale.setScalar(1 - i * 0.12);

    const bodyMaterial = registerMaterial(
      new THREE.MeshStandardMaterial({
        color: fishColors[i % fishColors.length],
        roughness: 0.25,
        metalness: 0.15,
        emissive: new THREE.Color(0x1a1f36),
        emissiveIntensity: 0.35,
      })
    ) as THREE.MeshStandardMaterial;
    const body = new THREE.Mesh(fishBodyGeometry, bodyMaterial);

    const tailMaterial = registerMaterial(
      new THREE.MeshStandardMaterial({
        color: fishColors[(i + 1) % fishColors.length],
        roughness: 0.45,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      })
    ) as THREE.MeshStandardMaterial;
    const tail = new THREE.Mesh(fishTailGeometry, tailMaterial);
    tail.position.set(-0.24, 0, 0);
    tail.rotation.y = Math.PI / 2;

    body.add(tail);
    group.add(body);
    fishGroup.add(group);

    fishes.push({
      group,
      body,
      tail,
      bodyMaterial,
      tailMaterial,
      radius: 1.6 + i * 0.4,
      baseHeight: 0.2 + i * 0.18,
      sway: 0.32 + i * 0.08,
      speed: 0.22 + i * 0.05,
      offset: Math.random() * Math.PI * 2,
      roll: (Math.random() - 0.5) * 0.2,
    });
  }

  const bubbleCount = 520;
  const bubbleGeometry = registerGeometry(new THREE.BufferGeometry());
  const basePositions = new Float32Array(bubbleCount * 3);
  const timeOffsets = new Float32Array(bubbleCount);
  const scales = new Float32Array(bubbleCount);
  const lifetimes = new Float32Array(bubbleCount);

  for (let i = 0; i < bubbleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.4 + Math.random() * 2.2;
    basePositions[i * 3] = Math.cos(angle) * radius;
    basePositions[i * 3 + 1] = -1.8 - Math.random() * 1.2;
    basePositions[i * 3 + 2] = Math.sin(angle) * radius;
    timeOffsets[i] = Math.random();
    scales[i] = Math.random();
    lifetimes[i] = 0.6 + Math.random() * 0.4;
  }

  bubbleGeometry.setAttribute("aBase", new THREE.Float32BufferAttribute(basePositions, 3));
  bubbleGeometry.setAttribute("aOffset", new THREE.Float32BufferAttribute(timeOffsets, 1));
  bubbleGeometry.setAttribute("aScale", new THREE.Float32BufferAttribute(scales, 1));
  bubbleGeometry.setAttribute("aLife", new THREE.Float32BufferAttribute(lifetimes, 1));

  const bubbleUniforms = {
    uTime: { value: 0 },
    uMode: { value: 0 },
  };

  const bubbleMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: bubbleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
      vertexShader: /* glsl */ `
        attribute vec3 aBase;
        attribute float aOffset;
        attribute float aScale;
        attribute float aLife;

        uniform float uTime;
        uniform float uMode;

        varying float vAlpha;
        varying float vDepth;
        varying float vHighlight;

        float easeOut(float t) {
          return 1.0 - pow(1.0 - t, 2.4);
        }

        void main() {
          float cycle = uTime * 0.1 + aOffset;
          float phase = fract(cycle);
          float rise = phase * (2.6 + aLife * 1.8);
          vec3 pos = aBase;
          pos.y += rise;
          float sway = sin((cycle + pos.x) * 6.2831) * 0.12;
          float drift = cos((cycle + pos.z) * 5.2831) * 0.08;
          pos.x += sway * (0.6 + aScale * 0.6);
          pos.z += drift * (0.4 + aScale * 0.7);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float dist = -mvPosition.z;
          float size = mix(1.2, 3.0, aScale) * (1.0 - phase * 0.35);
          size *= mix(1.0, 1.6, uMode);
          gl_PointSize = size * (280.0 / max(dist, 0.1));

          vAlpha = smoothstep(0.04, 0.12, phase) * (1.0 - smoothstep(0.78, 0.98, phase));
          vDepth = clamp((dist - 0.8) / 6.0, 0.0, 1.0);
          vHighlight = mix(0.6, 1.1, aScale);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uMode;
        varying float vAlpha;
        varying float vDepth;
        varying float vHighlight;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = dot(uv, uv);
          if (r > 1.0) discard;
          float softness = smoothstep(1.0, 0.0, r);
          float rim = smoothstep(0.32, 0.92, r);
          float inner = smoothstep(0.0, 0.78, 1.0 - r);
          vec3 color = mix(vec3(0.58, 0.72, 1.0), vec3(0.85, 0.92, 1.0), rim * 0.8);
          color += vec3(1.4, 1.5, 1.6) * inner * 0.35 * vHighlight;
          color = mix(color, vec3(0.78), clamp(uMode * 0.9, 0.0, 1.0));
          float alpha = vAlpha * softness * vDepth;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })
  ) as THREE.ShaderMaterial;

  const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial);
  bubbles.position.y = -0.3;
  ideaRoot.add(bubbles);

  const causticsGeometry = registerGeometry(new THREE.PlaneGeometry(8, 8, 1, 1));
  const causticsMaterial = registerMaterial(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.4 },
      },
      vertexShader: causticsShader.vertexShader,
      fragmentShader: causticsShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  ) as THREE.ShaderMaterial;
  const caustics = new THREE.Mesh(causticsGeometry, causticsMaterial);
  caustics.rotation.x = -Math.PI / 2;
  caustics.position.y = 1.4;
  caustics.renderOrder = -1;
  ideaRoot.add(caustics);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const refractionPass = new ShaderPass(refractionShader);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.9, 0.55);
  bloomPass.threshold = 0.76;
  bloomPass.strength = 0.75;
  bloomPass.radius = 0.45;
  const monochromePass = new ShaderPass(monochromeShader);
  const fxaaPass = new ShaderPass(FXAAShader);

  composer.addPass(renderPass);
  composer.addPass(refractionPass);
  composer.addPass(bloomPass);
  composer.addPass(monochromePass);
  composer.addPass(fxaaPass);

  const drawingBufferSize = new THREE.Vector2();
  renderer.getDrawingBufferSize(drawingBufferSize);
  composer.setSize(drawingBufferSize.x, drawingBufferSize.y);
  bloomPass.setSize(drawingBufferSize.x, drawingBufferSize.y);
  fxaaPass.material.uniforms["resolution"].value.set(1 / drawingBufferSize.x, 1 / drawingBufferSize.y);
  let composerWidth = drawingBufferSize.x;
  let composerHeight = drawingBufferSize.y;

  const syncComposerSize = () => {
    renderer.getDrawingBufferSize(drawingBufferSize);
    if (drawingBufferSize.x !== composerWidth || drawingBufferSize.y !== composerHeight) {
      composerWidth = drawingBufferSize.x;
      composerHeight = drawingBufferSize.y;
      composer.setSize(composerWidth, composerHeight);
      bloomPass.setSize(composerWidth, composerHeight);
      fxaaPass.material.uniforms["resolution"].value.set(1 / composerWidth, 1 / composerHeight);
    }
  };

  const onResize = () => {
    composerWidth = -1;
    composerHeight = -1;
  };
  window.addEventListener("resize", onResize);

  const originalRender = renderer.render.bind(renderer);
  const overrideRender = (sceneToRender: THREE.Scene, cameraToRender: THREE.Camera) => {
    if (sceneToRender === scene && cameraToRender === camera) {
      renderer.render = originalRender;
      composer.render();
      renderer.render = overrideRender as typeof renderer.render;
    } else {
      originalRender(sceneToRender, cameraToRender);
    }
  };
  renderer.render = overrideRender as typeof renderer.render;

  const canvas = renderer.domElement;
  let modeIndex = 0;

  const updateWireframe = (enabled: boolean) => {
    fishes.forEach((fish) => {
      fish.bodyMaterial.wireframe = enabled;
      fish.tailMaterial.wireframe = enabled;
      fish.tailMaterial.opacity = enabled ? 1 : 0.75;
    });
  };

  const setMode = (mode: Mode) => {
    switch (mode) {
      case "shader":
        updateWireframe(false);
        bubbleUniforms.uMode.value = 0.0;
        refractionPass.uniforms.uDistortion.value = 1.0;
        bloomPass.strength = 0.8;
        monochromePass.uniforms.uIntensity.value = 0;
        causticsMaterial.uniforms.uIntensity.value = 0.45;
        renderer.toneMappingExposure = 1.12;
        break;
      case "wireframe":
        updateWireframe(true);
        bubbleUniforms.uMode.value = 0.25;
        refractionPass.uniforms.uDistortion.value = 0.6;
        bloomPass.strength = 0.3;
        monochromePass.uniforms.uIntensity.value = 0.15;
        causticsMaterial.uniforms.uIntensity.value = 0.28;
        renderer.toneMappingExposure = 1.0;
        break;
      case "monochrome":
        updateWireframe(false);
        bubbleUniforms.uMode.value = 0.8;
        refractionPass.uniforms.uDistortion.value = 0.8;
        bloomPass.strength = 0.4;
        monochromePass.uniforms.uIntensity.value = 0.85;
        causticsMaterial.uniforms.uIntensity.value = 0.18;
        renderer.toneMappingExposure = 0.94;
        break;
    }
  };

  setMode(MODES[modeIndex]);

  const onPointerDown = () => {
    modeIndex = (modeIndex + 1) % MODES.length;
    setMode(MODES[modeIndex]);
  };
  canvas.addEventListener("pointerdown", onPointerDown);

  let rafId = 0;
  let running = true;
  let previousTime = performance.now();
  const tmpNext = new THREE.Vector3();

  const loop = () => {
    if (!running) return;
    const now = performance.now();
    previousTime = now;

    syncComposerSize();

    const elapsed = clock.getElapsedTime();
    bubbleUniforms.uTime.value = elapsed;
    refractionPass.uniforms.uTime.value = elapsed;
    causticsMaterial.uniforms.uTime.value = elapsed;

    fishes.forEach((fish) => {
      const angle = elapsed * fish.speed + fish.offset;
      const radius = fish.radius;
      const height = fish.baseHeight + Math.sin(elapsed * (0.4 + fish.speed * 0.8) + fish.offset) * 0.2;
      fish.group.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);

      tmpNext.set(Math.cos(angle + 0.05) * radius, height, Math.sin(angle + 0.05) * radius);
      fish.group.lookAt(tmpNext);
      fish.group.rotateY(Math.PI);
      fish.group.rotation.z += (fish.roll - fish.group.rotation.z) * 0.02;

      const tailSwing = Math.sin(elapsed * 4.2 + fish.offset * 1.5) * (0.5 + fish.sway * 0.4);
      fish.tail.rotation.y = Math.PI / 2 + tailSwing * 0.6;

      const breath = 1 + Math.sin(elapsed * 1.6 + fish.offset) * 0.04;
      fish.body.scale.z = breath;
      fish.body.scale.y = 1 + Math.sin(elapsed * 1.1 + fish.offset) * 0.02;

      const tilt = Math.cos(elapsed * 0.9 + fish.offset) * 0.08;
      fish.group.rotation.x += (tilt - fish.group.rotation.x) * 0.1;
    });

    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("resize", onResize);
    renderer.render = originalRender;

    scene.fog = originalFog ?? null;
    renderer.setClearColor(originalClear, originalClearAlpha);
    renderer.toneMapping = originalToneMapping;
    renderer.toneMappingExposure = originalExposure;
    scene.background = originalBackground ?? null;

    previousLights.forEach(({ light, visible }) => {
      light.visible = visible;
    });

    composer.dispose();
    refractionPass.material.dispose();
    monochromePass.material.dispose();
    fxaaPass.material.dispose();

    ideaRoot.removeFromParent();
    ideaRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => disposableMaterials.add(mat));
        } else if (mesh.material) {
          disposableMaterials.add(mesh.material as THREE.Material);
        }
        if (mesh.geometry) {
          disposableGeometries.add(mesh.geometry as THREE.BufferGeometry);
        }
      }
    });

    disposableMaterials.forEach((mat) => mat.dispose());
    disposableGeometries.forEach((geo) => geo.dispose());
  };
}
