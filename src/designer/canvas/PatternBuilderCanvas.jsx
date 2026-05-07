import { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import CakeTier from './CakeTier.jsx';
import {
  TIER_RADII, BOTTOM_BASE, BOTTOM_H,
  CAMERA_POSITION, CAMERA_FOV,
  SELECTION_COLOR,
} from '../constants.js';

const DEMO_RADIUS = TIER_RADII[0];
const DEMO_BASE   = BOTTOM_BASE;
const DEMO_TOP_Y  = BOTTOM_BASE + BOTTOM_H;

// ── Placement position helpers ────────────────────────────────────────────────

function gapPosition(p, topY, radius, all) {
  const pa = all.find(x => x.id === p.parentA);
  const pb = all.find(x => x.id === p.parentB);
  if (!pa || !pb) return new THREE.Vector3(0, topY + p.r, 0);

  const posA = placementPosition(pa, topY, radius, all);
  const posB = placementPosition(pb, topY, radius, all);

  const dA  = p.r + pa.r;
  const dB  = p.r + pb.r;
  const d   = posA.distanceTo(posB);

  if (d < 0.0001 || d > dA + dB + 0.001) {
    return posA.clone().lerp(posB, 0.5);
  }

  const tA     = (d * d + dA * dA - dB * dB) / (2 * d);
  const perpR  = Math.sqrt(Math.max(0, dA * dA - tA * tA));
  const ab     = posB.clone().sub(posA).normalize();
  const foot   = posA.clone().addScaledVector(ab, tA);

  // Build two orthogonal vectors perpendicular to AB
  const worldUp = new THREE.Vector3(0, 1, 0);
  let v1 = new THREE.Vector3().crossVectors(ab, worldUp);
  if (v1.lengthSq() < 0.0001) v1.set(1, 0, 0);
  v1.normalize();
  const v2 = new THREE.Vector3().crossVectors(ab, v1).normalize();

  // gapAngle=0 → highest Y (resting on top of both balls)
  const baseAngle = Math.atan2(v2.y, v1.y);
  const angle     = baseAngle + (p.gapAngle ?? 0);

  return foot.clone()
    .addScaledVector(v1, perpR * Math.cos(angle))
    .addScaledVector(v2, perpR * Math.sin(angle));
}

export function placementPosition(p, topY, radius, all = []) {
  if (p.surface === 'gap') return gapPosition(p, topY, radius, all);

  if (p.surface === 'top') {
    const rd = radius - (p.rdInset ?? 0.08);
    return new THREE.Vector3(
      rd * Math.sin(p.thetaOffset ?? 0),
      topY + p.r,
      rd * Math.cos(p.thetaOffset ?? 0),
    );
  }
  // side
  const rd = radius + p.r;
  return new THREE.Vector3(
    rd * Math.sin(p.thetaOffset ?? 0),
    topY - (p.yFromTop ?? p.r),
    rd * Math.cos(p.thetaOffset ?? 0),
  );
}

export function getOverlappingIds(placements, topY, radius) {
  const ids = new Set();
  const pos = placements.map(p => placementPosition(p, topY, radius, placements));
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      if (pos[i].distanceTo(pos[j]) < placements[i].r + placements[j].r) {
        ids.add(placements[i].id);
        ids.add(placements[j].id);
      }
    }
  }
  return ids;
}

// ── Raycasting helpers ────────────────────────────────────────────────────────

function buildRay(clientX, clientY, domElement, camera) {
  const rect = domElement.getBoundingClientRect();
  const ndc  = new THREE.Vector2(
    ((clientX - rect.left)  / rect.width)  *  2 - 1,
    ((clientY - rect.top)   / rect.height) * -2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  return ray.ray;
}

function hitTop(ray, topY) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -topY);
  const hit   = new THREE.Vector3();
  if (!ray.intersectPlane(plane, hit)) return null;
  return hit;
}

function hitSide(ray, topY, baseY, radius) {
  const ox = ray.origin.x, oz = ray.origin.z;
  const dx = ray.direction.x, dz = ray.direction.z;
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  for (const t of [(-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a)]) {
    if (t < 0) continue;
    const y = ray.origin.y + t * ray.direction.y;
    if (y >= baseY && y <= topY) {
      const x = ox + t * dx, z = oz + t * dz;
      return { theta: Math.atan2(x, z), y };
    }
  }
  return null;
}

// ── Single sphere placement ───────────────────────────────────────────────────

function SpherePlacement({ placement, topY, radius, all, selected, overlapping, onPointerDown }) {
  const pos = useMemo(
    () => placementPosition(placement, topY, radius, all),
    [placement, topY, radius, all],
  );

  const emissive = overlapping ? '#ff2222' : selected ? SELECTION_COLOR : '#000000';
  const emissiveIntensity = (overlapping || selected) ? 0.35 : 0;

  return (
    <mesh
      position={pos}
      onPointerDown={e => { e.stopPropagation(); onPointerDown(placement.id); }}
    >
      <sphereGeometry args={[placement.r, 24, 24]} />
      <meshStandardMaterial
        color={placement.color ?? '#D4AF37'}
        metalness={0.88}
        roughness={0.15}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

// ── The interactive Three.js scene ────────────────────────────────────────────

function BuilderScene({
  placements, selectedId, onSelectPlacement,
  onCakeTopClick, onCakeSideClick, onDragPlacement,
  radius, topY, baseY,
}) {
  const { gl, camera } = useThree();
  const dragId  = useRef(null);
  const isDrag  = useRef(false);

  const overlappingIds = useMemo(
    () => getOverlappingIds(placements, topY, radius),
    [placements, topY, radius],
  );

  useEffect(() => {
    const dom = gl.domElement;

    function onMove(e) {
      if (!dragId.current) return;
      isDrag.current = true;
      const ray = buildRay(e.clientX, e.clientY, dom, camera);
      const p   = placements.find(pl => pl.id === dragId.current);
      if (!p || p.surface === 'gap') return; // gap balls aren't draggable

      if (p.surface === 'top') {
        const hit = hitTop(ray, topY);
        if (!hit) return;
        const theta   = Math.atan2(hit.x, hit.z);
        const rd      = Math.sqrt(hit.x * hit.x + hit.z * hit.z);
        const rdInset = Math.max(0.01, radius - rd);
        onDragPlacement(dragId.current, { thetaOffset: theta, rdInset });
      } else {
        const hit = hitSide(ray, topY, baseY, radius);
        if (!hit) return;
        onDragPlacement(dragId.current, {
          thetaOffset: hit.theta,
          yFromTop:    Math.max(0.01, topY - hit.y),
        });
      }
    }

    function onUp() {
      dragId.current = null;
      isDrag.current = false;
    }

    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup',   onUp);
    return () => {
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup',   onUp);
    };
  }, [gl, camera, placements, topY, baseY, radius, onDragPlacement]);

  function handleSpherePointerDown(id) {
    dragId.current = id;
    isDrag.current = false;
    onSelectPlacement(id);
  }

  return (
    <>
      <color attach="background" args={['#f4f4f5']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 14, 8]} intensity={1.5} castShadow />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} />
      <Environment preset="apartment" backgroundBlurriness={1} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={e => e.stopPropagation()}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#fce8d5" roughness={0.85} />
      </mesh>

      {/* Gold base plate */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius + 0.6, radius + 0.6, 0.1, 64]} />
        <meshStandardMaterial color="#d4af37" roughness={0.15} metalness={0.75} />
      </mesh>

      {/* Cake tier */}
      <CakeTier
        radius={radius}
        height={topY - baseY}
        color="#f5b8c8"
        yBase={baseY}
        frostingType="buttercream"
        selected={false}
        topPiping={null}
        bottomPiping={null}
        topPipingSelected={false}
        bottomPipingSelected={false}
        onTopPipingClick={() => {}}
        onBottomPipingClick={() => {}}
        onClick={() => {}}
      />

      {/* Transparent top-surface click catcher */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, topY + 0.001, 0]}
        onClick={e => {
          e.stopPropagation();
          if (isDrag.current) return;
          const pt = e.point;
          onCakeTopClick?.({ thetaOffset: Math.atan2(pt.x, pt.z) });
        }}
      >
        <circleGeometry args={[radius * 0.98, 64]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Transparent cylinder-side click catcher */}
      <mesh
        position={[0, (topY + baseY) / 2, 0]}
        onClick={e => {
          e.stopPropagation();
          if (isDrag.current) return;
          const pt = e.point;
          onCakeSideClick?.({
            thetaOffset: Math.atan2(pt.x, pt.z),
            yFromTop:    Math.max(0, topY - pt.y),
          });
        }}
      >
        <cylinderGeometry args={[radius, radius, topY - baseY, 64, 1, true]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Placements */}
      {placements.map(p => (
        <SpherePlacement
          key={p.id}
          placement={p}
          topY={topY}
          radius={radius}
          all={placements}
          selected={selectedId === p.id}
          overlapping={overlappingIds.has(p.id)}
          onPointerDown={handleSpherePointerDown}
        />
      ))}
    </>
  );
}

// ── Exported canvas ───────────────────────────────────────────────────────────

export default function PatternBuilderCanvas({
  placements = [],
  selectedId  = null,
  onSelectPlacement,
  onCakeTopClick,
  onCakeSideClick,
  onDragPlacement,
}) {
  return (
    <Canvas
      shadows
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <BuilderScene
        placements={placements}
        selectedId={selectedId}
        onSelectPlacement={onSelectPlacement}
        onCakeTopClick={onCakeTopClick}
        onCakeSideClick={onCakeSideClick}
        onDragPlacement={onDragPlacement}
        radius={DEMO_RADIUS}
        topY={DEMO_TOP_Y}
        baseY={DEMO_BASE}
      />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 2, 0]}
      />
    </Canvas>
  );
}
