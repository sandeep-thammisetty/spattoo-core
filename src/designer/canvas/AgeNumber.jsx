import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { topClamp } from '../geometry/surface.js';
import { pointerRay, planeHit } from '../utils/raycasting.js';

const DEG = Math.PI / 180;

// A flat, BEVELLED gold number standing upright on the cake top — the "number candle" look
// (extruded face + chamfered bevel that catches the light), NOT a balloon. Reuses the same Text3D
// beveled engine as the Texts decoration; only the material (warm metallic gold/silver) and the
// upright top-surface placement differ. Dragged on the top plane (grab disables orbit; a no-move
// press = tap → select).
//
// Material: Text3D exposes two material slots — index 0 = front/back faces, index 1 = side+bevel.
// A satin warm-gold face + a slightly darker, shinier side/bevel reads as a metal candle number.
const FINISHES = {
  gold:   { face: '#c9a23f', side: '#a07c2c', emissive: '#2a1c04' },
  silver: { face: '#cdd2d8', side: '#9aa0a8', emissive: '#202428' },
};

export default function AgeNumber({
  age, topY, shape = 'round', shp,
  onClick, onMove, onOrbitEnable, selected = false,
}) {
  const { camera, gl } = useThree();
  const size  = age?.size ?? 0.95;                                   // standing height (world units)
  const value = String(age?.value ?? '').replace(/[^0-9]/g, '');    // digits only
  const fin   = FINISHES[age?.finish] ?? FINISHES.gold;
  const pressedRef = useRef(false);

  if (!value) return null;

  const yaw = (age.yaw ?? 0) * DEG;
  const ox  = age.offsetX ?? 0;
  const oz  = age.offsetZ ?? 0;

  // Approximate footprint for the grab plane (Text3D is auto-centred by <Center>).
  const numW = value.length * size * 0.7;
  const numH = size * 0.72;   // cap height for helvetiker bold

  const onDown = e => {
    e.stopPropagation();
    pressedRef.current = true;
    onOrbitEnable?.(false);
    try { gl.domElement.setPointerCapture(e.pointerId); } catch (_) {}
    let didDrag = false;
    const start = { x: e.clientX, y: e.clientY };
    const canvas = gl.domElement;
    function move(ev) {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (dx * dx + dy * dy > 25) didDrag = true;
      if (!didDrag || !onMove) return;
      const ray = pointerRay(ev, canvas, camera);
      const hit = planeHit(ray, new THREE.Plane(new THREE.Vector3(0, 1, 0), -topY));
      if (!hit) return;
      const p = shp ? topClamp(shp, hit.x, hit.z, 1.0) : hit;
      onMove({ offsetX: p.x, offsetZ: p.z });
    }
    function up(ev) {
      pressedRef.current = false;
      onOrbitEnable?.(true);
      if (!didDrag && onClick) onClick(ev);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    }
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
  };

  const grabProps = {
    userData: { isStickerHitPlane: true },
    onPointerEnter: e => { e.stopPropagation(); onOrbitEnable?.(false); },
    onPointerLeave: e => { e.stopPropagation(); if (!pressedRef.current) onOrbitEnable?.(true); },
    onPointerDown: onDown,
    onClick: e => e.stopPropagation(),
  };

  const matProps = (color) => ({
    color, metalness: 0.95, roughness: 0.32,
    clearcoat: 0.5, clearcoatRoughness: 0.18, envMapIntensity: 1.0,
    emissive: fin.emissive, emissiveIntensity: selected ? 0.45 : 0.28,
  });

  // Stand upright on the top surface: <Center disableY> centres X & Z but keeps the baseline at
  // y=0, so seating the group at topY lands the digits' base on the cake top. yaw spins it.
  return (
    <group position={[ox, topY + 0.01, oz]} rotation={[0, yaw, 0]}>
      <Center disableY>
        <Text3D
          key={`${value}-${age.finish}`}
          font={helvetikerBold}
          size={size}
          height={size * 0.34}
          curveSegments={12}
          bevelEnabled
          bevelThickness={size * 0.07}
          bevelSize={size * 0.05}
          bevelOffset={0}
          bevelSegments={6}
        >
          {value}
          <meshPhysicalMaterial attach="material-0" {...matProps(fin.face)} />
          <meshPhysicalMaterial attach="material-1" {...matProps(fin.side)} />
        </Text3D>
      </Center>
      {/* upright grab plane just in front of the number */}
      <mesh position={[0, numH / 2, size * 0.22]} {...grabProps}>
        <planeGeometry args={[numW + size * 0.3, numH + size * 0.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
