// src/ideas/003.ts
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { ColorCorrectionShader } from "three/examples/jsm/shaders/ColorCorrectionShader.js";
import type { SceneContext } from "../threeScene";

type Mode = "cinematic" | "wireframe" | "depth";

type Bird = {
  group: THREE.Group;
  velocity: THREE.Vector3;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  offset: number;
};

const MODE_ORDER: Mode[] = ["cinematic", "wireframe", "depth"];

export default function idea003({ scene, camera, renderer, root, clock }: SceneContext) {
  const ideaRoot = new THREE.Group();
  root.add(ideaRoot);

  const toggleableMaterials = new Set<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>();
  const disposableMaterials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();

  const registerMaterial = (material: THREE.Material) => {
    if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
      toggleableMaterials.add(material);
    }
    disposableMaterials.add(material);
  };

  const registerMaterials = (material: THREE.Material | THREE.Material[]) => {
    if (Array.isArray(material)) {
      material.forEach((m) => registerMaterial(m));
    } else {
      registerMaterial(material);
    }
  };

  // cinematic grading setup
  const originalClear = renderer.getClearColor(new THREE.Color()).clone();
  const originalClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x05050b, 1);

  const originalToneMapping = renderer.toneMapping;
  const originalToneMappingExposure = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const composer = new EffectComposer(renderer);
  composer.setSize(innerWidth, innerHeight);

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.2, 0.9, 0.85);
  bloomPass.threshold = 0.42;
  bloomPass.strength = 1.4;
  bloomPass.radius = 0.65;

  const filmPass = new FilmPass(0.65, false);
  const colorPass = new ShaderPass(ColorCorrectionShader);
  colorPass.uniforms["powRGB"].value = new THREE.Vector3(1.1, 1.07, 1.18);
  colorPass.uniforms["mulRGB"].value = new THREE.Vector3(0.9, 0.95, 1.08);
  colorPass.uniforms["addRGB"].value = new THREE.Vector3(0.02, 0.01, 0.0);

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(colorPass);
  composer.addPass(filmPass);

  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMaterial.blending = THREE.NoBlending;

  const originalOverrideMaterial = scene.overrideMaterial;

  let modeIndex = 0;

  const updateWireframe = (enabled: boolean) => {
    toggleableMaterials.forEach((mat) => {
      mat.wireframe = enabled;
    });
  };

  const setMode = (mode: Mode) => {
    updateWireframe(false);
    scene.overrideMaterial = originalOverrideMaterial;
    bloomPass.enabled = true;
    filmPass.enabled = true;
    colorPass.enabled = true;

    switch (mode) {
      case "cinematic": {
        renderer.toneMappingExposure = 1.35;
        break;
      }
      case "wireframe": {
        updateWireframe(true);
        renderer.toneMappingExposure = 1.1;
        bloomPass.enabled = false;
        filmPass.enabled = false;
        colorPass.enabled = false;
        break;
      }
      case "depth": {
        renderer.toneMappingExposure = 1.0;
        scene.overrideMaterial = depthMaterial;
        bloomPass.enabled = false;
        filmPass.enabled = false;
        colorPass.enabled = false;
        break;
      }
    }
  };

  setMode(MODE_ORDER[modeIndex]);

  const onResize = () => {
    composer.setSize(innerWidth, innerHeight);
    bloomPass.setSize(innerWidth, innerHeight);
  };
  window.addEventListener("resize", onResize);

  const originalRender = renderer.render.bind(renderer);
  const overrideRender = (sceneToRender: THREE.Scene, cameraToRender: THREE.Camera) => {
    if (sceneToRender === scene && cameraToRender === camera) {
      const currentMode = MODE_ORDER[modeIndex];
      if (currentMode === "depth") {
        originalRender(sceneToRender, cameraToRender);
      } else {
        renderer.render = originalRender;
        composer.render();
        renderer.render = overrideRender as typeof renderer.render;
      }
    } else {
      originalRender(sceneToRender, cameraToRender);
    }
  };
  renderer.render = overrideRender as typeof renderer.render;

  const birdsRoot = new THREE.Group();
  birdsRoot.position.y = 1.8;
  ideaRoot.add(birdsRoot);

  const birds: Bird[] = [];
  const birdBodyGeometry = new THREE.CapsuleGeometry(0.08, 0.26, 6, 12);
  const birdBodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe3e0d5,
    roughness: 0.35,
    metalness: 0.25,
    clearcoat: 0.6,
    clearcoatRoughness: 0.35,
  });
  const wingGeometry = new THREE.PlaneGeometry(0.5, 0.16, 1, 3);
  wingGeometry.translate(0.25, 0, 0);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f263f,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const tailGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0x28304f,
    roughness: 0.45,
    metalness: 0.15,
  });

  [birdBodyMaterial, wingMaterial, tailMaterial].forEach((mat) => registerMaterial(mat));
  geometries.add(birdBodyGeometry);
  geometries.add(wingGeometry);
  geometries.add(tailGeometry);

  const randomPointInSphere = (radius: number) => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  };

  const birdCount = 26;
  for (let i = 0; i < birdCount; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(birdBodyGeometry, birdBodyMaterial.clone());
    const wingLeft = new THREE.Mesh(wingGeometry, wingMaterial.clone());
    const wingRight = new THREE.Mesh(wingGeometry, wingMaterial.clone());
    const tail = new THREE.Mesh(tailGeometry, tailMaterial.clone());

    wingLeft.position.set(0, 0.05, 0);
    wingLeft.rotation.set(0, Math.PI / 2, 0);
    wingRight.position.set(0, 0.05, 0);
    wingRight.rotation.set(0, -Math.PI / 2, 0);
    tail.position.set(-0.16, -0.02, 0);
    tail.rotation.set(Math.PI / 2, 0, Math.PI / 2);

    [body, wingLeft, wingRight, tail].forEach((mesh) => {
      registerMaterials(mesh.material);
      geometries.add(mesh.geometry as THREE.BufferGeometry);
    });

    group.add(body, wingLeft, wingRight, tail);
    const start = randomPointInSphere(2.8).add(new THREE.Vector3(0.2, 0.0, -0.5));
    group.position.copy(start);
    group.rotation.y = Math.random() * Math.PI * 2;
    birdsRoot.add(group);

    birds.push({
      group,
      velocity: randomPointInSphere(0.3).multiplyScalar(0.015),
      wingLeft,
      wingRight,
      offset: Math.random() * Math.PI * 2,
    });
  }

  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();
  const tmpVec3 = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3(0, 0, 1);
  const flockCenter = new THREE.Vector3();
  const flockVelocity = new THREE.Vector3();

  const updateBirds = (delta: number) => {
    flockCenter.set(0, 0, 0);
    flockVelocity.set(0, 0, 0);
    birds.forEach((bird) => {
      flockCenter.add(bird.group.position);
      flockVelocity.add(bird.velocity);
    });
    flockCenter.multiplyScalar(1 / birds.length);
    flockVelocity.multiplyScalar(1 / birds.length);

    const elapsed = clock.getElapsedTime();

    birds.forEach((bird, idx) => {
      tmpVec.copy(flockCenter).sub(bird.group.position).multiplyScalar(delta * 0.08);
      bird.velocity.add(tmpVec);

      tmpVec2.copy(flockVelocity).sub(bird.velocity).multiplyScalar(delta * 0.18);
      bird.velocity.add(tmpVec2);

      tmpVec3.set(0, 0, 0);
      birds.forEach((other, otherIdx) => {
        if (idx === otherIdx) return;
        tmpVec.copy(bird.group.position).sub(other.group.position);
        const dist = tmpVec.length();
        if (dist > 0 && dist < 0.65) {
          tmpVec.multiplyScalar(0.035 / dist);
          tmpVec3.add(tmpVec);
        }
      });
      bird.velocity.addScaledVector(tmpVec3, delta * 1.2);

      tmpVec
        .set(
          Math.sin(elapsed * 0.2 + bird.offset) * 0.05,
          Math.cos(elapsed * 0.18 + bird.offset * 0.6) * 0.02,
          Math.cos(elapsed * 0.17 + bird.offset) * 0.05
        )
        .multiplyScalar(delta * 0.4);
      bird.velocity.add(tmpVec);

      if (bird.group.position.length() > 4.5) {
        tmpVec.copy(flockCenter).sub(bird.group.position).multiplyScalar(0.5 * delta);
        bird.velocity.add(tmpVec);
      }

      bird.velocity.y += (1.9 - bird.group.position.y) * delta * 0.18;
      bird.velocity.clampLength(0.05, 0.4);

      bird.group.position.addScaledVector(bird.velocity, delta * 0.8);
      bird.group.position.y = THREE.MathUtils.clamp(bird.group.position.y, 0.8, 3.4);

      const speed = bird.velocity.length();
      const flap = Math.sin(elapsed * 0.8 + bird.offset) * 0.45 * (0.6 + (0.8 - speed) * 0.4);
      bird.wingLeft.rotation.z = 0.35 + flap;
      bird.wingRight.rotation.z = -0.35 - flap;

      tmpVec.copy(bird.velocity).normalize();
      if (tmpVec.lengthSq() > 0) {
        tmpQuat.setFromUnitVectors(forward, tmpVec);
        bird.group.quaternion.slerp(tmpQuat, 0.08);
      }
    });
  };

  let rafId = 0;
  let running = true;
  let previousTime = performance.now();
  const loop = () => {
    if (!running) return;
    const now = performance.now();
    const delta = (now - previousTime) / 1000;
    previousTime = now;
    updateBirds(delta);
    updateEmbers();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  // environment
  const envGroup = new THREE.Group();
  ideaRoot.add(envGroup);

  const treeTrunkGeometry = new THREE.CylinderGeometry(0.2, 0.55, 5, 12);
  const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2f25, roughness: 0.85, metalness: 0.05 });
  const treeTrunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
  treeTrunk.position.set(-2.6, 2.5, 0.8);
  envGroup.add(treeTrunk);

  const treeCanopyGeometry = new THREE.DodecahedronGeometry(1.9, 1);
  const treeCanopyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d3f2a,
    roughness: 0.6,
    metalness: 0.05,
    emissive: new THREE.Color(0x0d2314),
    emissiveIntensity: 0.6,
  });
  const treeCanopy = new THREE.Mesh(treeCanopyGeometry, treeCanopyMaterial);
  treeCanopy.position.set(-2.6, 4.3, 0.8);
  envGroup.add(treeCanopy);

  const canopyHaloGeometry = new THREE.SphereGeometry(2.4, 24, 24);
  const canopyHaloMaterial = new THREE.MeshBasicMaterial({ color: 0x214d32, transparent: true, opacity: 0.18 });
  const canopyHalo = new THREE.Mesh(canopyHaloGeometry, canopyHaloMaterial);
  canopyHalo.position.copy(treeCanopy.position);
  envGroup.add(canopyHalo);

  [treeTrunkMaterial, treeCanopyMaterial].forEach((mat) => registerMaterial(mat));
  registerMaterial(canopyHaloMaterial);
  geometries.add(treeTrunkGeometry);
  geometries.add(treeCanopyGeometry);
  geometries.add(canopyHaloGeometry);

  const cityGroup = new THREE.Group();
  cityGroup.position.set(2.4, 0, -1.4);
  envGroup.add(cityGroup);

  const buildingColors = [0x152034, 0x1b2742, 0x1e3050, 0x1c2337];
  const buildingLightColor = new THREE.Color(0xfff7d1);

  for (let i = 0; i < 12; i++) {
    const width = 0.6 + Math.random() * 0.5;
    const depth = 0.6 + Math.random() * 0.4;
    const height = 1.8 + Math.random() * 2.6;
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: buildingColors[i % buildingColors.length],
      roughness: 0.7,
      metalness: 0.2,
      emissive: buildingLightColor.clone().multiplyScalar(0.12 + Math.random() * 0.2),
      emissiveIntensity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * 3, height / 2, (Math.random() - 0.5) * 2);
    mesh.rotation.y = Math.random() * 0.2 - 0.1;
    cityGroup.add(mesh);
    registerMaterial(mat);
    geometries.add(geo);
  }

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.2, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x11131d, roughness: 0.9, metalness: 0.05 })
  );
  plaza.position.set(0, 0.1, -0.8);
  envGroup.add(plaza);
  registerMaterials(plaza.material);
  geometries.add(plaza.geometry as THREE.BufferGeometry);

  const emberParticles = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 180 }, () =>
        new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 4, (Math.random() - 0.5) * 5)
      )
    ),
    new THREE.PointsMaterial({
      color: 0xffcfa7,
      size: 0.04,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  );
  ideaRoot.add(emberParticles);

  const emberGeometry = emberParticles.geometry as THREE.BufferGeometry;
  const emberMaterial = emberParticles.material as THREE.PointsMaterial;
  registerMaterial(emberMaterial);

  const updateEmbers = () => {
    const positions = emberGeometry.getAttribute("position");
    const elapsed = clock.getElapsedTime();
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const offset = positions.getX(i) * 0.5 + positions.getZ(i) * 0.4;
      const wave = Math.sin(elapsed * 0.5 + offset) * 0.04;
      positions.setY(i, y + 0.005 + wave * 0.02);
      if (positions.getY(i) > 5) {
        positions.setY(i, 1 + Math.random() * 0.4);
      }
    }
    positions.needsUpdate = true;
    emberMaterial.opacity = 0.45 + Math.sin(elapsed * 0.6) * 0.1;
  };

  const envLight = new THREE.SpotLight(0xffbb7d, 3.2, 22, Math.PI / 5, 0.75, 1.5);
  envLight.position.set(-1.2, 6.5, 4.6);
  envLight.target.position.set(-0.5, 0.8, -0.5);
  ideaRoot.add(envLight, envLight.target);

  const rimLight = new THREE.DirectionalLight(0x7a9dff, 1.2);
  rimLight.position.set(3.5, 5.2, -3.6);
  ideaRoot.add(rimLight);

  const ambient = new THREE.AmbientLight(0x10162b, 0.8);
  ideaRoot.add(ambient);

  let lastGlitchTime = 0;
  const canvas = renderer.domElement;
  const handlePointerDown = () => {
    const now = performance.now();
    if (now - lastGlitchTime < 180) return; // avoid cycling multiple times per glitch burst
    modeIndex = (modeIndex + 1) % MODE_ORDER.length;
    setMode(MODE_ORDER[modeIndex]);
    lastGlitchTime = now;
  };
  canvas.addEventListener("pointerdown", handlePointerDown);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("resize", onResize);
    renderer.render = originalRender;
    renderer.setClearColor(originalClear, originalClearAlpha);
    renderer.toneMapping = originalToneMapping;
    renderer.toneMappingExposure = originalToneMappingExposure;
    scene.overrideMaterial = originalOverrideMaterial;

    composer.dispose();
    depthMaterial.dispose();
    bloomPass.dispose();
    filmPass.dispose();

    birdsRoot.clear();
    envGroup.clear();
    ideaRoot.clear();
    root.remove(ideaRoot);

    geometries.forEach((geo) => geo.dispose());
    disposableMaterials.forEach((mat) => mat.dispose());
    emberGeometry.dispose();
  };
}
