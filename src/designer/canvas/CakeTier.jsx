import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

// ── Extract the single mesh from a per-style GLB ──────────────────────────────
function extractGeo(scene) {
  let geo = null;
  scene.traverse(obj => {
    if (obj.isMesh && !geo) geo = obj.geometry.clone();
  });
  if (!geo) return null;
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  geo.translate(-center.x, -box.min.y, -center.z);
  return { geo, sizeY: size.y };
}

const DEG = Math.PI / 180;

// Bend a flat piping ring into `swagCount` scalloped drapes (garland/swag look).
// Returns one entry per shell { pos, rotY, tq }:
//   pos  — world position, with the scallop drop baked into y
//   rotY — yaw so the shell faces outward (same as the flat ring)
//   tq   — a quaternion [x,y,z,w] that pitches the shell about the WORLD radial
//          axis to follow the drape's slope. Pitching about the radial axis (not a
//          shell-local axis) is independent of the GLB's internal orientation, so it
//          leans the upright shell along the drape instead of rolling it.
// Shells are spaced by equal arc-length ALONG the draped curve (not the flat circle)
// so they stay touching through the dips. swagDepth/swagTilt are in cake units / 0–1.
// The calibrator (PipingCalibrator.jsx) keeps an identical copy for an exact preview.
function buildSwagRing({ r, baseY, step, swagCount, swagDepth, swagTilt = 0.5 }) {
  const dipAt = a => -swagDepth * (1 - Math.cos(a * swagCount)) / 2;
  // Sample the wavy circle and accumulate arc length.
  const N = 1440;
  const cum = [0];
  let px = r, py = baseY + dipAt(0), pz = 0;
  for (let s = 1; s <= N; s++) {
    const a = (s / N) * Math.PI * 2;
    const cx = Math.cos(a) * r, cy = baseY + dipAt(a), cz = Math.sin(a) * r;
    cum.push(cum[s - 1] + Math.hypot(cx - px, cy - py, cz - pz));
    px = cx; py = cy; pz = cz;
  }
  const total = cum[N];
  const count = Math.max(6, Math.round(total / step));
  const out = [];
  let seg = 0;
  for (let j = 0; j < count; j++) {
    const target = (j / count) * total;            // monotonically increasing
    while (seg < N && cum[seg + 1] < target) seg++;
    const a0 = (seg / N) * Math.PI * 2, a1 = ((seg + 1) / N) * Math.PI * 2;
    const f  = (target - cum[seg]) / Math.max(1e-9, cum[seg + 1] - cum[seg]);
    const a  = a0 + (a1 - a0) * f;
    const slope = -(swagDepth * swagCount / 2) * Math.sin(a * swagCount); // d(dip)/d(angle)
    const tilt  = -swagTilt * Math.atan2(slope, r);
    const sh = Math.sin(tilt / 2), ch = Math.cos(tilt / 2);
    // Rotation about world radial axis (cos a, 0, sin a).
    const tq = [Math.cos(a) * sh, 0, Math.sin(a) * sh, ch];
    out.push({ pos: [Math.cos(a) * r, baseY + dipAt(a), Math.sin(a) * r], rotY: a, tq });
  }
  return out;
}

// ── Top piping ring — GLB shells hugging the top edge ─────────────────────────
// Mirrors BottomPipingRing's placement model so the rim is driven entirely by
// placement_config (top_rotation / top_radial_offset / top_y_offset / top_flip),
// just anchored at the top edge instead of the base.
function TopPipingRing({
  topY, radius, glbPath, color = '#ffffff', sizeFactor = 1,
  topRotation       = [0, 0, 0],
  extraRadialOffset = 0,
  yOffset           = 0,
  flipTop = false,
  swagCount = 0, swagDepth = 0, swagTilt = 0.5,
  selected = false, onClick,
}) {
  const { scene } = useGLTF(glbPath);

  const { geometry, shellScale, bbDepth, bbWidth } = useMemo(() => {
    const result = extractGeo(scene);
    if (!result) return { geometry: null, shellScale: 1, bbDepth: 0, bbWidth: 0 };
    const geo = result.geo;
    if (flipTop) {
      geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
    }
    const sc = (radius * 0.24) / result.sizeY * sizeFactor;
    geo.computeBoundingBox();
    const bbSize = new THREE.Vector3(); geo.boundingBox.getSize(bbSize);
    return { geometry: geo, shellScale: sc, bbDepth: bbSize.z, bbWidth: bbSize.x };
  }, [scene, radius, sizeFactor, flipTop]);

  const positions = useMemo(() => {
    if (!geometry) return [];
    // Rim sits ON the top surface: pull shells inward so their outer face is flush
    // with the edge rather than overhanging the side like the board does.
    const r    = radius - (bbDepth / 2) * shellScale + extraRadialOffset;
    const step = shellScale * bbWidth * 0.9 * sizeFactor;
    if (swagCount > 0 && swagDepth > 0) {
      return buildSwagRing({ r, baseY: topY + yOffset, step, swagCount, swagDepth, swagTilt });
    }
    const count = Math.max(6, Math.round((2 * Math.PI * radius) / step));
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return { pos: [Math.cos(angle) * r, topY + yOffset, Math.sin(angle) * r], rotY: angle, tq: [0, 0, 0, 1] };
    });
  }, [geometry, radius, topY, yOffset, sizeFactor, shellScale, bbDepth, bbWidth, extraRadialOffset, swagCount, swagDepth, swagTilt]);

  if (!geometry) return null;

  const ryGroup = topRotation[1] * DEG;
  const meshRot = [topRotation[0] * DEG, 0, topRotation[2] * DEG];

  return (
    <group onClick={onClick}>
      {positions.map((u, i) => (
        <group key={i} position={u.pos} quaternion={u.tq}>
          <group rotation={[0, -u.rotY + Math.PI / 2 + ryGroup, 0]}>
            <mesh geometry={geometry} rotation={meshRot} scale={shellScale} castShadow>
              <meshPhysicalMaterial
                color={color} roughness={0.85}
                sheen={0.4} sheenRoughness={0.9} sheenColor={color}
                emissive={selected ? '#6c47ff' : '#000000'}
                emissiveIntensity={selected ? 0.15 : 0}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ── Bottom piping ring — GLB shells hugging the cake base ─────────────────────
function BottomPipingRing({
  yBase, radius, glbPath, color = '#f5e6c8', sizeFactor = 1,
  bottomRotation    = [0, 0, 0],
  extraRadialOffset = 0,
  yOffset           = 0,
  flipBottom = true,
  swagCount = 0, swagDepth = 0, swagTilt = 0.5,
  selected = false, onClick,
}) {
  const { scene } = useGLTF(glbPath);

  const { geometry, shellScale, bbDepth, bbWidth } = useMemo(() => {
    const result = extractGeo(scene);
    if (!result) return { geometry: null, shellScale: 1, bbDepth: 0, bbWidth: 0 };
    const geo = result.geo;
    if (flipBottom) {
      geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
    }
    const sc = (radius * 0.24) / result.sizeY * sizeFactor;
    geo.computeBoundingBox();
    const bbSize = new THREE.Vector3(); geo.boundingBox.getSize(bbSize);
    return { geometry: geo, shellScale: sc, bbDepth: bbSize.z, bbWidth: bbSize.x };
  }, [scene, radius, sizeFactor, flipBottom]);

  const positions = useMemo(() => {
    if (!geometry) return [];
    const r    = radius + (bbDepth / 2) * shellScale + extraRadialOffset;
    const step = shellScale * bbWidth * 0.9 * sizeFactor;
    if (swagCount > 0 && swagDepth > 0) {
      return buildSwagRing({ r, baseY: yBase + yOffset, step, swagCount, swagDepth, swagTilt });
    }
    const count = Math.max(6, Math.round((2 * Math.PI * radius) / step));
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        pos: [Math.cos(angle) * r, yBase + yOffset, Math.sin(angle) * r],
        rotY: angle,
        tq: [0, 0, 0, 1],
      };
    });
  }, [geometry, radius, yBase, yOffset, sizeFactor, shellScale, bbDepth, bbWidth, extraRadialOffset, swagCount, swagDepth, swagTilt]);

  if (!geometry) return null;

  // Y rotation belongs on the group (rotY already makes piece face outward; ry offsets
  // the facing direction consistently for all positions around the ring).
  // X and Z are tilt/roll applied in the final local frame — same for every piece.
  const ryGroup = bottomRotation[1] * DEG;
  const meshRot = [bottomRotation[0] * DEG, 0, bottomRotation[2] * DEG];

  return (
    <group onClick={onClick}>
      {positions.map((u, i) => (
        <group key={i} position={u.pos} quaternion={u.tq}>
          <group rotation={[0, -u.rotY + Math.PI / 2 + ryGroup, 0]}>
            <mesh geometry={geometry} rotation={meshRot} scale={shellScale} castShadow>
              <meshPhysicalMaterial
                color={color} roughness={0.85}
                sheen={0.4} sheenRoughness={0.9} sheenColor={color}
                emissive={selected ? '#6c47ff' : '#000000'}
                emissiveIntensity={selected ? 0.15 : 0}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ── Piped rosette — spiral TubeGeometry ──────────────────────────────────────
function PipedRosette({ position, color, scale = 1 }) {
  const geometry = useMemo(() => {
    const points = [];
    const loops = 2.6;
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * loops * Math.PI * 2;
      const r = (1 - t * 0.68) * 0.13 * scale;
      const y = t * 0.10 * scale;
      points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.022 * scale, 7, false);
  }, [scale]);

  return (
    <mesh geometry={geometry} position={position} castShadow>
      <meshStandardMaterial color={color} roughness={0.62} />
    </mesh>
  );
}

function PipedTop({ topY, radius, color }) {
  const spots = useMemo(() => {
    const ringR = radius * 0.6;
    const count = Math.max(5, Math.round(radius * 5.5));
    const result = [{ x: 0, z: 0, scale: 1.0 }];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      result.push({ x: Math.cos(angle) * ringR, z: Math.sin(angle) * ringR, scale: 0.76 });
    }
    return result;
  }, [radius]);

  return (
    <group>
      {spots.map((s, i) => (
        <PipedRosette key={i} position={[s.x, topY + 0.01, s.z]} color={color} scale={s.scale} />
      ))}
    </group>
  );
}

const SPONGE_COLORS = {
  vanilla:      '#f0d98a',
  chocolate:    '#4a2210',
  redvelvet:    '#8b1a1a',
  butterscotch: '#c8860a',
};

function NakedLayers({ radius, yBase, height, flavour }) {
  const spongeColor = SPONGE_COLORS[flavour] || '#f0d98a';
  const layers  = 3;
  const spongeH = (height * 0.62) / layers;
  const creamH  = (height * 0.38) / (layers - 1);

  const stack = [];
  let y = yBase;
  for (let i = 0; i < layers; i++) {
    stack.push({ y, h: spongeH, color: spongeColor, rough: 0.88 });
    y += spongeH;
    if (i < layers - 1) {
      stack.push({ y, h: creamH, color: '#fffdf5', rough: 0.50 });
      y += creamH;
    }
  }

  return (
    <group>
      {stack.map((layer, i) => (
        <mesh key={i} position={[0, layer.y + layer.h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius, radius, layer.h, 64]} />
          <meshStandardMaterial color={layer.color} roughness={layer.rough} />
        </mesh>
      ))}
    </group>
  );
}

const FROSTING_MAT = {
  buttercream: { roughness: 0.68, metalness: 0.00 },
  whipped:     { roughness: 0.82, metalness: 0.00 },
  fondant:     { roughness: 0.08, metalness: 0.03 },
};

// ── Selection outline ─────────────────────────────────────────────────────────
function SelectionOutline({ radius, yBase, height }) {
  const geometry = useMemo(() => {
    const cyl = new THREE.CylinderGeometry(radius + 0.05, radius + 0.05, height + 0.05, 20);
    return new THREE.EdgesGeometry(cyl);
  }, [radius, height]);

  return (
    <lineSegments position={[0, yBase + height / 2, 0]} geometry={geometry}>
      <lineBasicMaterial color="#6c47ff" linewidth={2} />
    </lineSegments>
  );
}

export default function CakeTier({
  radius, height, color, yBase,
  frostingType = 'buttercream',
  flavour = 'vanilla',
  selected = false,
  topPiping = null,
  bottomPiping = null,
  topPipingSelected = false,
  bottomPipingSelected = false,
  onTopPipingClick,
  onBottomPipingClick,
  onClick,
}) {
  const topY    = yBase + height;
  const centerY = yBase + height / 2;
  const mat = FROSTING_MAT[frostingType] ?? FROSTING_MAT.buttercream;

  function handleClick(e) {
    e.stopPropagation();
    if (topPiping && e.point.y > topY - height * 0.25) {
      onTopPipingClick?.(e);
    } else if (bottomPiping && e.point.y < yBase + height * 0.25) {
      onBottomPipingClick?.(e);
    } else {
      onClick?.(e);
    }
  }

  if (frostingType === 'naked') {
    return (
      <group onClick={handleClick}>
        {selected && <SelectionOutline radius={radius} yBase={yBase} height={height} />}
        <NakedLayers radius={radius} yBase={yBase} height={height} flavour={flavour} />
        <mesh position={[0, topY + 0.01, 0]}>
          <cylinderGeometry args={[radius - 0.01, radius - 0.01, 0.02, 64]} />
          <meshStandardMaterial color="#fffdf5" roughness={0.5} />
        </mesh>
        {topPiping && (
          <TopPipingRing topY={topY} radius={radius} glbPath={topPiping.glbUrl} color={topPiping.color}
            sizeFactor={topPiping.size ?? 1}
            topRotation={topPiping.rotation ?? [0,0,0]}
            extraRadialOffset={topPiping.extraRadialOffset ?? 0}
            yOffset={(topPiping.yOffset ?? 0) + (topPiping.userYOffset ?? 0)}
            flipTop={topPiping.userFlipTop !== undefined ? topPiping.userFlipTop : (topPiping.flipTop ?? false)}
            swagCount={topPiping.swagCount ?? 0} swagDepth={topPiping.swagDepth ?? 0} swagTilt={topPiping.swagTilt ?? 0.5}
            selected={topPipingSelected} onClick={e => { e.stopPropagation(); onTopPipingClick?.(e); }} />
        )}
        {bottomPiping && (
          <BottomPipingRing yBase={yBase} radius={radius} glbPath={bottomPiping.glbUrl} color={bottomPiping.color}
            sizeFactor={bottomPiping.size ?? 1}
            bottomRotation={bottomPiping.bottomRotation ?? [0,0,0]}
            extraRadialOffset={bottomPiping.extraRadialOffset ?? 0}
            yOffset={(bottomPiping.yOffset ?? 0) + (bottomPiping.userYOffset ?? 0)}
            flipBottom={bottomPiping.userFlipBottom !== undefined ? bottomPiping.userFlipBottom : (bottomPiping.flipBottom ?? true)}
            swagCount={bottomPiping.swagCount ?? 0} swagDepth={bottomPiping.swagDepth ?? 0} swagTilt={bottomPiping.swagTilt ?? 0.5}
            selected={bottomPipingSelected} onClick={e => { e.stopPropagation(); onBottomPipingClick?.(e); }} />
        )}
      </group>
    );
  }

  return (
    <group onClick={handleClick}>
      {selected && <SelectionOutline radius={radius} yBase={yBase} height={height} />}
      <mesh position={[0, centerY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 64]} />
        <meshStandardMaterial color={color} roughness={mat.roughness} metalness={mat.metalness} />
      </mesh>
      <mesh position={[0, topY + 0.01, 0]} castShadow>
        <cylinderGeometry args={[radius - 0.01, radius - 0.01, 0.02, 64]} />
        <meshStandardMaterial color={color} roughness={mat.roughness - 0.08} />
      </mesh>
      {topPiping && (
        <TopPipingRing topY={topY} radius={radius} glbPath={topPiping.glbUrl} color={topPiping.color}
          sizeFactor={topPiping.size ?? 1}
          topRotation={topPiping.rotation ?? [0,0,0]}
          extraRadialOffset={topPiping.extraRadialOffset ?? 0}
          yOffset={(topPiping.yOffset ?? 0) + (topPiping.userYOffset ?? 0)}
          flipTop={topPiping.userFlipTop !== undefined ? topPiping.userFlipTop : (topPiping.flipTop ?? false)}
          swagCount={topPiping.swagCount ?? 0} swagDepth={topPiping.swagDepth ?? 0} swagTilt={topPiping.swagTilt ?? 0.5}
          selected={topPipingSelected} onClick={e => { e.stopPropagation(); onTopPipingClick?.(e); }} />
      )}
      {bottomPiping && (
        <BottomPipingRing yBase={yBase} radius={radius} glbPath={bottomPiping.glbUrl} color={bottomPiping.color}
          sizeFactor={bottomPiping.size ?? 1}
          bottomRotation={bottomPiping.bottomRotation ?? [0,0,0]}
          extraRadialOffset={bottomPiping.extraRadialOffset ?? 0}
          yOffset={(bottomPiping.yOffset ?? 0) + (bottomPiping.userYOffset ?? 0)}
          flipBottom={bottomPiping.userFlipBottom !== undefined ? bottomPiping.userFlipBottom : (bottomPiping.flipBottom ?? true)}
          swagCount={bottomPiping.swagCount ?? 0} swagDepth={bottomPiping.swagDepth ?? 0} swagTilt={bottomPiping.swagTilt ?? 0.5}
          selected={bottomPipingSelected} onClick={e => { e.stopPropagation(); onBottomPipingClick?.(e); }} />
      )}
    </group>
  );
}
