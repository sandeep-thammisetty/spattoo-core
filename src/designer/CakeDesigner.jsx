import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import CakeCanvas from './canvas/CakeCanvas';
import { useCakeDesign } from './hooks/useCakeDesign';

// Tier caps are hardcoded — tiers are not element_types rows, they're the cake structure itself
const TIER_CAPS = { color: true, resize: false, style: false, fontSize: false, duplicate: false, delete: false };

const TIER_LABELS = ['Bottom Tier', '2nd Tier', '3rd Tier', 'Top Tier'];

// ── Color picker (react-colorful) ─────────────────────────────────────────────
function ColorWheel({ color, onChange }) {
  // Common cake piping colour presets
  const PRESETS = [
    '#ffffff','#f5e6c8','#f5b8c8','#e8a0b0','#c8b5e8',
    '#b5c8e8','#b5e8d5','#f0c040','#e87040','#5c3d2e',
    '#3e2010','#1a1a1a','#d4af37','#8b1a1a','#2e5c3e',
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HexColorPicker color={color} onChange={onChange} style={{ width: 216, height: 180 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: 216 }}>
        {PRESETS.map(c => (
          <div key={c} onClick={() => onChange(c)} style={{
            width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
            border: color === c ? '2.5px solid #9b5f72' : '1.5px solid #e0d0d5',
            boxSizing: 'border-box', flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Zone label map ────────────────────────────────────────────────────────────
const ZONE_LABELS = {
  top_edge:     'Top',
  bottom_board: 'Base',
  top_surface:  'Top surface',
  side:         'Side',
  side_edge:    'Side edge',
};

const TYPE_ICONS = {
  cream_piping: '🍦',
  topper:       '🎂',
  text:         'T',
  drip:         '💧',
  sprinkle:     '✨',
  flower:       '🌸',
};

// TOPPERS + PIPING STYLES are loaded from Supabase cake_elements table

// ── Per-element-type card in the elements panel ───────────────────────────────
function ElementTypeCard({
  elementType, design, toppersDb = [], selectedPiping,
  onTopPipingSelect, onBottomPipingSelect,
  onAddTopPiping, onAddBottomPiping,
  onRemoveTopPiping, onRemoveBottomPiping,
  onSetTopper,
}) {
  const { slug, name, placement_rules: pr } = elementType;
  const zones     = pr?.zones ?? [];
  const perTier   = pr?.per_tier ?? false;
  const icon      = TYPE_ICONS[slug] ?? '✦';

  // ── cream_piping — zone selector per tier ──────────────────────────────────
  if (slug === 'cream_piping') {
    return (
      <div style={{ ...s.elementCard, cursor: 'default' }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={s.elementCardLabel}>{name}</div>

        {design.tiers.map((tier, i) => (
          <div key={i} style={{ width: '100%', borderTop: '1px solid #f0dce3', paddingTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a0b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              {TIER_LABELS[i]}
            </div>

            {/* top_edge zone */}
            {zones.includes('top_edge') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={s.tierCheckLabel}>{ZONE_LABELS.top_edge}</span>
                <div style={{ flex: 1 }} />
                {tier.topPiping ? (
                  <>
                    <div onClick={() => onTopPipingSelect(i)}
                      style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', padding: 2.5, boxSizing: 'border-box' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: tier.topPiping.color }} />
                    </div>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: '#e53935' }}
                      onClick={() => onRemoveTopPiping(i)}>🗑</button>
                  </>
                ) : (
                  <button onClick={() => onAddTopPiping(i)}
                    style={{ fontSize: 10, fontWeight: 700, color: '#9b5f72', background: '#fdf0f5', border: '1.5px solid #f0dce3', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                    + Add
                  </button>
                )}
              </div>
            )}

            {/* bottom_board zone */}
            {zones.includes('bottom_board') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={s.tierCheckLabel}>{ZONE_LABELS.bottom_board}</span>
                <div style={{ flex: 1 }} />
                {tier.bottomPiping ? (
                  <>
                    <div onClick={() => onBottomPipingSelect(i)}
                      style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', padding: 2.5, boxSizing: 'border-box' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: tier.bottomPiping.color }} />
                    </div>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: '#e53935' }}
                      onClick={() => onRemoveBottomPiping(i)}>🗑</button>
                  </>
                ) : (
                  <button onClick={() => onAddBottomPiping(i)}
                    style={{ fontSize: 10, fontWeight: 700, color: '#9b5f72', background: '#fdf0f5', border: '1.5px solid #f0dce3', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                    + Add
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── topper — pick from DB-driven GLB toppers ──────────────────────────────
  if (slug === 'topper') {
    return (
      <div style={{ ...s.elementCard, cursor: 'default' }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={s.elementCardLabel}>{name}</div>
        {toppersDb.length === 0 && (
          <div style={{ fontSize: 9, color: '#c9a0b0', fontStyle: 'italic' }}>No toppers yet</div>
        )}
        {toppersDb.map(t => {
          const isActive = design.topper?.id === t.id;
          return (
            <div key={t.id} style={{ width: '100%', borderTop: '1px solid #f0dce3', paddingTop: 8, paddingBottom: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                {/* Thumbnail */}
                <div style={{
                  width: 80, height: 80, borderRadius: 10,
                  background: 'linear-gradient(135deg,#fdf0f5,#fce4ec)',
                  border: `2px solid ${isActive ? '#9b5f72' : '#f0dce3'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isActive ? '0 0 0 2px rgba(155,95,114,0.2)' : 'none',
                }} onClick={() => onSetTopper(isActive ? null : t)}>
                  {t.thumbnail_url
                    ? <img src={t.thumbnail_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 32 }}>🎂</span>
                  }
                </div>
                {/* Label + action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ ...s.tierCheckLabel, flex: 1, textAlign: 'center' }}>{t.name}</span>
                  {isActive && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: '#e53935' }}
                      onClick={() => onSetTopper(null)}>🗑</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── All other types — coming soon placeholder ──────────────────────────────
  return (
    <div style={{ ...s.elementCard, cursor: 'default', opacity: 0.55 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={s.elementCardLabel}>{name}</div>
      <div style={{ fontSize: 9, color: '#c9a0b0', letterSpacing: 0.5, textAlign: 'center' }}>
        {zones.map(z => ZONE_LABELS[z] ?? z).join(' · ')}
      </div>
      <div style={{ fontSize: 9, color: '#c9a0b0', fontStyle: 'italic' }}>Coming soon</div>
    </div>
  );
}

// ── Main designer ─────────────────────────────────────────────────────────────
export default function CakeDesigner({ supabase, thumbnailBucket = 'cake-thumbnails', onOrder }) {
  const { design, setTierColor, setTopPiping, setBottomPiping, addText, updateText, duplicateText, removeText, setTopper, setTopperScale, loadDesign, canvasConfig } = useCakeDesign();
  const [elementsOpen, setElementsOpen] = useState(false);
  const [elementTypes, setElementTypes] = useState([]);
  const [elementTypesLoading, setElementTypesLoading] = useState(false);
  const [toppersDb, setToppersDb] = useState([]);
  const [pipingStylesDb, setPipingStylesDb] = useState([]);
  const [activeElementTypeIds, setActiveElementTypeIds] = useState(new Set());

  // Capabilities fetched eagerly on mount so edit controls work
  // even before the elements panel is opened (e.g. text, piping selected directly)
  const allowedActionsBySlug = useMemo(() => {
    const m = {};
    elementTypes.forEach(et => { m[et.slug] = et.default_allowed_actions ?? {}; });
    return m;
  }, [elementTypes]);

  // ── Unified selection: null | { type, ...props } ──────────────────────────
  // type 'tier':   { index }
  // type 'piping': { tierIndex, zone: 'top'|'bottom' }
  // type 'text':   { id }
  // type 'topper': {}
  const [selectedEl, setSelectedEl] = useState(null);
  const [colorOpen, setColorOpen] = useState(false);

  // Derived for backward-compat with canvas props
  const selectedTier   = selectedEl?.type === 'tier'   ? selectedEl.index    : null;
  const selectedPiping = selectedEl?.type === 'piping'  ? selectedEl          : null;
  const selectedTextId = selectedEl?.type === 'text'    ? selectedEl.id       : null;
  const caps = selectedEl
    ? (selectedEl.type === 'tier' ? TIER_CAPS : (allowedActionsBySlug[selectedEl.type] ?? null))
    : null;

  // pipingTarget: { tierIndex, zone } — triggers in-canvas style picker
  const [pipingTarget, setPipingTarget] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [saveModal, setSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateOffering, setTemplateOffering] = useState('standard');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const hasEdited = useRef(false);
  const textInputRef = useRef();

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSaving(true);
    setSaveMsg(null);

    // Capture screenshot
    const canvas = document.querySelector('canvas');
    const thumbnailDataUrl = canvas?.toDataURL('image/png') ?? null;

    // Upload thumbnail to Supabase Storage
    let thumbnail_url = null;
    if (thumbnailDataUrl) {
      const blob = await (await fetch(thumbnailDataUrl)).blob();
      const fileName = `template-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(thumbnailBucket)
        .upload(fileName, blob, { contentType: 'image/png', upsert: false });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from(thumbnailBucket)
          .getPublicUrl(fileName);
        thumbnail_url = publicUrl;
      }
    }

    // Build design JSON
    const designJson = {
      shape: 'round',
      tiers: design.tiers.map(t => ({
        color: t.color,
        topPiping:    t.topPiping ?? null,
        bottomPiping: t.bottomPiping ?? null,
        decorations: [], // kept for backward compat
        texts: [],
      })),
      texts: design.texts,
      topper: null,
    };

    const { error } = await supabase.from('cake_templates').insert({
      name: templateName.trim(),
      shape: 'round',
      tier_count: design.tiers.length,
      offering: templateOffering,
      design: designJson,
      thumbnail_url,
      is_active: true,
      sort_order: 0,
    });

    setSaving(false);
    if (error) {
      setSaveMsg({ ok: false, text: error.message });
    } else {
      setSaveMsg({ ok: true, text: 'Template saved!' });
      setTimeout(() => { setSaveModal(false); setSaveMsg(null); setTemplateName(''); }, 1200);
    }
  }

  // Eager load element_types (with allowed_actions) on mount so edit controls
  // are available immediately — before the elements panel is ever opened.
  useEffect(() => {
    supabase
      .from('element_types')
      .select('id, slug, name, placement_rules, sort_order, default_allowed_actions')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setElementTypes(data); });
  }, []);

  async function openElements() {
    const opening = !elementsOpen;
    setElementsOpen(opening);
    setTemplatesOpen(false);
    // Lazy-load top-level cake_elements when panel first opens
    if (opening && toppersDb.length === 0) {
      setElementTypesLoading(true);
      const { data: topLevelData } = await supabase
        .from('cake_elements')
        .select('id, name, image_url, thumbnail_url, sort_order, element_type_id')
        .is('parent_id', null)
        .eq('is_active', true)
        .order('sort_order');
      const rows = topLevelData ?? [];
      // Derive which element_types have active records
      setActiveElementTypeIds(new Set(rows.map(r => r.element_type_id)));
      // Separate toppers for the topper card UI
      setToppersDb(rows.filter(r => r.element_type_id === 'dd587f6c-44af-432d-a6f7-cf3a185c7951'));
      setElementTypesLoading(false);
    }
  }

  async function openTemplates() {
    setTemplatesOpen(o => {
      if (o) return false;
      return true;
    });
    setTemplatesLoading(true);
    const { data, error } = await supabase
      .from('cake_templates')
      .select('id, name, offering, tier_count, thumbnail_url, created_at')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at', { ascending: false });
    setTemplates(error ? [] : data);
    setTemplatesLoading(false);
  }

  function stopRotatingOnFirstEdit() {
    if (!hasEdited.current) {
      hasEdited.current = true;
      setAutoRotate(false);
    }
  }

  const selectedText = design.texts.find(t => t.id === selectedTextId) ?? null;

  // ── Color helpers ─────────────────────────────────────────────────────────
  function getCurrentColor() {
    if (!selectedEl) return '#f5b8c8';
    if (selectedEl.type === 'tier') return design.tiers[selectedEl.index]?.color ?? '#f5b8c8';
    if (selectedEl.type === 'piping') {
      const t = design.tiers[selectedEl.tierIndex];
      return (selectedEl.zone === 'top' ? t?.topPiping?.color : t?.bottomPiping?.color) ?? '#f5e6c8';
    }
    if (selectedEl.type === 'text') return selectedText?.color ?? '#ffffff';
    return '#f5b8c8';
  }

  function handleColorChange(c) {
    if (!selectedEl) return;
    if (selectedEl.type === 'tier') { setTierColor(selectedEl.index, c); return; }
    if (selectedEl.type === 'piping') {
      const { tierIndex, zone } = selectedEl;
      if (zone === 'top') { const p = design.tiers[tierIndex]?.topPiping; if (p) setTopPiping(tierIndex, { ...p, color: c }); }
      else { const p = design.tiers[tierIndex]?.bottomPiping; if (p) setBottomPiping(tierIndex, { ...p, color: c }); }
      return;
    }
    if (selectedEl.type === 'text') updateText(selectedEl.id, { color: c });
  }

  function handleDelete() {
    if (!selectedEl) return;
    if (selectedEl.type === 'piping') {
      if (selectedEl.zone === 'top') setTopPiping(selectedEl.tierIndex, null);
      else setBottomPiping(selectedEl.tierIndex, null);
    } else if (selectedEl.type === 'text') {
      removeText(selectedEl.id);
    } else if (selectedEl.type === 'topper') {
      setTopper(null);
    }
    setSelectedEl(null);
    setColorOpen(false);
  }

  // ── Selection handlers ────────────────────────────────────────────────────
  function clearAllSelections() {
    setSelectedEl(null);
    setColorOpen(false);
  }

  function handleDeselect() { clearAllSelections(); }

  function handleTierClick(i) {
    stopRotatingOnFirstEdit();
    setSelectedEl(prev => (prev?.type === 'tier' && prev.index === i) ? null : { type: 'tier', index: i });
    setColorOpen(false);
  }

  function handleTextSelect(id) {
    stopRotatingOnFirstEdit();
    setSelectedEl({ type: 'text', id });
    setColorOpen(false);
  }

  function handleTopPipingSelect(tierIndex) {
    stopRotatingOnFirstEdit();
    setSelectedEl({ type: 'piping', tierIndex, zone: 'top' });
    setColorOpen(false);
  }

  function handleBottomPipingSelect(tierIndex) {
    stopRotatingOnFirstEdit();
    setSelectedEl({ type: 'piping', tierIndex, zone: 'bottom' });
    setColorOpen(false);
  }

  function handleTopperClick() {
    if (!design.topper) return;
    stopRotatingOnFirstEdit();
    setSelectedEl(prev => prev?.type === 'topper' ? null : { type: 'topper' });
    setColorOpen(false);
  }

  function handlePipingStyleSelect(element) {
    if (!pipingTarget) return;
    const { tierIndex, zone } = pipingTarget;
    const piping = { id: element.id, glbUrl: element.glbUrl, name: element.name, color: '#f5e6c8' };
    if (zone === 'top') setTopPiping(tierIndex, piping);
    else setBottomPiping(tierIndex, piping);
    setPipingTarget(null);
  }

  useEffect(() => {
    if (selectedEl?.type === 'text' && textInputRef.current) {
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  }, [selectedEl?.type === 'text' ? selectedEl.id : null]);

  // Lazy-load piping styles from DB the first time the picker is triggered
  useEffect(() => {
    if (pipingTarget && pipingStylesDb.length === 0) {
      supabase
        .from('cake_elements')
        .select('id, name, image_url, sort_order')
        .eq('element_type_id', '2f718ccd-64e1-4941-b5f9-72133f77c04c')
        .eq('is_active', true)
        .order('sort_order')
        .then(({ data }) => setPipingStylesDb(data ?? []));
    }
  }, [pipingTarget]);

  function handleOrder() {
    const canvas = document.querySelector('canvas');
    onOrder({ design, imageData: canvas?.toDataURL('image/png') ?? null });
  }

  const tierPanelVisible = selectedEl?.type === 'tier';
  const currentColor = getCurrentColor();
  // Right panel shows when: tier selected (always), or color picker opened, or topper selected (resize)
  const showRightPanel = tierPanelVisible
    || (caps?.color && colorOpen)
    || (selectedEl?.type === 'topper');

  // ── Caps-driven floating toolbar (text + piping) ──────────────────────────
  function buildToolbar(el) {
    if (!el) return null;
    const c = el.type === 'tier' ? TIER_CAPS : (allowedActionsBySlug[el.type] ?? null);
    if (!c) return null;
    const items = [];

    if (c.color) {
      items.push(
        <button key="color"
          style={{ ...s.swatchBtn, background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', padding: 3, border: colorOpen ? '2.5px solid #6c47ff' : 'none' }}
          onClick={() => setColorOpen(o => !o)}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: getCurrentColor() }} />
        </button>,
        <div key="d1" style={s.tbDivider} />
      );
    }

    if (c.style && el.type === 'piping') {
      items.push(
        <button key="style" style={{ ...s.tbIconBtn, fontSize: 10, letterSpacing: 0.3 }}
          onClick={() => { setPipingTarget({ tierIndex: el.tierIndex, zone: el.zone }); clearAllSelections(); }}>
          ✦ Style
        </button>,
        <div key="d2" style={s.tbDivider} />
      );
    }

    if (c.fontSize && el.type === 'text') {
      const fs = selectedText?.fontSize ?? 0.2;
      items.push(
        <button key="fs-" style={s.tbIconBtn} onClick={() => updateText(el.id, { fontSize: Math.max(0.10, +((fs) - 0.03).toFixed(2)) })}>−</button>,
        <span key="fs-val" style={s.tbSizeLabel}>{Math.round(fs * 100)}</span>,
        <button key="fs+" style={s.tbIconBtn} onClick={() => updateText(el.id, { fontSize: Math.min(0.45, +((fs) + 0.03).toFixed(2)) })}>+</button>,
        <div key="d3" style={s.tbDivider} />
      );
    }

    if (c.duplicate && el.type === 'text') {
      items.push(
        <button key="dup" style={s.tbIconBtn} onClick={() => { duplicateText(el.id); setSelectedEl(null); }}>⧉</button>
      );
    }

    if (c.delete) {
      items.push(
        <button key="del" style={{ ...s.tbIconBtn, color: '#e53935' }} onClick={handleDelete}>🗑</button>
      );
    }

    items.push(
      <button key="ok" style={{ ...s.tbIconBtn, color: '#6c47ff', fontWeight: 700 }}
        onClick={() => { setSelectedEl(null); setColorOpen(false); }}>✓</button>
    );

    return <div style={s.textToolbar}>{items}</div>;
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={s.main}>

        {/* ── Left panel ── */}
        <div style={s.leftPanel}>
          {/* Text button */}
          <button style={s.elementBtn} onClick={() => { stopRotatingOnFirstEdit(); addText(); }}>
            <span style={s.elementIcon}>T</span>
            <span style={s.elementLabel}>Text</span>
          </button>

          {/* Elements button */}
          <button
            style={{ ...s.elementBtn, borderColor: elementsOpen ? '#9b5f72' : '#f0dce3', background: elementsOpen ? '#fdf0f5' : 'none' }}
            onClick={openElements}
          >
            <span style={{ fontSize: 22 }}>✦</span>
            <span style={s.elementLabel}>Elements</span>
          </button>

          {/* Templates button */}
          <button
            style={{ ...s.elementBtn, borderColor: templatesOpen ? '#9b5f72' : '#f0dce3', background: templatesOpen ? '#fdf0f5' : 'none' }}
            onClick={() => { openTemplates(); setElementsOpen(false); }}
          >
            <span style={{ fontSize: 20 }}>⊞</span>
            <span style={s.elementLabel}>Templates</span>
          </button>
        </div>

        {/* ── Elements flyout panel ── */}
        {elementsOpen && (
          <div style={s.elementsPanel}>
            <div style={s.elementsPanelHeader}>
              <span style={s.elementsPanelTitle}>Elements</span>
              <button style={s.iconBtn} onClick={() => setElementsOpen(false)}>✕</button>
            </div>

            {elementTypesLoading && (
              <div style={{ fontSize: 11, color: '#b07a8a', textAlign: 'center', padding: '16px 0' }}>Loading...</div>
            )}

            {elementTypes.filter(et => activeElementTypeIds.has(et.id)).map(et => (
              <ElementTypeCard
                key={et.id}
                elementType={et}
                design={design}
                toppersDb={toppersDb}
                selectedPiping={selectedPiping}
                onTopPipingSelect={i => { stopRotatingOnFirstEdit(); handleTopPipingSelect(i); setColorOpen(true); }}
                onBottomPipingSelect={i => { stopRotatingOnFirstEdit(); handleBottomPipingSelect(i); setColorOpen(true); }}
                onAddTopPiping={i => { stopRotatingOnFirstEdit(); setPipingTarget({ tierIndex: i, zone: 'top' }); clearAllSelections(); setElementsOpen(false); }}
                onAddBottomPiping={i => { stopRotatingOnFirstEdit(); setPipingTarget({ tierIndex: i, zone: 'bottom' }); clearAllSelections(); setElementsOpen(false); }}
                onRemoveTopPiping={i => { setTopPiping(i, null); if (selectedPiping?.tierIndex === i && selectedPiping?.zone === 'top') clearAllSelections(); }}
                onRemoveBottomPiping={i => { setBottomPiping(i, null); if (selectedPiping?.tierIndex === i && selectedPiping?.zone === 'bottom') clearAllSelections(); }}
                onSetTopper={t => { setTopper(t); setElementsOpen(false); stopRotatingOnFirstEdit(); }}
              />
            ))}

          </div>
        )}

        {/* ── Templates flyout panel ── */}
        {templatesOpen && (
          <div style={s.elementsPanel}>
            <div style={s.elementsPanelHeader}>
              <span style={s.elementsPanelTitle}>Templates</span>
              <button style={s.iconBtn} onClick={() => setTemplatesOpen(false)}>✕</button>
            </div>
            {templatesLoading && (
              <div style={{ fontSize: 11, color: '#b07a8a', textAlign: 'center', padding: '16px 0' }}>Loading...</div>
            )}
            {!templatesLoading && templates.length === 0 && (
              <div style={{ fontSize: 11, color: '#c9a0b0', textAlign: 'center', padding: '16px 0' }}>No templates yet</div>
            )}
            {templates.map(t => (
              <div key={t.id} style={s.templateCard}
                onClick={async () => {
                  const { data } = await supabase
                    .from('cake_templates')
                    .select('design')
                    .eq('id', t.id)
                    .single();
                  if (data?.design) {
                    loadDesign(data.design);
                    setTemplatesOpen(false);
                    clearAllSelections();
                  }
                }}
              >
                {t.thumbnail_url
                  ? <img src={t.thumbnail_url} alt={t.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
                  : <div style={s.templateThumbPlaceholder}>🎂</div>
                }
                <div style={s.templateCardFooter}>
                  <span style={s.templateCardName}>{t.name}</span>
                  {t.offering === 'premium' && (
                    <span style={s.templateBadge}>★</span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: '#c9a0b0', textAlign: 'center' }}>
                  {t.tier_count}-tier
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Canvas area ── */}
        <div style={s.canvasArea}>
          <div style={s.topControls}>
            <button style={{ ...s.addTierBtn, color: autoRotate ? '#6b2d42' : '#9b9b9b' }}
              onClick={() => setAutoRotate(r => !r)}>
              {autoRotate ? '⏸ Stop' : '▶ Rotate'}
            </button>
            <button style={{ ...s.addTierBtn, color: '#9b5f72' }}
              onClick={() => {
                loadDesign({ tiers: [{ color: '#f5b8c8', decorations: [], texts: [] }], texts: [], topper: null });
                clearAllSelections();
                hasEdited.current = false;
                setAutoRotate(true);
              }}>
              ✕ New
            </button>
            <button style={{ ...s.addTierBtn, color: '#9b5f72' }}
              onClick={() => setSaveModal(true)}>
              ⬆ Save Template
            </button>
          </div>
          {!selectedEl && (
            <div style={s.hint}>Tap a tier or text to edit</div>
          )}

          <Suspense fallback={<div style={s.loading}>Loading 3D cake...</div>}>
            <CakeCanvas
              config={canvasConfig}
              selectedTier={selectedTier}
              onTierClick={handleTierClick}
              onDeselect={handleDeselect}
              selectedPiping={selectedPiping}
              onTopPipingSelect={handleTopPipingSelect}
              onBottomPipingSelect={handleBottomPipingSelect}
              pipingTarget={pipingTarget}
              onPipingStyleSelect={handlePipingStyleSelect}
              onPipingCancel={() => setPipingTarget(null)}
              pipingStyles={pipingStylesDb}
              pipingToolbar={selectedPiping !== null ? buildToolbar(selectedEl) : null}
              selectedTextId={selectedTextId}
              onTextSelect={handleTextSelect}
              onTextMove={(id, pos) => updateText(id, pos)}
              onTextContentChange={(id, content) => updateText(id, { content })}
              autoRotate={autoRotate}
              textToolbar={selectedText ? buildToolbar(selectedEl) : null}
              onTopperClick={handleTopperClick}
              topperSelected={selectedEl?.type === 'topper'}
            />
          </Suspense>

          <div style={s.rotateHint}>Drag to rotate</div>

          {/* ── Right edit panel — driven by element caps ── */}
          {showRightPanel && (
            <div style={s.wheelPanel}>
              <div style={s.wheelHeader}>
                <span style={s.wheelTitle}>
                  {selectedEl?.type === 'tier'   ? TIER_LABELS[selectedEl.index]
                  : selectedEl?.type === 'piping' ? `${TIER_LABELS[selectedEl.tierIndex]} ${selectedEl.zone === 'top' ? 'Top' : 'Base'}`
                  : selectedEl?.type === 'text'   ? 'Text Color'
                  : selectedEl?.type === 'topper' ? (design.topper?.name ?? 'Topper')
                  : ''}
                </span>
                <button style={s.iconBtn} onClick={() => {
                  if (tierPanelVisible) setSelectedEl(null);
                  else { setColorOpen(false); if (selectedEl?.type === 'topper') setSelectedEl(null); }
                }}>✕</button>
              </div>

              {/* Color wheel — tier (always), piping/text (when colorOpen) */}
              {caps?.color && (tierPanelVisible || colorOpen) && (
                <ColorWheel
                  key={`${selectedEl.type}-${selectedEl.index ?? selectedEl.tierIndex ?? selectedEl.id ?? 'x'}-${selectedEl.zone ?? ''}`}
                  color={currentColor}
                  onChange={handleColorChange}
                />
              )}

              {/* Resize slider — topper */}
              {caps?.resize && selectedEl?.type === 'topper' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#b07a8a', letterSpacing: 1, textTransform: 'uppercase' }}>Size</div>
                  <input
                    type="range"
                    min={50} max={200} step={5}
                    value={Math.round((design.topper?.scale ?? 1) * 100)}
                    onChange={e => setTopperScale(Number(e.target.value) / 100)}
                    style={{ width: 200, accentColor: '#9b5f72' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9b5f72' }}>
                    {Math.round((design.topper?.scale ?? 1) * 100)}%
                  </span>
                  {caps?.delete && (
                    <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                      <button style={s.deleteBtn} onClick={handleDelete}>🗑 Remove</button>
                      <button style={s.doneBtn} onClick={() => setSelectedEl(null)}>✓ Done</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Order button ── */}
      {selectedEl?.type !== 'text' && (
        <div style={s.orderBar}>
          <button style={s.orderBtn} onClick={handleOrder}>Order This Cake →</button>
        </div>
      )}

      {/* ── Save as Template modal ── */}
      {saveModal && (
        <div style={s.modalOverlay} onClick={() => setSaveModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Save as Template</span>
              <button style={s.iconBtn} onClick={() => setSaveModal(false)}>✕</button>
            </div>
            <input
              style={s.modalInput}
              placeholder="Template name..."
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['standard', 'premium'].map(o => (
                <button
                  key={o}
                  style={{ ...s.offeringBtn, borderColor: templateOffering === o ? '#9b5f72' : '#f0dce3', background: templateOffering === o ? '#fdf0f5' : '#fff', color: templateOffering === o ? '#9b5f72' : '#b07a8a' }}
                  onClick={() => setTemplateOffering(o)}
                >
                  {o === 'premium' ? '★ ' : ''}{o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
            {saveMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, color: saveMsg.ok ? '#4caf50' : '#e53935', marginTop: 8 }}>
                {saveMsg.text}
              </div>
            )}
            <button
              style={{ ...s.orderBtn, marginTop: 14, opacity: saving || !templateName.trim() ? 0.6 : 1 }}
              onClick={handleSaveTemplate}
              disabled={saving || !templateName.trim()}
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    display:'flex', flexDirection:'column', height:'100vh',
    background:'#fdf0f5', fontFamily:"'Quicksand',sans-serif", overflow:'hidden',
  },
  main: { flex:1, display:'flex', minHeight:0 },

  // Left panel
  leftPanel: {
    width:80, minWidth:80, background:'#fff',
    borderRight:'1px solid #f0dce3',
    display:'flex', flexDirection:'column', alignItems:'center',
    paddingTop:12, gap:4,
  },
  panelHeader: {
    fontSize:9, fontWeight:700, color:'#c9a0b0',
    letterSpacing:1.5, textTransform:'uppercase', marginBottom:8,
  },
  elementBtn: {
    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
    background:'none', border:'1.5px solid #f0dce3', borderRadius:12,
    padding:'10px 8px', cursor:'pointer', width:60,
    transition:'all 0.15s',
  },
  elementIcon: {
    fontSize:22, fontWeight:800, color:'#9b5f72',
    fontFamily:"'Playfair Display',serif",
  },
  elementLabel: {
    fontSize:9, fontWeight:700, color:'#b07a8a',
    letterSpacing:0.5, textTransform:'uppercase',
  },

  // Elements flyout
  elementsPanel: {
    width: 160, background: '#fff',
    borderRight: '1px solid #f0dce3',
    display: 'flex', flexDirection: 'column',
    padding: '12px 10px', gap: 10,
    boxShadow: '2px 0 12px rgba(107,45,66,0.08)',
  },
  elementsPanelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  elementsPanelTitle: {
    fontSize: 10, fontWeight: 700, color: '#c9a0b0',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  elementCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    background: '#fff', border: '1.5px solid #f0dce3', borderRadius: 12,
    padding: '10px 8px', cursor: 'pointer', position: 'relative',
    transition: 'all 0.15s',
  },
  elementCardLabel: {
    fontSize: 10, fontWeight: 700, color: '#b07a8a',
    letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center',
  },
  elementCardCheck: {
    position: 'absolute', top: 6, right: 8,
    fontSize: 11, color: '#9b5f72', fontWeight: 800,
  },
  templateCard: {
    border: '1.5px solid #f0dce3', borderRadius: 12,
    overflow: 'hidden', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '0 0 8px',
    transition: 'all 0.15s',
  },
  templateThumbPlaceholder: {
    width: '100%', height: 100,
    background: '#fdf0f5', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 32,
  },
  templateCardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 8px 0',
  },
  templateCardName: {
    fontSize: 11, fontWeight: 700, color: '#6b2d42',
  },
  templateBadge: {
    fontSize: 10, color: '#e89a00', fontWeight: 800,
  },

  tierCheckRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    cursor: 'pointer', padding: '2px 0',
  },
  tierCheckLabel: {
    fontSize: 10, fontWeight: 600, color: '#9b5f72',
    letterSpacing: 0.3,
  },

  // Canvas
  canvasArea: {
    flex:1, position:'relative', minHeight:0,
    background:'linear-gradient(160deg,#fdf0f5 0%,#fce4ec 100%)',
  },
  loading: {
    position:'absolute', inset:0, display:'flex',
    alignItems:'center', justifyContent:'center', color:'#b07a8a', fontSize:14,
  },
  hint: {
    position:'absolute', top:14, left:'50%', transform:'translateX(-50%)',
    zIndex:10, background:'rgba(107,45,66,0.7)', color:'#fff',
    fontSize:11, fontWeight:600, padding:'5px 14px', borderRadius:20,
    letterSpacing:0.3, pointerEvents:'none', backdropFilter:'blur(6px)',
  },
  topControls: {
    position:'absolute', top:14, right:14, zIndex:10,
    display:'flex', gap:8,
  },
  addTierBtn: {
    zIndex:10,
    background:'#fff', border:'1.5px solid #e0d0d5', borderRadius:20,
    padding:'6px 14px', fontSize:11, fontWeight:700,
    color:'#6b2d42', cursor:'pointer',
    boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
  },
  rotateHint: {
    position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
    fontSize:10, color:'#c49aaa', letterSpacing:1, pointerEvents:'none',
  },

  // Tier colour wheel panel
  wheelPanel: {
    position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
    background:'rgba(255,255,255,0.92)', backdropFilter:'blur(18px)',
    WebkitBackdropFilter:'blur(18px)', borderRadius:20,
    padding:'14px 16px 16px',
    boxShadow:'0 4px 24px rgba(107,45,66,0.14)',
    zIndex:20, width:248,
  },
  wheelHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14,
  },
  wheelTitle: {
    fontSize:11, fontWeight:700, color:'#b07a8a', letterSpacing:1.5, textTransform:'uppercase',
  },
  deleteBtn: {
    flex: 1, padding: '8px 0', borderRadius: 10,
    background: '#fff0f0', border: '1.5px solid #f5c0c0',
    fontSize: 11, fontWeight: 700, color: '#e53935', cursor: 'pointer',
    fontFamily: "'Quicksand',sans-serif",
  },
  doneBtn: {
    flex: 1, padding: '8px 0', borderRadius: 10,
    background: '#f0f0ff', border: '1.5px solid #c0c0f5',
    fontSize: 11, fontWeight: 700, color: '#6c47ff', cursor: 'pointer',
    fontFamily: "'Quicksand',sans-serif",
  },
  iconBtn: {
    background:'#f5eaed', border:'none', width:28, height:28, borderRadius:'50%',
    fontSize:12, color:'#9b5f72', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
  },

  // Text toolbar — floated above element via drei Html, no position needed
  textToolbar: {
    display:'inline-flex', alignItems:'center', gap:4,
    background:'rgba(255,255,255,0.97)', backdropFilter:'blur(16px)',
    WebkitBackdropFilter:'blur(16px)',
    padding:'6px 10px',
    borderRadius:12, whiteSpace:'nowrap',
    boxShadow:'0 4px 20px rgba(107,45,66,0.22), 0 1px 4px rgba(0,0,0,0.1)',
    border:'1px solid rgba(240,220,227,0.9)',
    pointerEvents:'auto',
  },
  swatchBtn: {
    width:26, height:26, borderRadius:'50%', border:'2.5px solid #e0d0d5',
    cursor:'pointer', flexShrink:0, padding:0,
    boxShadow:'0 1px 4px rgba(0,0,0,0.15)',
  },
  tbDivider: {
    width:1, height:20, background:'#e8d8dd', margin:'0 4px', flexShrink:0,
  },
  tbIconBtn: {
    background:'transparent', border:'none', borderRadius:8,
    padding:'4px 8px', fontSize:14, cursor:'pointer',
    color:'#9b5f72', fontWeight:600, fontFamily:"'Quicksand',sans-serif",
    minWidth:28, textAlign:'center',
  },
  tbSizeLabel: {
    fontSize:13, fontWeight:700, color:'#5a3040', minWidth:26, textAlign:'center',
  },
  toolbarBtn: {
    background:'#f5eaed', border:'none', borderRadius:10,
    padding:'5px 10px', fontSize:13, cursor:'pointer', color:'#9b5f72', fontWeight:700,
    flexShrink:0,
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(107,45,66,0.18)',
    backdropFilter: 'blur(4px)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '20px 22px 22px',
    width: 280, boxShadow: '0 8px 40px rgba(107,45,66,0.18)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: {
    fontSize: 13, fontWeight: 700, color: '#6b2d42', letterSpacing: 0.3,
  },
  modalInput: {
    border: '1.5px solid #f0dce3', borderRadius: 10, padding: '9px 12px',
    fontSize: 13, fontFamily: "'Quicksand',sans-serif", color: '#5a3040',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  offeringBtn: {
    flex: 1, padding: '7px 0', borderRadius: 10, border: '1.5px solid #f0dce3',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3,
    fontFamily: "'Quicksand',sans-serif", transition: 'all 0.15s',
  },

  // Order
  orderBar: {
    padding:'10px 20px 16px', background:'#fff',
    borderTop:'1px solid #f0dce3', flexShrink:0,
  },
  orderBtn: {
    width:'100%', padding:'13px',
    background:'linear-gradient(135deg,#e91e8c,#c2185b)',
    color:'#fff', border:'none', borderRadius:12,
    fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:0.5,
    boxShadow:'0 4px 16px rgba(233,30,140,0.3)',
    fontFamily:"'Quicksand',sans-serif",
  },
};
