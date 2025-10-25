// src/threeScene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type IdeaModule = (ctx: SceneContext) => void | (() => void);

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;     // idea をぶら下げる
  clock: THREE.Clock;
}

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
  private fadeOverlay: HTMLElement | null = null;
  private fadeDurationMs = 450;
  private currentIdeaId: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);

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

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("resize", () => this.onResize());
    canvas.addEventListener("dblclick", () => this.resetView());

    this.animate();
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
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

  initSolarSystem() {
    const solarRoot = new THREE.Group();
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

  private fadeToBlack() {
    return this.transitionOverlay(true);
  }

  private fadeFromBlack() {
    return this.transitionOverlay(false);
  }

  async loadIdea(id?: string) {
    const nextId = id ?? null;
    if (nextId === this.currentIdeaId) return;

    await this.fadeToBlack();

    if (this.cleanupIdea) {
      this.cleanupIdea();
      this.cleanupIdea = null;
    }
    this.root.clear();
    this.currentIdeaId = null;

    if (!id) {
      await this.fadeFromBlack();
      return;
    }

    try {
      const mod: { default: (ctx: SceneContext) => void | (() => void) } = await import(`./ideas/${id}.ts`);
      const maybeCleanup = mod.default({
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        root: this.root,
        clock: this.clock,
      });
      if (typeof maybeCleanup === "function") this.cleanupIdea = maybeCleanup;
      this.currentIdeaId = id;
    } catch {
      // not found → do nothing
    }

    await this.fadeFromBlack();
  }
}
