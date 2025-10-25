// src/ideas/001.ts
import * as THREE from "three";
export default function idea001({ root, clock }) {
    const g = new THREE.TorusKnotGeometry(0.6, 0.18, 128, 32);
    const m = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.6 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(0, 1.1, 0);
    root.add(mesh);
    let rafId = 0;
    const tick = () => {
        const t = clock.getElapsedTime();
        mesh.rotation.x = t * 0.3;
        mesh.rotation.y = t * 0.2;
        rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
        cancelAnimationFrame(rafId);
        root.remove(mesh);
        g.dispose();
        m.dispose();
    };
}
