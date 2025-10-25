// src/threeScene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
export class ThreeApp {
    scene = new THREE.Scene();
    camera;
    renderer;
    controls;
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    floor;
    root = new THREE.Group();
    clock = new THREE.Clock();
    cleanupIdea = null;
    constructor(canvas) {
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
        const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x9aa3ff, metalness: 0.4, roughness: 0.3 }));
        ico.position.y = 1;
        this.scene.add(ico);
        this.scene.add(this.root);
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
    onPointerDown(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObject(this.floor)[0];
        if (hit)
            this.spawnRipple(hit.point);
    }
    spawnRipple(point) {
        const geo = new THREE.TorusGeometry(0.01, 0.005, 8, 48);
        const mat = new THREE.MeshBasicMaterial({ color: 0x9aa3ff, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(point);
        this.scene.add(ring);
        const start = this.clock.getElapsedTime();
        const maxR = 1.5;
        const duration = 1.2;
        const update = () => {
            const t = this.clock.getElapsedTime() - start;
            const k = Math.min(1, t / duration);
            ring.scale.setScalar(0.1 + k * (maxR / 0.1));
            ring.material.opacity = 0.9 * (1 - k);
            if (k >= 1) {
                this.scene.remove(ring);
                ring.geometry.dispose();
                ring.material.dispose();
                this.updates.delete(update);
            }
        };
        this.updates.add(update);
    }
    updates = new Set();
    animate = () => {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.updates.forEach((fn) => fn());
        this.renderer.render(this.scene, this.camera);
    };
    async loadIdea(id) {
        if (this.cleanupIdea) {
            this.cleanupIdea();
            this.cleanupIdea = null;
        }
        this.root.clear();
        if (!id)
            return;
        try {
            const mod = await import(`./ideas/${id}.ts`);
            const maybeCleanup = mod.default({
                scene: this.scene,
                camera: this.camera,
                renderer: this.renderer,
                root: this.root,
                clock: this.clock,
            });
            if (typeof maybeCleanup === "function")
                this.cleanupIdea = maybeCleanup;
        }
        catch {
            // not found → do nothing
        }
    }
}
