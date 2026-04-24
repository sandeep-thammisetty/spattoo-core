import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import CakeCanvas from '../designer/canvas/CakeCanvas.jsx';
import { TIER_RADII, FROSTING_TYPES } from '../designer/hooks/useCakeDesign.js';

const TIER_COLORS = ['#f5b8c8', '#ffffff', '#c8dff5', '#d4f5d4'];
const TIER_LABELS = ['Bottom', '2nd', '3rd', 'Top'];

const s = {
  page: {
    display: 'flex', height: '100vh', fontFamily: "'Quicksand', sans-serif",
    background: '#faf6f1', overflow: 'hidden',
  },
  sidebar: {
    width: 300, minWidth: 300, background: '#fff',
    borderRight: '1px solid #f0dce3',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid #f0dce3',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: 16, fontWeight: 800, color: '#6b2d42',
    fontFamily: "'Playfair Display', serif",
  },
  sidebarBody: {
    flex: 1, overflowY: 'auto', padding: '16px 20px',
  },
  sidebarFooter: {
    padding: '14px 20px', borderTop: '1px solid #f0dce3', flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  canvasWrap: {
    flex: 1, position: 'relative', background: '#fdf0f5',
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#9b5f72',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '9px 12px', border: '1.5px solid #f0dce3',
    borderRadius: 8, fontSize: 13, fontFamily: "'Quicksand', sans-serif",
    color: '#2d1b0e', outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '8px 10px', border: '1.5px solid #f0dce3',
    borderRadius: 8, fontSize: 12, fontFamily: "'Quicksand', sans-serif",
    color: '#2d1b0e', background: '#fff', outline: 'none',
    boxSizing: 'border-box',
  },
  tierCard: {
    border: '1.5px solid #f0dce3', borderRadius: 10,
    padding: '12px', marginBottom: 10, background: '#fdf9fb',
  },
  tierHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  tierLabel: {
    fontSize: 11, fontWeight: 700, color: '#9b5f72',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  rowLabel: { fontSize: 11, color: '#b07a8a', width: 80, flexShrink: 0, fontWeight: 600 },
  tierCountRow: {
    display: 'flex', gap: 6, marginBottom: 16,
  },
  tierCountBtn: (active) => ({
    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
    border: `1.5px solid ${active ? '#9b5f72' : '#f0dce3'}`,
    background: active ? '#fdf0f5' : '#fff',
    color: active ? '#6b2d42' : '#b07a8a',
    fontSize: 13, fontWeight: 700,
    fontFamily: "'Quicksand', sans-serif",
  }),
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#c9a0b0',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  pipingRow: {
    display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6,
  },
  pipingLabel: { fontSize: 10, color: '#b07a8a', width: 36, flexShrink: 0, fontWeight: 600 },
  colorDot: (color) => ({
    width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #e0d0d5',
    background: color, flexShrink: 0, cursor: 'pointer',
  }),
  thumbnailBox: {
    width: '100%', height: 120, border: '1.5px dashed #e0d0d5',
    borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', background: '#fdf9fb',
    marginBottom: 8,
  },
  btn: (variant = 'primary') => ({
    width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer',
    border: 'none', fontSize: 13, fontWeight: 700,
    fontFamily: "'Quicksand', sans-serif",
    background: variant === 'primary' ? '#9b5f72' : '#f5eaed',
    color: variant === 'primary' ? '#fff' : '#9b5f72',
  }),
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: '#e57373', padding: 0, lineHeight: 1,
  },
};

function PipingSelect({ label, value, options, onSelect, onColorChange }) {
  return (
    <div style={s.pipingRow}>
      <span style={s.pipingLabel}>{label}</span>
      <select
        style={{ ...s.select, flex: 1 }}
        value={value?.id ?? ''}
        onChange={e => {
          const el = options.find(o => o.id === e.target.value);
          onSelect(el ? { id: el.id, glbUrl: el.image_url, name: el.name, color: value?.color ?? '#f5e6c8' } : null);
        }}
      >
        <option value="">None</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {value && (
        <input
          type="color"
          value={value.color ?? '#f5e6c8'}
          onChange={e => onColorChange(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'none' }}
          title="Piping colour"
        />
      )}
    </div>
  );
}

export default function CreateTemplate({ supabase, thumbnailBucket = 'cake-thumbnails', onSave, onSaved }) {
  const [name, setName] = useState('');
  const [tierCount, setTierCount] = useState(1);
  const [tiers, setTiers] = useState([
    { color: '#f5b8c8', frostingType: 'buttercream', topPiping: null, bottomPiping: null },
  ]);
  const [topper, setTopper] = useState(null);
  const [thumbnail, setThumbnail] = useState(null); // data URL
  const [pipingStyles, setPipingStyles] = useState([]);
  const [topperOptions, setTopperOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const canvasContainerRef = useRef();

  // Load piping styles and toppers from DB
  useEffect(() => {
    supabase
      .from('element_types')
      .select('id, slug')
      .in('slug', ['piping_style', 'topper'])
      .then(({ data }) => {
        if (!data) return;
        const pipingTypeId = data.find(t => t.slug === 'piping_style')?.id;
        const topperTypeId = data.find(t => t.slug === 'topper')?.id;

        if (pipingTypeId) {
          supabase
            .from('cake_elements')
            .select('id, name, image_url, sort_order')
            .eq('element_type_id', pipingTypeId)
            .eq('is_active', true)
            .order('sort_order')
            .then(({ data: els }) => setPipingStyles(els ?? []));
        }
        if (topperTypeId) {
          supabase
            .from('cake_elements')
            .select('id, name, image_url, thumbnail_url, sort_order')
            .eq('element_type_id', topperTypeId)
            .is('parent_id', null)
            .eq('is_active', true)
            .order('sort_order')
            .then(({ data: els }) => setTopperOptions(els ?? []));
        }
      });
  }, []);

  // Keep tiers array in sync with tierCount
  useEffect(() => {
    setTiers(prev => {
      if (tierCount > prev.length) {
        const added = Array.from({ length: tierCount - prev.length }, (_, i) => ({
          color: TIER_COLORS[prev.length + i] ?? '#ffffff',
          frostingType: 'buttercream',
          topPiping: null,
          bottomPiping: null,
        }));
        return [...prev, ...added];
      }
      return prev.slice(0, tierCount);
    });
  }, [tierCount]);

  function updateTier(index, patch) {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
  }

  const canvasConfig = useMemo(() => ({
    tiers: tiers.map((t, i) => ({
      radius:       TIER_RADII[i] ?? 0.35,
      height:       1.45 - i * 0.08,
      color:        t.color,
      frostingType: t.frostingType,
      topPiping:    t.topPiping,
      bottomPiping: t.bottomPiping,
    })),
    texts: [],
    topper: topper ? { ...topper, scale: 1 } : null,
  }), [tiers, topper]);

  function captureThumbnail() {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    setThumbnail(canvas.toDataURL('image/png'));
  }

  async function handleSave() {
    if (!name.trim()) { setSaveMsg({ ok: false, text: 'Name is required.' }); return; }
    setSaving(true);
    setSaveMsg(null);

    const designJson = {
      shape: 'round',
      tiers: tiers.map(t => ({
        color:        t.color,
        frostingType: t.frostingType,
        topPiping:    t.topPiping ?? null,
        bottomPiping: t.bottomPiping ?? null,
        decorations:  [],
        texts:        [],
      })),
      texts:  [],
      topper: topper ?? null,
    };

    const thumbnailBlob = thumbnail ? await (await fetch(thumbnail)).blob() : null;

    try {
      if (onSave) {
        await onSave({ name: name.trim(), tierCount, designJson, thumbnailBlob });
      } else {
        // Legacy: direct Supabase save (fallback)
        let thumbnail_url = null;
        if (thumbnailBlob) {
          const fileName = `template-${Date.now()}.png`;
          const { error: upErr } = await supabase.storage
            .from(thumbnailBucket)
            .upload(fileName, thumbnailBlob, { contentType: 'image/png', upsert: false });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from(thumbnailBucket).getPublicUrl(fileName);
            thumbnail_url = publicUrl;
          }
        }
        const { error } = await supabase.from('cake_templates').insert({
          name: name.trim(), shape: 'round', tier_count: tierCount,
          offering: 'standard', design: designJson, thumbnail_url, is_active: true, sort_order: 0,
        });
        if (error) throw new Error(error.message);
      }

      setSaveMsg({ ok: true, text: 'Template saved!' });
      onSaved?.();
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      <div style={s.page}>

        {/* ── Sidebar ── */}
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={s.sidebarTitle}>Create Template</div>
          </div>

          <div style={s.sidebarBody}>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Template Name</label>
              <input
                style={s.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Classic Pink 2-Tier"
              />
            </div>

            {/* Tier count */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Tiers</label>
              <div style={s.tierCountRow}>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} style={s.tierCountBtn(tierCount === n)} onClick={() => setTierCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-tier settings */}
            <div style={{ marginBottom: 16 }}>
              <div style={s.sectionTitle}>Tiers</div>
              {tiers.map((tier, i) => (
                <div key={i} style={s.tierCard}>
                  <div style={s.tierHeader}>
                    <span style={s.tierLabel}>{TIER_LABELS[i]} Tier</span>
                  </div>

                  {/* Color */}
                  <div style={s.row}>
                    <span style={s.rowLabel}>Color</span>
                    <input
                      type="color"
                      value={tier.color}
                      onChange={e => updateTier(i, { color: e.target.value })}
                      style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                    />
                    <span style={{ fontSize: 11, color: '#b07a8a' }}>{tier.color}</span>
                  </div>

                  {/* Frosting type */}
                  <div style={s.row}>
                    <span style={s.rowLabel}>Frosting</span>
                    <select
                      style={{ ...s.select, flex: 1 }}
                      value={tier.frostingType}
                      onChange={e => updateTier(i, { frostingType: e.target.value })}
                    >
                      {FROSTING_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Piping */}
                  {pipingStyles.length > 0 && (
                    <>
                      <PipingSelect
                        label="Top"
                        value={tier.topPiping}
                        options={pipingStyles}
                        onSelect={el => updateTier(i, { topPiping: el })}
                        onColorChange={c => updateTier(i, { topPiping: { ...tier.topPiping, color: c } })}
                      />
                      <PipingSelect
                        label="Base"
                        value={tier.bottomPiping}
                        options={pipingStyles}
                        onSelect={el => updateTier(i, { bottomPiping: el })}
                        onColorChange={c => updateTier(i, { bottomPiping: { ...tier.bottomPiping, color: c } })}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Topper */}
            {topperOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={s.sectionTitle}>Topper</div>
                <select
                  style={s.select}
                  value={topper?.id ?? ''}
                  onChange={e => {
                    const el = topperOptions.find(o => o.id === e.target.value);
                    setTopper(el ? { id: el.id, image_url: el.image_url, name: el.name } : null);
                  }}
                >
                  <option value="">None</option>
                  {topperOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ── Footer: thumbnail + save ── */}
          <div style={s.sidebarFooter}>
            <div style={s.thumbnailBox}>
              {thumbnail
                ? <img src={thumbnail} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="thumbnail" />
                : <span style={{ fontSize: 11, color: '#c9a0b0' }}>No thumbnail yet</span>
              }
            </div>
            <button style={s.btn('secondary')} onClick={captureThumbnail}>
              📷 Capture Thumbnail
            </button>
            {saveMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, color: saveMsg.ok ? '#3a7d44' : '#c00', textAlign: 'center' }}>
                {saveMsg.text}
              </div>
            )}
            <button
              style={{ ...s.btn('primary'), opacity: saving || !name.trim() ? 0.6 : 1 }}
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* ── 3D Canvas ── */}
        <div style={s.canvasWrap} ref={canvasContainerRef}>
          <Suspense fallback={
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b07a8a', fontSize: 13 }}>
              Loading 3D…
            </div>
          }>
            <CakeCanvas
              config={canvasConfig}
              selectedTier={null}
              onTierClick={() => {}}
              onDeselect={() => {}}
              selectedPiping={null}
              onTopPipingSelect={() => {}}
              onBottomPipingSelect={() => {}}
              pipingTarget={null}
              onPipingStyleSelect={() => {}}
              onPipingCancel={() => {}}
              pipingStyles={[]}
              selectedTextId={null}
              onTextSelect={() => {}}
              onTextMove={() => {}}
              onTextContentChange={() => {}}
              autoRotate={true}
            />
          </Suspense>
        </div>

      </div>
    </>
  );
}
