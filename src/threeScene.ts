// src/threeScene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type IdeaModule = (ctx: SceneContext) => void | (() => void);

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group; // idea をぶら下げる
  clock: THREE.Clock;
  solarSystem: THREE.Group | null;
}

type SceneTransition = (options: TransitionOptions) => Promise<void>;

interface TransitionOptions {
  app: ThreeApp;
  currentId: string | null;
  nextId: string | null;
  loadNext: () => Promise<void>;
  isMobile: boolean;
}

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class ThreeApp {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  floor: THREE.Mesh;
  root = new THREE.Group();
  clock = new THREE.Clock();
  cleanupIdea: (() => void) | null = null;
  solarSystemRoot: THREE.Group | null = null;
  private fadeOverlay: HTMLElement | null = null;
  private fadeDurationMs = 450;
  private currentIdeaId: string | null = null;
  private transitionStage: HTMLDivElement | null = null;
  private transitions: SceneTransition[] = [];
  private lightweightTransitions: SceneTransition[] = [];
  private rendererSize = new THREE.Vector2();
  private resizeTarget = new THREE.Vector2();
  private pendingPixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.getSize(this.rendererSize);
    this.resizeTarget.copy(this.rendererSize);
    this.pendingPixelRatio = dpr;

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(4, 3, 6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.fog = new THREE.FogExp2(0x191925, 0.06);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 1.0);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    this.scene.add(hemi, dir);

    const floorGeo = new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.1, roughness: 0.9 });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.scene.add(this.floor);

    this.initSolarSystem();

    this.scene.add(this.root);

    this.fadeOverlay = document.getElementById("scene-fade");
    this.transitionStage = document.getElementById("transition-stage") as HTMLDivElement | null;
    if (!this.transitionStage) {
      this.transitionStage = document.createElement("div");
      this.transitionStage.id = "transition-stage";
      canvas.parentElement?.appendChild(this.transitionStage);
    }

    this.transitions = [
      deepZoomFade,
      pixelDriftTransition,
      luminanceDissolveTransition,
      directionalWipeTransition,
      depthRippleTransition,
    ];

    this.lightweightTransitions = [deepZoomFade, directionalWipeTransition, simpleFadeTransition];

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("resize", () => this.onResize());
    canvas.addEventListener("dblclick", () => this.resetView());

    this.animate();
  }

  onResize() {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    this.resizeTarget.set(width, height);
    this.pendingPixelRatio = Math.min(2, window.devicePixelRatio || 1);
  }

  private applyPendingResize() {
    const targetWidth = Math.max(1, this.resizeTarget.x);
    const targetHeight = Math.max(1, this.resizeTarget.y);

    if (Math.abs(this.renderer.getPixelRatio() - this.pendingPixelRatio) > 0.01) {
      this.renderer.setPixelRatio(this.pendingPixelRatio);
    }

    const widthDiff = targetWidth - this.rendererSize.x;
    const heightDiff = targetHeight - this.rendererSize.y;
    const closeEnough = Math.abs(widthDiff) < 0.5 && Math.abs(heightDiff) < 0.5;

    if (closeEnough) {
      if (this.rendererSize.x !== targetWidth || this.rendererSize.y !== targetHeight) {
        this.renderer.setSize(targetWidth, targetHeight);
        this.rendererSize.set(targetWidth, targetHeight);
        const aspect = targetWidth / targetHeight;
        if (!Number.isNaN(aspect)) {
          this.camera.aspect = aspect;
          this.camera.updateProjectionMatrix();
        }
      }
      return;
    }

    const lerpFactor = 0.25;
    const nextWidth = this.rendererSize.x + widthDiff * lerpFactor;
    const nextHeight = this.rendererSize.y + heightDiff * lerpFactor;
    const finalWidth = Math.max(1, Math.round(nextWidth));
    const finalHeight = Math.max(1, Math.round(nextHeight));

    if (finalWidth !== this.rendererSize.x || finalHeight !== this.rendererSize.y) {
      this.renderer.setSize(finalWidth, finalHeight);
      this.rendererSize.set(finalWidth, finalHeight);
      const aspect = finalWidth / finalHeight;
      if (!Number.isNaN(aspect)) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  resetView() {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(4, 3, 6);
  }

  onPointerDown(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.floor)[0];
    if (hit) this.spawnRipple(hit.point);
    this.triggerPixelShift();
  }

  spawnRipple(point: THREE.Vector3) {
    const rings = Array.from({ length: 3 }).map((_, idx) => {
      const geo = new THREE.TorusGeometry(0.1 + idx * 0.04, 0.004, 12, 64);
      const mat = new THREE.MeshBasicMaterial({ color: 0x9aa3ff, transparent: true, opacity: 0.85 - idx * 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(point);
      mesh.scale.setScalar(0.2);
      this.scene.add(mesh);
      return mesh;
    });

    const start = this.clock.getElapsedTime();
    const maxR = 2.4 + Math.random() * 1.6;
    const duration = 1.6;

    const update = () => {
      const t = this.clock.getElapsedTime() - start;
      const k = Math.min(1, t / duration);
      const easing = 1 - Math.pow(1 - k, 3);
      const pulsate = 1 + Math.sin(k * Math.PI * 2.5) * 0.05 * (1 - k);
      rings.forEach((ring, idx) => {
        const spread = maxR * (1 + idx * 0.12);
        ring.scale.setScalar(0.2 + easing * (spread / 0.2) * pulsate);
        (ring.material as THREE.MeshBasicMaterial).opacity = (0.85 - idx * 0.2) * (1 - k);
      });
      if (k >= 1) {
        rings.forEach((ring) => {
          this.scene.remove(ring);
          ring.geometry.dispose();
          (ring.material as THREE.Material).dispose();
        });
        this.updates.delete(update);
      }
    };
    this.updates.add(update);
  }

  updates = new Set<() => void>();

  glitchTimeout: number | null = null;

  triggerPixelShift() {
    const canvas = this.renderer.domElement;
    const offsetX = (Math.random() - 0.5) * 18;
    const offsetY = (Math.random() - 0.5) * 12;
    const skew = (Math.random() - 0.5) * 2.4;
    canvas.style.setProperty("--glitch-translate-x", `${offsetX}px`);
    canvas.style.setProperty("--glitch-translate-y", `${offsetY}px`);
    canvas.style.setProperty("--glitch-skew", `${skew}deg`);
    canvas.classList.add("glitching");

    const overlay = document.createElement("div");
    overlay.className = "pixel-shift";
    overlay.style.setProperty("--shift-x", `${(Math.random() - 0.5) * 24}px`);
    overlay.style.setProperty("--shift-y", `${(Math.random() - 0.5) * 18}px`);
    overlay.style.setProperty("--shift-hue", `${Math.floor(Math.random() * 30) - 15}deg`);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("animate"));
    window.setTimeout(() => overlay.remove(), 240);

    if (this.glitchTimeout) window.clearTimeout(this.glitchTimeout);
    this.glitchTimeout = window.setTimeout(() => {
      canvas.classList.remove("glitching");
    }, 180);
  }

  private prefersLightweightTransition() {
    return innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  private ensureStage() {
    if (!this.transitionStage) {
      this.transitionStage = document.getElementById("transition-stage") as HTMLDivElement | null;
      if (!this.transitionStage) {
        const stage = document.createElement("div");
        stage.id = "transition-stage";
        this.renderer.domElement.parentElement?.appendChild(stage);
        this.transitionStage = stage;
      }
    }
    return this.transitionStage!;
  }

  activateStage(content?: HTMLElement) {
    const stage = this.ensureStage();
    stage.classList.add("active");
    stage.style.opacity = "1";
    stage.style.transition = "";
    stage.style.background = "";
    if (content) stage.replaceChildren(content);
    return stage;
  }

  clearStage() {
    const stage = this.ensureStage();
    stage.classList.remove("active");
    stage.style.opacity = "";
    stage.style.transition = "";
    stage.style.background = "";
    stage.replaceChildren();
  }

  waitForFrame(count = 1) {
    return new Promise<void>((resolve) => {
      const step = () => {
        count -= 1;
        if (count <= 0) {
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  }

  waitMs(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  runTimeline(durationMs: number, onUpdate: (t: number, eased: number) => void, easing = easeOutQuint) {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const loop = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        onUpdate(t, easing(t));
        if (t < 1) {
          requestAnimationFrame(loop);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(loop);
    });
  }

  async captureFrame() {
    await this.waitForFrame();
    const url = this.renderer.domElement.toDataURL("image/png");
    return url;
  }

  private pickTransition(): SceneTransition {
    const pool = this.prefersLightweightTransition() ? this.lightweightTransitions : this.transitions;
    return pool[Math.floor(Math.random() * pool.length)] ?? simpleFadeTransition;
  }

  initSolarSystem() {
    const solarRoot = new THREE.Group();
    this.solarSystemRoot = solarRoot;
    solarRoot.position.y = 1;
    this.scene.add(solarRoot);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd27f, emissive: 0xffa733, emissiveIntensity: 1.8, roughness: 0.3 })
    );
    solarRoot.add(sun);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe5a1, transparent: true, opacity: 0.2 })
    );
    solarRoot.add(glow);

    const planetConfigs = [
      { distance: 1.1, size: 0.08, color: 0xb7b5ff, orbitSpeed: 1.2, selfSpeed: 0.6 },
      { distance: 1.5, size: 0.1, color: 0x74cfff, orbitSpeed: 0.9, selfSpeed: 0.4 },
      { distance: 1.9, size: 0.11, color: 0xffa66f, orbitSpeed: 0.7, selfSpeed: 0.3 },
      { distance: 2.5, size: 0.16, color: 0xfff2a6, orbitSpeed: 0.5, selfSpeed: 0.35, ring: true },
      { distance: 3.1, size: 0.14, color: 0xa8b4ff, orbitSpeed: 0.32, selfSpeed: 0.25 },
      { distance: 3.8, size: 0.12, color: 0x9ee6ff, orbitSpeed: 0.22, selfSpeed: 0.2 },
      { distance: 4.4, size: 0.11, color: 0x7fa7ff, orbitSpeed: 0.18, selfSpeed: 0.18 },
      { distance: 5.2, size: 0.1, color: 0xe0e8ff, orbitSpeed: 0.12, selfSpeed: 0.16 },
    ];

    const orbiters: { group: THREE.Group; planet: THREE.Mesh; selfSpeed: number; orbitSpeed: number }[] = [];

    planetConfigs.forEach((config, index) => {
      const orbit = new THREE.Group();
      solarRoot.add(orbit);

      const orbitPath = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          new THREE.EllipseCurve(0, 0, config.distance, config.distance)
            .getPoints(90)
            .map((p) => new THREE.Vector3(p.x, 0, p.y))
        ),
        new THREE.LineBasicMaterial({ color: 0x2a2a40, transparent: true, opacity: 0.6 })
      );
      orbitPath.rotation.x = Math.PI / 2;
      solarRoot.add(orbitPath);

      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(config.size, 24, 24),
        new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.5, metalness: 0.1 })
      );
      planet.position.x = config.distance;
      orbit.add(planet);

      if (config.ring) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(config.size * 1.7, config.size * 0.3, 2, 48),
          new THREE.MeshStandardMaterial({ color: 0xd9d3a1, transparent: true, opacity: 0.6 })
        );
        ring.rotation.x = Math.PI / 3;
        planet.add(ring);
      }

      planet.rotation.x = 0.3 + index * 0.05;
      orbit.rotation.x = 0.05 * index;
      orbiters.push({ group: orbit, planet, selfSpeed: config.selfSpeed, orbitSpeed: config.orbitSpeed });
    });

    const updatePlanets = () => {
      const elapsed = this.clock.getElapsedTime();
      orbiters.forEach(({ group, planet, selfSpeed, orbitSpeed }) => {
        group.rotation.y = elapsed * orbitSpeed;
        planet.rotation.y += 0.01 * selfSpeed;
      });
    };
    this.updates.add(updatePlanets);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    this.applyPendingResize();
    this.controls.update();
    this.updates.forEach((fn) => fn());
    this.renderer.render(this.scene, this.camera);
  };

  private transitionOverlay(visible: boolean) {
    const overlay = this.fadeOverlay;
    if (!overlay) return Promise.resolve();

    if (overlay.classList.contains("visible") === visible) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        overlay.removeEventListener("transitionend", onEnd);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.target === overlay && event.propertyName === "opacity") {
          cleanup();
        }
      };
      const timeoutId = window.setTimeout(cleanup, this.fadeDurationMs + 50);
      overlay.addEventListener("transitionend", onEnd);
      void overlay.offsetWidth;
      overlay.classList.toggle("visible", visible);
    });
  }

  fadeToBlack() {
    return this.transitionOverlay(true);
  }

  fadeFromBlack() {
    return this.transitionOverlay(false);
  }

  async loadIdea(id?: string) {
    const nextId = id ?? null;
    if (nextId === this.currentIdeaId) return;

    const transition = this.pickTransition();

    const loadNext = async () => {
      if (this.cleanupIdea) {
        this.cleanupIdea();
        this.cleanupIdea = null;
      }
      this.root.clear();
      this.currentIdeaId = null;

      if (!id) return;

      try {
        const mod: { default: (ctx: SceneContext) => void | (() => void) } = await import(`./ideas/${id}.ts`);
        const maybeCleanup = mod.default({
          scene: this.scene,
          camera: this.camera,
          renderer: this.renderer,
          root: this.root,
          clock: this.clock,
          solarSystem: this.solarSystemRoot,
        });
        if (typeof maybeCleanup === "function") this.cleanupIdea = maybeCleanup;
        this.currentIdeaId = id;
      } catch {
        // not found → do nothing
      }
    };

    try {
      await transition({
        app: this,
        currentId: this.currentIdeaId,
        nextId,
        loadNext,
        isMobile: this.prefersLightweightTransition(),
      });
    } finally {
      this.clearStage();
    }
  }
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = src;
  });

const simpleFadeTransition: SceneTransition = async ({ app, loadNext }) => {
  await app.fadeToBlack();
  await loadNext();
  await app.fadeFromBlack();
};

const deepZoomFade: SceneTransition = async ({ app, loadNext }) => {
  const stage = app.activateStage();
  stage.style.background = "#000";
  stage.style.opacity = "0";

  const startFov = app.camera.fov;
  const zoomIn = Math.random() > 0.5;
  const targetFov = THREE.MathUtils.clamp(zoomIn ? startFov * 0.62 : startFov * 1.4, 24, 118);
  const duration = 1200 + Math.random() * 600;

  await app.runTimeline(duration, (_, eased) => {
    const fov = THREE.MathUtils.lerp(startFov, targetFov, eased);
    app.camera.fov = fov;
    app.camera.updateProjectionMatrix();
    stage.style.opacity = `${Math.min(1, eased * 1.2)}`;
  }, easeOutQuint);

  app.camera.fov = targetFov;
  app.camera.updateProjectionMatrix();

  await loadNext();
  await app.waitForFrame(2);

  await app.runTimeline(520, (_, eased) => {
    const fov = THREE.MathUtils.lerp(targetFov, startFov, eased);
    app.camera.fov = fov;
    app.camera.updateProjectionMatrix();
    stage.style.opacity = `${Math.max(0, 1 - eased)}`;
  }, easeInOutQuad);

  app.camera.fov = startFov;
  app.camera.updateProjectionMatrix();
  stage.style.transition = "opacity .35s ease-out";
  stage.style.opacity = "0";
  await app.waitMs(360);
};

const pixelDriftTransition: SceneTransition = async ({ app, loadNext }) => {
  const frameUrl = await app.captureFrame();
  const stage = app.activateStage();
  stage.style.background = "#02010a";

  const container = document.createElement("div");
  container.className = "transition-pixel-drift";
  stage.replaceChildren(container);

  const layers = ["base", "red", "green", "blue"];
  layers.forEach((layer) => {
    const div = document.createElement("div");
    div.className = `channel ${layer}`;
    div.style.backgroundImage = `url(${frameUrl})`;
    container.appendChild(div);
  });

  const driftX = (Math.random() - 0.5) * 44;
  const driftY = (Math.random() - 0.5) * 36;
  const driftSkew = (Math.random() - 0.5) * 12;
  const duration = 0.62 + Math.random() * 0.18;
  container.style.setProperty("--drift-x", `${driftX}px`);
  container.style.setProperty("--drift-y", `${driftY}px`);
  container.style.setProperty("--drift-skew", `${driftSkew}deg`);
  container.style.setProperty("--drift-duration", `${duration}s`);

  const baseLayer = container.querySelector(".channel.base");
  await new Promise<void>((resolve) => {
    if (!baseLayer) {
      resolve();
      return;
    }
    baseLayer.addEventListener("animationend", () => resolve(), { once: true });
  });

  container.style.transition = "opacity .24s ease-out";
  container.style.opacity = "0";
  await app.waitMs(260);

  await loadNext();
  stage.style.transition = "opacity .4s ease-out";
  stage.style.opacity = "0";
  await app.waitMs(420);
};

const luminanceDissolveTransition: SceneTransition = async (options) => {
  const { app, loadNext } = options;
  const frameUrl = await app.captureFrame();
  const stage = app.activateStage();
  stage.style.background = "#000";

  const container = document.createElement("div");
  container.className = "transition-luminance";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  stage.replaceChildren(container);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    await simpleFadeTransition(options);
    return;
  }

  const img = await loadImage(frameUrl);
  const maxDim = Math.max(img.width, img.height, 1);
  const limitScale = Math.min(1, 1280 / maxDim);
  const fitScale = Math.min(innerWidth / Math.max(img.width, 1), innerHeight / Math.max(img.height, 1), 1);
  const scale = Math.max(0.2, Math.min(limitScale, fitScale));
  canvas.width = Math.max(4, Math.round(img.width * scale));
  canvas.height = Math.max(4, Math.round(img.height * scale));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const sourceData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const working = ctx.createImageData(canvas.width, canvas.height);
  const brightness = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < brightness.length; i += 1) {
    const idx = i * 4;
    const r = sourceData.data[idx];
    const g = sourceData.data[idx + 1];
    const b = sourceData.data[idx + 2];
    brightness[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  await app.runTimeline(1200, (t, eased) => {
    const threshold = eased;
    const data = working.data;
    for (let i = 0; i < brightness.length; i += 1) {
      const idx = i * 4;
      const bright = brightness[i];
      const fade = Math.pow(Math.max(0, 1 - (threshold * 1.25 + bright * 0.85)), 1.6);
      const glow = Math.min(1, bright * 1.2 + threshold * 0.6);
      data[idx] = sourceData.data[idx] * fade + 220 * (1 - fade) * glow;
      data[idx + 1] = sourceData.data[idx + 1] * fade + 220 * (1 - fade) * glow;
      data[idx + 2] = sourceData.data[idx + 2] * fade + 255 * (1 - fade) * glow;
      data[idx + 3] = Math.max(0, Math.min(255, fade * 255));
    }
    ctx.putImageData(working, 0, 0);
  }, easeInOutQuad);

  container.style.transition = "opacity .28s ease-out";
  container.style.opacity = "0";
  await app.waitMs(300);

  await loadNext();
  stage.style.transition = "opacity .45s ease-out";
  stage.style.opacity = "0";
  await app.waitMs(460);
};

const directionalWipeTransition: SceneTransition = async ({ app, loadNext }) => {
  const beforeUrl = await app.captureFrame();
  const stage = app.activateStage();
  stage.style.background = "#010005";

  const container = document.createElement("div");
  container.className = "transition-directional";
  const beforeFrame = document.createElement("div");
  beforeFrame.className = "frame before";
  beforeFrame.style.backgroundImage = `url(${beforeUrl})`;
  container.appendChild(beforeFrame);
  stage.replaceChildren(container);

  await loadNext();
  await app.waitForFrame(2);
  const afterUrl = await app.captureFrame();
  const afterFrame = document.createElement("div");
  afterFrame.className = "frame after";
  afterFrame.style.backgroundImage = `url(${afterUrl})`;
  container.appendChild(afterFrame);

  const directions = ["left", "right", "up", "down", "diagonal"] as const;
  const direction = directions[Math.floor(Math.random() * directions.length)];
  container.classList.add(`direction-${direction}`, "play");

  await new Promise<void>((resolve) => {
    afterFrame.addEventListener("animationend", () => resolve(), { once: true });
  });

  stage.style.transition = "opacity .38s ease-out";
  stage.style.opacity = "0";
  await app.waitMs(420);
};

const depthRippleTransition: SceneTransition = async ({ app, loadNext }) => {
  const frameUrl = await app.captureFrame();
  const stage = app.activateStage();
  stage.style.background = "#000";

  const container = document.createElement("div");
  container.className = "transition-depth";
  const frame = document.createElement("div");
  frame.className = "frame";
  frame.style.backgroundImage = `url(${frameUrl})`;
  container.appendChild(frame);
  stage.replaceChildren(container);

  const centerX = 25 + Math.random() * 50;
  const centerY = 25 + Math.random() * 50;
  container.style.setProperty("--ripple-x", `${centerX}%`);
  container.style.setProperty("--ripple-y", `${centerY}%`);

  await app.waitMs(880);
  await loadNext();

  await new Promise<void>((resolve) => {
    frame.addEventListener("animationend", () => resolve(), { once: true });
  });

  stage.style.transition = "opacity .45s ease-out";
  stage.style.opacity = "0";
  await app.waitMs(460);
};
