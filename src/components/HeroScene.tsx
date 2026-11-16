'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Decorative 3D scene for the homepage hero.
 *
 * - follows the cursor: the model tilts and the camera drifts with a spring
 * - draggable: pointer drag spins it on both axes, released spins carry momentum
 * - lit like an object, not a widget: room environment reflections, one soft
 *   shadow, ACES tone mapping
 *
 * Three.js is imported inside the effect, so it never lands in the initial
 * bundle. No WebGL, a blocked context or a failed model load leaves the stage
 * empty instead of breaking the page.
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
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearAlpha(0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        element.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = environment;
        scene.environmentIntensity = 0.7;

        const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
        camera.position.set(0, 0.05, 4.4);

        const ambient = new THREE.AmbientLight(0xfff3e6, 0.35);
        scene.add(ambient);

        const key = new THREE.DirectionalLight(0xfff1e2, 2.6);
        key.position.set(2.4, 3.1, 3.4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.radius = 4;
        key.shadow.bias = -0.0012;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 12;
        key.shadow.camera.left = -1.6;
        key.shadow.camera.right = 1.6;
        key.shadow.camera.top = 1.8;
        key.shadow.camera.bottom = -1.8;
        scene.add(key);

        const rim = new THREE.DirectionalLight(0xa8431f, 1.1);
        rim.position.set(-3, -1.2, -2.4);
        scene.add(rim);

        // Shadow catcher: only the shadow is drawn, the backdrop stays the page.
        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(7, 7),
          new THREE.ShadowMaterial({ opacity: 0.16 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.82;
        floor.receiveShadow = true;
        scene.add(floor);

        const group = new THREE.Group();
        scene.add(group);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('/models/mezone-device.gltf');
        if (cancelled) return;

        const emissiveMaterials: { emissiveIntensity: number }[] = [];

        gltf.scene.traverse((node) => {
          const mesh = node as unknown as {
            isMesh?: boolean;
            castShadow?: boolean;
            receiveShadow?: boolean;
            material?: { emissive?: unknown; emissiveIntensity?: number };
          };
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material?.emissive && typeof mesh.material.emissiveIntensity === 'number') {
              emissiveMaterials.push(mesh.material as unknown as { emissiveIntensity: number });
            }
          }
        });

        group.add(gltf.scene);
        gltf.scene.position.y = -0.02;

        const ring = gltf.scene.getObjectByName('ring');
        const tile = gltf.scene.getObjectByName('tile');
        const tile2 = gltf.scene.getObjectByName('tile2');
        const tile3 = gltf.scene.getObjectByName('tile3');

        /* ------------------------------ resize ------------------------------ */

        const resize = () => {
          const width = element.clientWidth;
          const height = element.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(element);

        /* ------------------------------ pointer ----------------------------- */

        const autoSpin = { y: 0 };
        const spin = { x: 0, y: 0, vx: 0, vy: 0 };
        const pointer = { x: 0, y: 0 };
        const pointerSmooth = { x: 0, y: 0 };
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        const trackPointer = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
          pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        };

        const onPointerDown = (event: PointerEvent) => {
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
          spin.vx = 0;
          spin.vy = 0;
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            /* pointer already gone, or a synthetic event: drag still works */
          }
          element.classList.add('is-dragging');
          trackPointer(event);
        };

        const onPointerMove = (event: PointerEvent) => {
          trackPointer(event);
          if (!dragging) return;

          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;

          spin.y += dx * 0.0085;
          spin.x += dy * 0.0055;
          spin.vy = dx * 0.0085;
          spin.vx = dy * 0.0055;
        };

        const endDrag = (event: PointerEvent) => {
          if (!dragging) return;
          dragging = false;
          element.classList.remove('is-dragging');
          if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        };

        const onPointerLeave = () => {
          if (dragging) return;
          pointer.x = 0;
          pointer.y = 0;
        };

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', endDrag);
        element.addEventListener('pointercancel', endDrag);
        element.addEventListener('pointerleave', onPointerLeave);

        let visible = true;
        const visibility = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
        });
        visibility.observe(element);

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* ------------------------------- render ----------------------------- */

        const start = performance.now();
        let previous = start;
        let frame = 0;

        const render = (elapsed: number, delta: number) => {
          // Cursor following: eased, so it trails the pointer instead of snapping.
          pointerSmooth.x += (pointer.x - pointerSmooth.x) * 0.075;
          pointerSmooth.y += (pointer.y - pointerSmooth.y) * 0.075;

          if (!dragging) {
            // Carried momentum from the last drag, decaying to rest.
            spin.y += spin.vy;
            spin.x += spin.vx;
            spin.vy *= 0.93;
            spin.vx *= 0.93;
            if (Math.abs(spin.vy) < 0.0004) spin.vy = 0;
            if (Math.abs(spin.vx) < 0.0004) spin.vx = 0;

            // Idle rotation resumes once the drag has settled.
            if (spin.vy === 0) autoSpin.y += delta * 0.22;
          }

          spin.x = Math.max(-0.85, Math.min(0.85, spin.x));

          group.rotation.y = spin.y + autoSpin.y + pointerSmooth.x * 0.45;
          group.rotation.x = spin.x + pointerSmooth.y * 0.3 - 0.02;
          group.position.y = Math.sin(elapsed * 0.9) * 0.035;

          camera.position.x = pointerSmooth.x * 0.16;
          camera.position.y = 0.05 - pointerSmooth.y * 0.12;
          camera.lookAt(0, 0, 0);

          if (ring) {
            ring.rotation.z = elapsed * 0.25;
            ring.rotation.x = Math.sin(elapsed * 0.4) * 0.35;
            const pulse = 1 + Math.sin(elapsed * 1.1) * 0.015;
            ring.scale.set(pulse, pulse, pulse);
          }
          if (tile) {
            tile.rotation.y = elapsed * 0.8;
            tile.rotation.x = elapsed * 0.5;
            tile.position.y = 0.66 + Math.sin(elapsed * 1.3) * 0.06;
          }
          if (tile2) {
            tile2.rotation.y = -elapsed * 0.6;
            tile2.rotation.z = elapsed * 0.45;
            tile2.position.x = -0.54 + Math.sin(elapsed * 0.9) * 0.05;
          }
          if (tile3) {
            tile3.rotation.x = elapsed * 0.9;
            tile3.rotation.z = -elapsed * 0.7;
            tile3.position.z = 0.32 + Math.sin(elapsed * 1.7) * 0.06;
          }

          const glow = 0.85 + Math.sin(elapsed * 2.1) * 0.25;
          emissiveMaterials.forEach((material) => {
            material.emissiveIntensity = glow;
          });

          renderer.render(scene, camera);
        };

        const tick = () => {
          if (cancelled) return;
          frame = requestAnimationFrame(tick);
          if (!visible) return;

          const now = performance.now();
          const delta = Math.min((now - previous) / 1000, 0.05);
          previous = now;
          render((now - start) / 1000, delta);
        };

        setLoaded(true);

        if (reduceMotion) {
          render(0, 0);
        } else {
          frame = requestAnimationFrame(tick);
        }

        /* ------------------------------ cleanup ----------------------------- */

        dispose = () => {
          cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          visibility.disconnect();
          element.removeEventListener('pointerdown', onPointerDown);
          element.removeEventListener('pointermove', onPointerMove);
          element.removeEventListener('pointerup', endDrag);
          element.removeEventListener('pointercancel', endDrag);
          element.removeEventListener('pointerleave', onPointerLeave);

          gltf.scene.traverse((node) => {
            const mesh = node as unknown as {
              geometry?: { dispose: () => void };
              material?: { dispose: () => void } | { dispose: () => void }[];
            };
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            materials.forEach((material) => material.dispose());
          });

          floor.geometry.dispose();
          (floor.material as { dispose: () => void }).dispose();
          environment.dispose();
          pmrem.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (error) {
        // No WebGL, blocked context, or the model failed to load: leave the
        // decorative area empty rather than breaking the page.
        console.warn('[HeroScene] 3D scene disabled', error);
      }
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <>
      <div className={`hero-scene${loaded ? ' is-loaded' : ''}`} ref={host} />
      <p className="stage-hint" aria-hidden="true">
        Drag to spin
      </p>
    </>
  );
}
