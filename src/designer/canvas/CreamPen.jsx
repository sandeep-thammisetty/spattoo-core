import { useState, useRef, useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildPipingStroke } from '../geometry/creamPen.js';
import { buildRay } from '../utils/raycasting.js';
import { creamMaterialProps } from './CakeTier.jsx';

// ── Cream Pen (freehand piping) ──────────────────────────────────────────────
// Renders the committed freehand strokes (design.piping) and, while drawMode is on,
// captures new ones: transparent "catcher" meshes overlay each tier (and the board) so
// a drag on the cake lays a stroke. Each pointer hit is SEATED — offset along the surface
// normal by the rope radius — so the cream rests on the cake; the seated points are what
// we store and what the geometry sweeps through.
//
// Capture uses the RAW DOM pointermove with getCoalescedEvents() — not R3F's hover-gated
// onPointerMove, which fires too sparsely on fast drags and left gaps in the rope. Each
// coalesced sample is raycast against the catchers, so a quick flick still yields a dense,
// continuous stroke.
//
// Orbit: the catchers are tagged `isPenCatcher`; CakeScene's capture-phase pointerdown
// handler reads that tag and disables rotate when you press on the cake (so you draw) and
// leaves it on for empty space (so you rotate). The pen itself doesn't touch orbit.

function StrokeMesh({ points, nozzle, color, thickness, softness }) {
  const geo = useMemo(() => buildPipingStroke(points, nozzle, thickness), [points, nozzle, thickness]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} castShadow>
      {/* DoubleSide keeps the fan caps lit regardless of winding (cream is opaque) */}
      <meshPhysicalMaterial side={THREE.DoubleSide} {...creamMaterialProps(softness, color)} />
    </mesh>
  );
}

const CatcherMat = () => <meshBasicMaterial transparent opacity={0} depthWrite={false} />;

export default function CreamPen({ piping = [], drawMode = false, penStyle, tierData = [], board, onAddStroke }) {
  const { gl, camera, scene } = useThree();
  const [live, setLive] = useState([]);          // Vector3[] — seated centerline of the in-progress stroke
  const activeRef = useRef(null);                // { tierIndex } while drawing, else null
  const styleRef  = useRef(penStyle);
  styleRef.current = penStyle;
  const rc = useRef(new THREE.Raycaster());

  // Raycast a screen point against the catcher meshes; return the surface hit lifted along
  // its normal by the rope radius (so the cream rests on the surface), or null if off-cake.
  const seatAt = (clientX, clientY) => {
    const ray = buildRay(clientX, clientY, gl.domElement, camera);
    rc.current.set(ray.origin, ray.direction);
    const hit = rc.current.intersectObjects(scene.children, true)
      .find(h => h.object.userData?.isPenCatcher);
    if (!hit) return null;
    const n = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    return hit.point.clone().addScaledVector(n, styleRef.current?.thickness ?? 0.03);
  };

  // R3F pointerdown on a catcher starts the stroke (and gives us the tier it began on).
  const start = (e, tierIndex) => {
    e.stopPropagation();
    try { gl.domElement.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    activeRef.current = { tierIndex };
    const p = seatAt(e.clientX, e.clientY);
    setLive(p ? [p] : []);
  };

  // Raw-DOM move + commit. Coalesced events give every intermediate position, so fast
  // drags stay continuous instead of breaking into disconnected beads.
  useEffect(() => {
    if (!drawMode) return;
    const el = gl.domElement;

    const onMove = ev => {
      if (!activeRef.current) return;
      const samples = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      const evs = (samples && samples.length) ? samples : [ev];
      const minGap = Math.max(0.006, (styleRef.current?.thickness ?? 0.03) * 0.5);
      setLive(prev => {
        const next = prev.slice();
        for (const pe of evs) {
          const p = seatAt(pe.clientX, pe.clientY);
          if (!p) continue;
          if (!next.length || p.distanceTo(next[next.length - 1]) >= minGap) next.push(p);
        }
        return next;
      });
    };

    const onUp = () => {
      if (!activeRef.current) return;
      const { tierIndex } = activeRef.current;
      activeRef.current = null;
      setLive(pts => {
        if (pts.length) {
          const s = styleRef.current;
          onAddStroke?.({
            nozzle: s.nozzle, color: s.color, thickness: s.thickness, softness: s.softness, tierIndex,
            points: pts.map(p => [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)]),
          });
        }
        return [];
      });
    };

    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drawMode, gl, camera, scene, onAddStroke]);

  // Leaving draw mode mid-stroke drops the in-progress stroke.
  useEffect(() => { if (!drawMode) { activeRef.current = null; setLive([]); } }, [drawMode]);

  return (
    <>
      {piping.map((s, i) => <StrokeMesh key={s.id ?? i} {...s} />)}

      {drawMode && live.length > 0 && penStyle && (
        <StrokeMesh points={live} nozzle={penStyle.nozzle} color={penStyle.color}
          thickness={penStyle.thickness} softness={penStyle.softness} />
      )}

      {drawMode && tierData.map((t, i) => {
        const isRect = (t.shape ?? 'round') === 'rect';
        return (
          <mesh key={i} position={[0, t.baseY + t.height / 2, 0]} userData={{ isPenCatcher: true }}
            onPointerDown={e => start(e, i)}>
            {isRect
              ? <boxGeometry args={[t.width, t.height, t.depth]} />
              : <cylinderGeometry args={[t.radius, t.radius, t.height, 96]} />}
            <CatcherMat />
          </mesh>
        );
      })}

      {drawMode && board && (
        <mesh position={[0, board.y, 0]} userData={{ isPenCatcher: true }}
          onPointerDown={e => start(e, null)}>
          {board.shape === 'rect'
            ? <boxGeometry args={[board.width, 0.1, board.depth]} />
            : <cylinderGeometry args={[board.radius, board.radius, 0.1, 96]} />}
          <CatcherMat />
        </mesh>
      )}
    </>
  );
}
