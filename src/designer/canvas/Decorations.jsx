import { useMemo } from 'react';
import * as THREE from 'three';

// ── Drip ─────────────────────────────────────────────────────────────────────
export function Drip({ radius, topY, color }) {
  const drips = useMemo(() => {
    const count = 20;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.sin(i * 7) * 0.15);
      const len   = 0.18 + Math.abs(Math.sin(i * 3.7)) * 0.36;
      return {
        len,
        cx: Math.cos(angle) * radius * 0.97,
        cz: Math.sin(angle) * radius * 0.97,
      };
    });
  }, [radius]);

  return (
    <group>
      {drips.map((d, i) => (
        <group key={i}>
          <mesh position={[d.cx, topY - d.len / 2, d.cz]} castShadow>
            <cylinderGeometry args={[0.032, 0.018, d.len, 8]} />
            <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} />
          </mesh>
          <mesh position={[d.cx, topY - d.len, d.cz]} castShadow>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Single rose-style flower ──────────────────────────────────────────────────
function Rose({ position, rotation, scale = 1, petalColor }) {
  const leafColor = '#7a9e6e';

  // Outer petals — 6, wide
  const outerPetals = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return { angle, rx: Math.cos(angle), rz: Math.sin(angle) };
  });

  // Inner petals — 4, tighter
  const innerPetals = Array.from({ length: 4 }, (_, i) => {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { angle, rx: Math.cos(angle), rz: Math.sin(angle) };
  });

  // Leaves — 2, offset sides
  const leaves = [
    { angle: -0.6 },
    { angle:  0.6 },
  ];

  const s = scale;

  return (
    <group position={position} rotation={rotation}>
      {/* Outer petals */}
      {outerPetals.map((p, i) => (
        <mesh
          key={`op${i}`}
          position={[p.rx * 0.18 * s, -0.02 * s, p.rz * 0.18 * s]}
          rotation={[0.3, p.angle, 0]}
          castShadow
        >
          <sphereGeometry args={[0.1 * s, 8, 6]} />
          <meshStandardMaterial color={petalColor} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Inner petals */}
      {innerPetals.map((p, i) => (
        <mesh
          key={`ip${i}`}
          position={[p.rx * 0.09 * s, 0.04 * s, p.rz * 0.09 * s]}
          rotation={[0.5, p.angle, 0]}
          castShadow
        >
          <sphereGeometry args={[0.07 * s, 8, 6]} />
          <meshStandardMaterial color={petalColor} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Centre bud */}
      <mesh position={[0, 0.08 * s, 0]} castShadow>
        <sphereGeometry args={[0.055 * s, 8, 8]} />
        <meshStandardMaterial color={lightenColor(petalColor, 0.15)} roughness={0.3} />
      </mesh>

      {/* Leaves */}
      {leaves.map((l, i) => (
        <mesh
          key={`lf${i}`}
          position={[Math.cos(l.angle) * 0.22 * s, -0.06 * s, Math.sin(l.angle) * 0.22 * s]}
          rotation={[-0.2, l.angle, 0.3]}
          castShadow
        >
          <sphereGeometry args={[0.1 * s, 8, 5]} />
          <meshStandardMaterial color={leafColor} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ── Flowers on TOP of tier ────────────────────────────────────────────────────
export function TopFlowers({ topY, color }) {
  const flowers = useMemo(() => [
    { x:  0,    z:  0,    scale: 1.0 },
    { x:  0.38, z:  0.22, scale: 0.8 },
    { x: -0.36, z:  0.20, scale: 0.75 },
    { x:  0.15, z: -0.38, scale: 0.75 },
    { x: -0.32, z: -0.28, scale: 0.7  },
  ], []);

  return (
    <group>
      {flowers.map((f, i) => (
        <Rose
          key={i}
          position={[f.x, topY + 0.05, f.z]}
          rotation={[-Math.PI / 2, 0, Math.random() * Math.PI * 2]}
          scale={f.scale}
          petalColor={color}
        />
      ))}
    </group>
  );
}

// ── Flowers on SIDES of tier ──────────────────────────────────────────────────
export function SideFlowers({ radius, baseY, height, color }) {
  // Distribute flowers around the circumference at varying heights
  const flowers = useMemo(() => [
    { angle: 0,                  yFrac: 0.65 },
    { angle: Math.PI * 0.38,     yFrac: 0.35 },
    { angle: Math.PI * 0.72,     yFrac: 0.60 },
    { angle: Math.PI,            yFrac: 0.40 },
    { angle: Math.PI * 1.35,     yFrac: 0.65 },
    { angle: Math.PI * 1.68,     yFrac: 0.38 },
    { angle: Math.PI * 0.18,     yFrac: 0.85 },
    { angle: Math.PI * 1.52,     yFrac: 0.80 },
  ], []);

  return (
    <group>
      {flowers.map((f, i) => {
        const x = Math.cos(f.angle) * (radius + 0.04);
        const z = Math.sin(f.angle) * (radius + 0.04);
        const y = baseY + height * f.yFrac;

        // Rotate flower to face outward from the cake surface
        const outwardAngle = f.angle + Math.PI / 2;

        return (
          <Rose
            key={i}
            position={[x, y, z]}
            rotation={[0, -f.angle, 0]}
            scale={0.75}
            petalColor={color}
          />
        );
      })}
    </group>
  );
}

// ── Util ──────────────────────────────────────────────────────────────────────
function lightenColor(hex, amount) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r + amount);
  c.g = Math.min(1, c.g + amount);
  c.b = Math.min(1, c.b + amount);
  return c;
}
