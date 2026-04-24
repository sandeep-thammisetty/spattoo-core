import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text3D, Center, Html, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import CakeTier from './CakeTier';
import { Drip, TopFlowers, SideFlowers } from './Decorations';

function darkenHex(hex, amount) {
  if (!hex || !hex.startsWith('#')) return '#888';
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const f = 1 - amount;
  return '#' +
    Math.round(r * f).toString(16).padStart(2,'0') +
    Math.round(g * f).toString(16).padStart(2,'0') +
    Math.round(b * f).toString(16).padStart(2,'0');
}

function cylinderHit(ray, radius) {
  const { origin: o, direction: d } = ray;
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (o.x * d.x + o.z * d.z);
  const c = o.x * o.x + o.z * o.z - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const p = ray.at(t, new THREE.Vector3());
  return { theta: Math.atan2(p.x, p.z), y: p.y };
}

function glyphAdvance(char) {
  const g = helvetikerBold.glyphs[char] ?? helvetikerBold.glyphs['?'];
  if (!g) return 0.6;
  return (g.ha ?? 0) / (helvetikerBold.resolution ?? 1000);
}

function DraggableText({ textEl, radius, selected, onSelect, onMove: onMove_prop, onContentChange, onOrbitEnable, toolbar }) {
  const { camera, gl } = useThree();
  const didDrag      = useRef(false);
  const startPos     = useRef({ x: 0, y: 0 });
  const startHit     = useRef(null);
  const startTextPos = useRef(null);
  const dragR        = useRef(0);
  const inputRef     = useRef();

  useEffect(() => {
    if (selected) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selected]);

  const surfaceR = radius + 0.015;
  const cx = surfaceR * Math.sin(textEl.theta);
  const cz = surfaceR * Math.cos(textEl.theta);
  const chars = textEl.content.split('');
  const faceColor = textEl.color || '#ffffff';
  const sideColor = darkenHex(faceColor, 0.38);
  const fs = textEl.fontSize || 0.2;

  const LETTER_SPACING = fs * 0.04;
  const charWidths = chars.map(c => glyphAdvance(c) * fs + LETTER_SPACING);
  const totalWidth = charWidths.reduce((s, w) => s + w, 0);
  const hitW = Math.max(0.5, totalWidth + fs * 0.4);

  const boxGeom = useMemo(
    () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(hitW + 0.12, fs * 1.6)),
    [hitW, fs]
  );

  function pointerRay(e) {
    const rect = gl.domElement.getBoundingClientRect();
    const ndx  = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndy  = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    const rc   = new THREE.Raycaster();
    rc.setFromCamera({ x: ndx, y: ndy }, camera);
    return rc.ray;
  }

  const totalArcAngle = totalWidth / surfaceR;

  return (
    <group>
      {chars.map((char, i) => {
        let cumWidth = 0;
        for (let j = 0; j < i; j++) cumWidth += charWidths[j];
        cumWidth += charWidths[i] / 2;
        const angle = textEl.theta + (cumWidth - totalWidth / 2) / surfaceR;
        const px = surfaceR * Math.sin(angle);
        const pz = surfaceR * Math.cos(angle);
        return (
          <group key={i} position={[px, textEl.y, pz]} rotation={[0, angle, 0]}>
            <Center disableY disableZ>
              <Text3D
                font={helvetikerBold}
                size={fs}
                height={fs * 0.22}
                curveSegments={10}
                bevelEnabled
                bevelThickness={fs * 0.05}
                bevelSize={fs * 0.04}
                bevelSegments={5}
              >
                {char}
                <meshStandardMaterial
                  attach="material-0"
                  color={faceColor}
                  roughness={0.78}
                  metalness={0.0}
                  emissive={selected ? '#6c47ff' : '#000000'}
                  emissiveIntensity={selected ? 0.10 : 0}
                />
                <meshStandardMaterial
                  attach="material-1"
                  color={sideColor}
                  roughness={0.88}
                  metalness={0.0}
                />
              </Text3D>
            </Center>
          </group>
        );
      })}

      <group position={[cx, textEl.y, cz]} rotation={[0, textEl.theta, 0]}>
        {selected && (
          <lineSegments position={[0, 0, 0.02]} geometry={boxGeom}>
            <lineBasicMaterial color="#6c47ff" />
          </lineSegments>
        )}
        {selected && toolbar && (
          <Html position={[0, fs * 1.4 + 0.15, 0.05]} center zIndexRange={[200, 0]}>
            {toolbar}
          </Html>
        )}
        {selected && (
          <Html center zIndexRange={[150, 0]}>
            <input
              ref={inputRef}
              value={textEl.content}
              onChange={e => onContentChange(textEl.id, e.target.value)}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              style={{
                background:'transparent', border:'none', outline:'none',
                color:'transparent', caretColor:'transparent',
                fontSize:16, textAlign:'center',
                width: Math.max(160, textEl.content.length * 13 + 40),
              }}
            />
          </Html>
        )}
        <mesh position={[0, 0, 0.02]}
        onPointerDown={e => {
          e.stopPropagation();
          didDrag.current      = false;
          startPos.current     = { x: e.clientX, y: e.clientY };
          dragR.current        = surfaceR;
          startHit.current     = cylinderHit(pointerRay(e), surfaceR);
          startTextPos.current = { theta: textEl.theta, y: textEl.y };
          onOrbitEnable(false);

          const canvas = gl.domElement;

          function onMove(ev) {
            const dx = ev.clientX - startPos.current.x;
            const dy = ev.clientY - startPos.current.y;
            if (dx * dx + dy * dy > 25) didDrag.current = true;
            if (didDrag.current && startHit.current) {
              const hit = cylinderHit(pointerRay(ev), dragR.current);
              if (hit) onMove_prop(textEl.id, {
                theta: startTextPos.current.theta + (hit.theta - startHit.current.theta),
                y:     startTextPos.current.y     + (hit.y     - startHit.current.y),
              });
            }
          }

          function onUp() {
            onOrbitEnable(true);
            if (!didDrag.current) onSelect(textEl.id);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup',   onUp);
          }

          canvas.addEventListener('pointermove', onMove);
          canvas.addEventListener('pointerup',   onUp);
        }}
        onClick={e => e.stopPropagation()}>
        <planeGeometry args={[hitW, fs * 1.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      </group>
    </group>
  );
}

function CakeTopper({ glbPath, topY, topRadius, scaleMultiplier = 1, onClick }) {
  const { scene } = useGLTF(glbPath);

  const { scale, yPos } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sc = (topRadius * 1.8) / Math.max(size.x, size.z, 0.01);
    return { scale: sc, yPos: topY - box.min.y * sc };
  }, [scene, topRadius, topY]);

  return (
    <primitive
      object={scene}
      position={[0, yPos, 0]}
      scale={scale * scaleMultiplier}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
    />
  );
}

const PICKER_ORIGIN_X = -0.5;
const PICKER_STEP_X   = -0.62;
const PICKER_ORIGIN_Z =  2.0;
const PICKER_STEP_Z   = +0.52;

function StyleTile({ id, label, glbPath, position, onSelect }) {
  const [px, py, pz] = position;
  const { scene } = useGLTF(glbPath);

  const { geo, scale } = useMemo(() => {
    let g = null;
    scene.traverse(obj => { if (obj.isMesh && !g) g = obj.geometry.clone(); });
    if (!g) return { geo: null, scale: 1 };
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    g.computeBoundingBox();
    const box = g.boundingBox;
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    g.translate(-center.x, -box.min.y, -center.z);
    return { geo: g, scale: 0.38 / size.y };
  }, [scene]);

  if (!geo) return null;
  return (
    <group position={[px, py, pz]}>
      <mesh geometry={geo} scale={scale} castShadow
        onClick={e => { e.stopPropagation(); onSelect({ id, glbUrl: glbPath, name: label }); }}>
        <meshPhysicalMaterial color="#f5e6c8" roughness={0.82} sheen={0.4} sheenRoughness={0.9} sheenColor="#f5e6c8" />
      </mesh>
      <Html position={[0, -0.28, 0]} center zIndexRange={[300, 0]}>
        <div onClick={() => onSelect({ id, glbUrl: glbPath, name: label })} style={{
          fontSize: 9, fontWeight: 700, color: '#9b5f72',
          cursor: 'pointer', letterSpacing: 0.5,
          textTransform: 'uppercase', fontFamily: "'Quicksand',sans-serif",
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function CreamStylePicker({ styles = [], onSelect, onCancel }) {
  const positions = styles.map((_, i) => [
    PICKER_ORIGIN_X + i * PICKER_STEP_X,
    0.02,
    PICKER_ORIGIN_Z + i * PICKER_STEP_Z,
  ]);
  const midX = positions[Math.floor(positions.length / 2)]?.[0] ?? 0;
  const midZ = positions[Math.floor(positions.length / 2)]?.[2] ?? 3;

  return (
    <group>
      {styles.map((s, i) => (
        <StyleTile key={s.id} id={s.id} label={s.name} glbPath={s.image_url} position={positions[i]} onSelect={onSelect} />
      ))}
      <Html position={[midX, -0.5, midZ]} center zIndexRange={[300, 0]}>
        <button onClick={onCancel} style={{
          fontSize: 11, fontWeight: 700, padding: '6px 22px', borderRadius: 20,
          border: '1.5px solid #e0d0d5', background: '#fff', color: '#9b5f72',
          cursor: 'pointer', fontFamily: "'Quicksand',sans-serif",
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          Cancel
        </button>
      </Html>
    </group>
  );
}

function CakeScene({
  config, selectedTier, onTierClick, onDeselect,
  selectedTextId, onTextSelect, onTextMove, onTextContentChange, textToolbar,
  orbitRef,
  selectedPiping, onTopPipingSelect, onBottomPipingSelect,
  pipingTarget, onPipingStyleSelect, onPipingCancel, pipingStyles,
  pipingToolbar,
  onTopperClick,
}) {
  const { tiers, texts = [], topper = null } = config;

  let stackY = 0.1;
  const tierData = tiers.map(tier => {
    const baseY = stackY;
    stackY += tier.height;
    return { ...tier, baseY };
  });

  const bottomTier = tierData[0];
  const minTextY = 0.1 + 0.18;
  const maxTextY = stackY - 0.18;

  return (
    <>
      <color attach="background" args={['#fdf0f5']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 14, 8]} intensity={1.5} castShadow />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} />
      <Environment preset="apartment" backgroundBlurriness={1} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow
        onClick={e => { e.stopPropagation(); onDeselect(); }}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#fce8d5" roughness={0.85} />
      </mesh>

      <mesh position={[0, 0.05, 0]} castShadow receiveShadow
        onClick={e => { e.stopPropagation(); onDeselect(); }}>
        <cylinderGeometry args={[bottomTier.radius + 0.6, bottomTier.radius + 0.6, 0.1, 64]} />
        <meshStandardMaterial color="#d4af37" roughness={0.15} metalness={0.75} />
      </mesh>

      {tierData.map((tier, i) => (
        <group key={i}>
          <CakeTier
            radius={tier.radius}
            height={tier.height}
            color={tier.color}
            yBase={tier.baseY}
            frostingType={tier.frostingType}
            selected={selectedTier === i}
            topPiping={tier.topPiping}
            bottomPiping={tier.bottomPiping}
            topPipingSelected={selectedPiping?.tierIndex === i && selectedPiping?.zone === 'top'}
            bottomPipingSelected={selectedPiping?.tierIndex === i && selectedPiping?.zone === 'bottom'}
            onTopPipingClick={e => { e.stopPropagation(); onTopPipingSelect(i); }}
            onBottomPipingClick={e => { e.stopPropagation(); onBottomPipingSelect(i); }}
            onClick={e => { e.stopPropagation(); onTierClick(i); }}
          />
          {selectedPiping?.tierIndex === i && pipingToolbar && (
            <Html
              position={[tier.radius + 0.35, tier.baseY + (selectedPiping.zone === 'top' ? tier.height + 0.1 : 0.1), 0]}
              zIndexRange={[200, 0]}
            >
              {pipingToolbar}
            </Html>
          )}
        </group>
      ))}

      {topper?.image_url && (
        <CakeTopper
          glbPath={topper.image_url}
          topY={stackY}
          topRadius={tierData[tierData.length - 1].radius}
          scaleMultiplier={topper.scale ?? 1}
          onClick={onTopperClick}
        />
      )}

      {pipingTarget && (
        <CreamStylePicker styles={pipingStyles} onSelect={onPipingStyleSelect} onCancel={onPipingCancel} />
      )}

      {texts.map(t => {
        const hostTier = tierData.find(td => t.y >= td.baseY && t.y < td.baseY + td.height)
          ?? tierData[0];
        return (
          <DraggableText
            key={t.id}
            textEl={t}
            radius={hostTier.radius}
            selected={selectedTextId === t.id}
            onSelect={onTextSelect}
            onMove={(id, pos) => onTextMove(id, {
                theta: pos.theta,
                y: Math.max(minTextY, Math.min(maxTextY, pos.y)),
              })}
            onContentChange={onTextContentChange}
            toolbar={selectedTextId === t.id ? textToolbar : null}
            onOrbitEnable={enabled => { if (orbitRef.current) orbitRef.current.enabled = enabled; }}
          />
        );
      })}
    </>
  );
}

function CakeThumbnailScene({ config }) {
  const { tiers, topper = null } = config;

  let stackY = 0.1;
  const tierData = tiers.map(tier => {
    const baseY = stackY;
    stackY += tier.height;
    return { ...tier, baseY };
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 14, 8]} intensity={1.5} />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} />
      {tierData.map((tier, i) => (
        <CakeTier
          key={i}
          radius={tier.radius}
          height={tier.height}
          color={tier.color}
          yBase={tier.baseY}
          frostingType={tier.frostingType}
          selected={false}
          topPiping={tier.topPiping}
          bottomPiping={tier.bottomPiping}
          topPipingSelected={false}
          bottomPipingSelected={false}
          onTopPipingClick={() => {}}
          onBottomPipingClick={() => {}}
          onClick={() => {}}
        />
      ))}
      {topper?.image_url && (
        <CakeTopper
          glbPath={topper.image_url}
          topY={stackY}
          topRadius={tierData[tierData.length - 1].radius}
          scaleMultiplier={topper.scale ?? 1}
        />
      )}
    </>
  );
}

export function CakeThumbnailCanvas({ config, containerRef }) {
  return (
    <div ref={containerRef} style={{ position: 'absolute', left: -9999, top: -9999, width: 400, height: 400 }}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        camera={{ position: [4.5, 5.5, 6.5], fov: 42 }}
        style={{ width: 400, height: 400 }}
      >
        <CakeThumbnailScene config={config} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} target={[0, 2, 0]} />
      </Canvas>
    </div>
  );
}

export default function CakeCanvas({
  config, selectedTier, onTierClick, onDeselect,
  selectedTextId, onTextSelect, onTextMove, onTextContentChange, textToolbar,
  autoRotate = true,
  selectedPiping, onTopPipingSelect, onBottomPipingSelect,
  pipingTarget, onPipingStyleSelect, onPipingCancel, pipingStyles = [],
  pipingToolbar,
  onTopperClick, topperSelected = false,
}) {
  const pointerRef = useRef({ x: 0, y: 0, dragged: false });
  const orbitRef   = useRef();

  return (
    <Canvas
      shadows
      camera={{ position: [4.5, 5.5, 6.5], fov: 42 }}
      style={{ position: 'absolute', inset: 0 }}
      gl={{ preserveDrawingBuffer: true }}
      onPointerDown={e => { pointerRef.current = { x: e.clientX, y: e.clientY, dragged: false }; }}
      onPointerMove={e => {
        const dx = e.clientX - pointerRef.current.x;
        const dy = e.clientY - pointerRef.current.y;
        if (dx * dx + dy * dy > 25) pointerRef.current.dragged = true;
      }}
    >
      <CakeScene
        config={config}
        selectedTier={selectedTier}
        onTierClick={i  => { if (!pointerRef.current.dragged) onTierClick(i); }}
        onDeselect={()  => { if (!pointerRef.current.dragged) onDeselect(); }}
        selectedPiping={selectedPiping}
        onTopPipingSelect={i => { if (!pointerRef.current.dragged) onTopPipingSelect(i); }}
        onBottomPipingSelect={i => { if (!pointerRef.current.dragged) onBottomPipingSelect(i); }}
        pipingTarget={pipingTarget}
        onPipingStyleSelect={onPipingStyleSelect}
        onPipingCancel={onPipingCancel}
        pipingStyles={pipingStyles}
        pipingToolbar={pipingToolbar}
        selectedTextId={selectedTextId}
        onTextSelect={onTextSelect}
        onTextMove={onTextMove}
        onTextContentChange={onTextContentChange}
        textToolbar={textToolbar}
        orbitRef={orbitRef}
        onTopperClick={() => { if (!pointerRef.current.dragged) onTopperClick?.(); }}
      />
      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        autoRotate={autoRotate && selectedTier === null && selectedTextId === null && !pipingTarget && !topperSelected}
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 2, 0]}
      />
    </Canvas>
  );
}
