'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Decorative 3D scene for the homepage hero: the generated phone model, slowly
 * turning, with the two tiles drifting around it.
 *
 * Three.js is imported only inside the effect, so it never lands in the initial
 * bundle and a browser without WebGL simply keeps the empty box.
 */
export default function HeroScene() {
  const host = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    let cancelled = false;
    let dispose = () => {};

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearAlpha(0);
        element.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        camera.position.set(0, 0.05, 4.3);

        scene.add(new THREE.AmbientLight(0xfff3e6, 1.15));

        const key = new THREE.DirectionalLight(0xfff1e2, 1.35);
        key.position.set(2.4, 3.2, 3.6);
        scene.add(key);

        const rim = new THREE.DirectionalLight(0xa8431f, 0.85);
        rim.position.set(-3, -1.4, -2.2);
        scene.add(rim);

        const group = new THREE.Group();
        scene.add(group);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('/models/mezone-device.gltf');
        if (cancelled) return;

        group.add(gltf.scene);
        gltf.scene.position.y = -0.04;

        const tile = gltf.scene.getObjectByName('tile');
        const tile2 = gltf.scene.getObjectByName('tile2');

        const resize = () => {
          const width = element.clientWidth;
          const height = element.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);

        // Pointer parallax, bounded so the model never spins away from the text.
        const pointer = { x: 0, y: 0 };
        const onPointerMove = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
          pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 0.35;
        };
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerleave', () => {
          pointer.x = 0;
          pointer.y = 0;
        });

        // Only animate while the scene is actually on screen.
        let visible = true;
        const visibility = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
        });
        visibility.observe(element);

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const renderAt = (elapsed: number) => {
          group.rotation.y = reduceMotion ? -0.35 : -0.35 + elapsed * 0.28 + pointer.x;
          group.rotation.x = reduceMotion ? 0.06 : 0.06 + Math.sin(elapsed * 0.7) * 0.05 - pointer.y;
          group.position.y = reduceMotion ? 0 : Math.sin(elapsed * 0.9) * 0.04;

          if (tile) {
            tile.rotation.y = elapsed * 0.7;
            tile.rotation.x = elapsed * 0.45;
            tile.position.y = 0.62 + Math.sin(elapsed * 1.2) * 0.07;
          }
          if (tile2) {
            tile2.rotation.y = -elapsed * 0.55;
            tile2.rotation.z = elapsed * 0.4;
            tile2.position.x = -0.5 + Math.sin(elapsed * 0.8) * 0.04;
          }

          renderer.render(scene, camera);
        };

        const start = performance.now();
        let frame = 0;

        const tick = () => {
          if (cancelled) return;
          frame = requestAnimationFrame(tick);
          if (!visible) return;
          renderAt((performance.now() - start) / 1000);
        };

        setLoaded(true);

        if (reduceMotion) {
          renderAt(0);
        } else {
          frame = requestAnimationFrame(tick);
        }

        dispose = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          visibility.disconnect();
          element.removeEventListener('pointermove', onPointerMove);
          gltf.scene.traverse((node) => {
            const mesh = node as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            materials.forEach((material) => material.dispose());
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (error) {
        // No WebGL, blocked context, or the model failed to load: stay quiet and
        // leave the decorative area empty rather than breaking the page.
        console.warn('[HeroScene] 3D scene disabled', error);
      }
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <div className={`hero-scene${loaded ? ' is-loaded' : ''}`} ref={host} />
  );
}
