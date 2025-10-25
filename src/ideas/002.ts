// src/ideas/002.ts
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import type { SceneContext } from "../threeScene";

type Bird = {
  group: THREE.Group;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  pathOffset: number;
  heightOffset: number;
  flapPhase: number;
  currentFlap: number;
  centerOffset: THREE.Vector3;
};

const BACKGROUND_COLOR = new THREE.Color("#191925");
const FOG_DENSITY = 0.04;

const PATH_RADIUS = 3.0;
const PATH_SPEED = 0.2;
const HEIGHT_VARIATION = 0.3;
const FLAP_SPEED = 0.8 * Math.PI * 2;
const FLAP_AMPLITUDE = 0.25;

const BASE_CAMERA_POSITION = new THREE.Vector3(4, 2.5, 6);
const CAMERA_FOV = 60;
const CAMERA_ORBIT_RADIUS = 0.2;
const CAMERA_ORBIT_SPEED = 0.1;

const BIRD_COUNT = 3;
const SPREAD = new THREE.Vector3(2.5, 1.2, 2.5);
const OFFSET_RANDOMNESS = 0.8;
const LOOK_TARGET = new THREE.Vector3(0, 1.6, 0);

export default function idea002({ scene, camera, renderer, root, clock }: SceneContext) {
  const ideaRoot = new THREE.Group();
  root.add(ideaRoot);

  const disposableMaterials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();

  const registerMaterial = (material: THREE.Material | THREE.Material[]) => {
    if (Array.isArray(material)) {
      material.forEach(registerMaterial);
      return;
    }
    disposableMaterials.add(material);
  };

  const registerGeometry = (geometry: THREE.BufferGeometry) => {
    geometries.add(geometry);
  };

  const originalBackground = scene.background;
  const originalFog = scene.fog;
  scene.background = BACKGROUND_COLOR;
  scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, FOG_DENSITY);

  const originalToneMapping = renderer.toneMapping;
  const originalToneMappingExposure = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const originalClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const originalClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(BACKGROUND_COLOR, 1);

  const originalCameraPosition = camera.position.clone();
  const originalCameraQuaternion = camera.quaternion.clone();
  const originalCameraFov = camera.fov;
  camera.position.copy(BASE_CAMERA_POSITION);
  camera.fov = CAMERA_FOV;
  camera.updateProjectionMatrix();
  camera.lookAt(LOOK_TARGET);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.8, 0.85);
  const fxaaPass = new ShaderPass(FXAAShader);

  const drawingBufferSize = new THREE.Vector2();
  renderer.getDrawingBufferSize(drawingBufferSize);
  const setComposerSize = (width: number, height: number) => {
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
    fxaaPass.material.uniforms["resolution"].value.set(1 / width, 1 / height);
  };
  setComposerSize(drawingBufferSize.x, drawingBufferSize.y);

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(fxaaPass);

  let composerWidth = drawingBufferSize.x;
  let composerHeight = drawingBufferSize.y;
  const syncComposerSize = () => {
    renderer.getDrawingBufferSize(drawingBufferSize);
    if (drawingBufferSize.x !== composerWidth || drawingBufferSize.y !== composerHeight) {
      composerWidth = drawingBufferSize.x;
      composerHeight = drawingBufferSize.y;
      setComposerSize(composerWidth, composerHeight);
    }
  };

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

  const birdMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#e6e6f6"),
    roughness: 0.6,
    metalness: 0.1,
    flatShading: true,
  });
  registerMaterial(birdMaterial);

  const bodyGeometry = new THREE.CapsuleGeometry(0.1, 0.26, 2, 6);
  const headGeometry = new THREE.DodecahedronGeometry(0.09, 0);
  const beakGeometry = new THREE.ConeGeometry(0.04, 0.12, 6);
  beakGeometry.translate(0, 0, 0.06);
  const wingGeometry = new THREE.PlaneGeometry(0.5, 0.18, 1, 1);
  wingGeometry.translate(0.25, 0, 0);
  const tailGeometry = new THREE.ConeGeometry(0.06, 0.18, 4);
  tailGeometry.rotateX(Math.PI / 2);
  tailGeometry.translate(-0.18, 0, 0);

  [bodyGeometry, headGeometry, beakGeometry, wingGeometry, tailGeometry].forEach(registerGeometry);

  const birdsRoot = new THREE.Group();
  birdsRoot.position.y = 0;
  ideaRoot.add(birdsRoot);

  const birds: Bird[] = [];
  for (let i = 0; i < BIRD_COUNT; i++) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(bodyGeometry, birdMaterial.clone());
    const head = new THREE.Mesh(headGeometry, birdMaterial.clone());
    const beak = new THREE.Mesh(beakGeometry, birdMaterial.clone());
    const wingLeft = new THREE.Mesh(wingGeometry, birdMaterial.clone());
    const wingRight = new THREE.Mesh(wingGeometry, birdMaterial.clone());
    const tail = new THREE.Mesh(tailGeometry, birdMaterial.clone());

    registerMaterial(body.material);
    registerMaterial(head.material);
    registerMaterial(beak.material);
    registerMaterial(wingLeft.material);
    registerMaterial(wingRight.material);
    registerMaterial(tail.material);

    head.position.set(0.16, 0.04, 0);
    beak.position.set(0.26, 0.02, 0);
    tail.position.set(-0.24, 0.02, 0);
    wingLeft.position.set(0.05, 0.05, 0.1);
    wingLeft.rotation.set(0, Math.PI / 2, 0);
    wingRight.position.set(0.05, 0.05, -0.1);
    wingRight.rotation.set(0, -Math.PI / 2, 0);

    group.add(body, head, beak, wingLeft, wingRight, tail);
    birdsRoot.add(group);

    const spreadOffset = new THREE.Vector3(
      (i - (BIRD_COUNT - 1) / 2) * SPREAD.x,
      (Math.random() - 0.5) * SPREAD.y * OFFSET_RANDOMNESS,
      (Math.random() - 0.5) * SPREAD.z * OFFSET_RANDOMNESS
    );

    birds.push({
      group,
      wingLeft,
      wingRight,
      pathOffset: (i / BIRD_COUNT) * Math.PI * 2 + spreadOffset.x * 0.05,
      heightOffset: spreadOffset.y * 0.3,
      flapPhase: Math.random() * Math.PI * 2,
      currentFlap: 0,
      centerOffset: new THREE.Vector3(spreadOffset.x * 0.1, spreadOffset.y * 0.15, spreadOffset.z * 0.1),
    });
  }

  const tmpVec = new THREE.Vector3();
  let orbitAngle = 0;
  let flapPaused = false;

  const envGroup = new THREE.Group();
  ideaRoot.add(envGroup);

  const groundGeometry = new THREE.CylinderGeometry(4.2, 4.2, 0.4, 12);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x161623,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.2;
  envGroup.add(ground);
  registerMaterial(groundMaterial);
  registerGeometry(groundGeometry);

  const rockGeometry = new THREE.DodecahedronGeometry(0.6, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x24243a,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true,
  });
  registerGeometry(rockGeometry);
  registerMaterial(rockMaterial);

  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial.clone());
    registerMaterial(rock.material);
    rock.position.set((Math.random() - 0.5) * 5, 0.1, (Math.random() - 0.5) * 5);
    rock.scale.setScalar(0.4 + Math.random() * 0.4);
    envGroup.add(rock);
  }

  const ribbonGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 6 }, (_, idx) =>
        new THREE.Vector3(
          Math.cos((idx / 5) * Math.PI * 2) * 2.2,
          1.4 + Math.sin(idx) * 0.3,
          Math.sin((idx / 5) * Math.PI * 2) * 2.2
        )
      )
    ),
    32,
    0.05,
    8,
    true
  );
  const ribbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3e6b,
    roughness: 0.7,
    metalness: 0.2,
    emissive: new THREE.Color(0x1a2144),
    emissiveIntensity: 0.3,
    flatShading: true,
  });
  const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
  envGroup.add(ribbon);
  registerGeometry(ribbonGeometry);
  registerMaterial(ribbonMaterial);

  const hemisphereLight = new THREE.HemisphereLight("#9aa3ff", "#191925", 0.5);
  const directionalLight = new THREE.DirectionalLight("#9aa3ff", 0.8);
  directionalLight.position.set(3, 4, 2);
  ideaRoot.add(hemisphereLight, directionalLight);

  const onResize = () => {
    composerWidth = -1;
    composerHeight = -1;
  };
  window.addEventListener("resize", onResize);

  const canvas = renderer.domElement;
  const handleClick = () => {
    flapPaused = !flapPaused;
  };
  const handleDoubleClick = () => {
    orbitAngle = 0;
    camera.position.copy(BASE_CAMERA_POSITION);
    camera.lookAt(LOOK_TARGET);
  };
  canvas.addEventListener("click", handleClick);
  canvas.addEventListener("dblclick", handleDoubleClick);

  let running = true;
  let rafId = 0;
  let previousTime = performance.now();

  const updateBirds = (delta: number) => {
    const elapsed = clock.getElapsedTime();
    birds.forEach((bird) => {
      const angle = elapsed * PATH_SPEED + bird.pathOffset;
      const radius = PATH_RADIUS + Math.sin(elapsed * 0.15 + bird.pathOffset) * 0.2;
      const height = 1.8 + Math.sin(elapsed * 0.4 + bird.heightOffset) * HEIGHT_VARIATION;

      bird.group.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      bird.group.position.add(bird.centerOffset);

      tmpVec.set(Math.cos(angle + 0.01), 0, Math.sin(angle + 0.01)).multiplyScalar(radius);
      tmpVec.add(bird.centerOffset);
      tmpVec.y = height + bird.centerOffset.y;
      bird.group.lookAt(tmpVec);
      bird.group.rotateY(Math.PI / 2);

      if (!flapPaused) {
        bird.flapPhase += delta * FLAP_SPEED;
      }
      bird.currentFlap = Math.sin(bird.flapPhase) * FLAP_AMPLITUDE;
      bird.wingLeft.rotation.z = 0.1 + bird.currentFlap;
      bird.wingRight.rotation.z = -0.1 - bird.currentFlap;
    });
  };

  const loop = () => {
    if (!running) return;
    const now = performance.now();
    const delta = (now - previousTime) / 1000;
    previousTime = now;

    syncComposerSize();
    updateBirds(delta);

    orbitAngle += delta * CAMERA_ORBIT_SPEED;
    const orbitX = Math.cos(orbitAngle) * CAMERA_ORBIT_RADIUS;
    const orbitZ = Math.sin(orbitAngle) * CAMERA_ORBIT_RADIUS;
    camera.position.set(BASE_CAMERA_POSITION.x + orbitX, BASE_CAMERA_POSITION.y, BASE_CAMERA_POSITION.z + orbitZ);
    camera.lookAt(LOOK_TARGET);

    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    renderer.render = originalRender;

    canvas.removeEventListener("click", handleClick);
    canvas.removeEventListener("dblclick", handleDoubleClick);
    window.removeEventListener("resize", onResize);

    renderer.setClearColor(originalClearColor, originalClearAlpha);
    renderer.toneMapping = originalToneMapping;
    renderer.toneMappingExposure = originalToneMappingExposure;

    scene.background = originalBackground;
    scene.fog = originalFog;

    camera.position.copy(originalCameraPosition);
    camera.quaternion.copy(originalCameraQuaternion);
    camera.fov = originalCameraFov;
    camera.updateProjectionMatrix();

    composer.dispose();
    bloomPass.dispose();

    ideaRoot.clear();
    root.remove(ideaRoot);

    geometries.forEach((geometry) => geometry.dispose());
    disposableMaterials.forEach((material) => material.dispose());
  };
}
