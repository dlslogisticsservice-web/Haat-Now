// ─────────────────────────────────────────────────────────────────────────────
// Runtime Node Inspector (Phase 8A · Runtime Selection Layer).
//
// READ-ONLY. Displays the currently-selected RuntimeNode — no property editing, no
// bindings, no metadata mutation (those belong to later Phase 8 sprints). Its job is to
// prove the selection flow: click a runtime component → the inspector opens with the
// node's identity. It renders in the App Studio right rail when the Live App is in
// select mode and a node is selected.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MousePointerClick, Info } from 'lucide-react';
import type { RuntimeNode } from '../../runtime/selection/RuntimeNode';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const val: React.CSSProperties = { fontSize: 12, color: 'var(--color-on-surface)', fontWeight: 600, wordBreak: 'break-all' };

export const RuntimeNodeInspector: React.FC<{ node: RuntimeNode | null; lang: 'ar' | 'en' }> = ({ node, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  if (!node) {
    return (
      <div id="runtime_node_inspector" data-empty="1" dir={dir} style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...card, padding: 14, display: 'grid', gap: 8, placeItems: 'center', textAlign: 'center' }}>
          <MousePointerClick size={22} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{L('اختر مكوّناً', 'Select a component')}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('مرّر فوق التطبيق الحيّ ثم انقر أي مكوّن لتحديده.', 'Hover the live app and click any component to select it.')}</p>
        </div>
      </div>
    );
  }

  const rows: { k: string; v: string }[] = [
    { k: L('المكوّن', 'Component'), v: node.component },
    { k: L('القناة', 'Channel'), v: node.channel },
    { k: L('الشاشة', 'Screen'), v: node.screen },
    { k: L('المعرّف', 'Node id'), v: node.id },
    { k: L('العمق', 'Depth'), v: String(node.path.length) },
    { k: L('الأبعاد', 'Bounds'), v: `${Math.round(node.bounds.width)}×${Math.round(node.bounds.height)}` },
    { k: L('مرجع البيانات الوصفية', 'Metadata ref'), v: node.metadataRef ?? L('غير معرّف بعد', 'not declared yet') },
  ];

  return (
    <div id="runtime_node_inspector" data-node-id={node.id} dir={dir} style={{ display: 'grid', gap: 10 }}>
      <div>
        <span style={lbl}>{L('عنصر وقت التشغيل المحدّد', 'Selected runtime node')}</span>
        <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)' }}>{node.component}</h3>
      </div>
      <div style={{ ...card, padding: 12, display: 'grid', gap: 9 }}>
        {rows.map(r => (
          <div key={r.k} style={{ display: 'grid', gap: 2 }}>
            <span style={lbl}>{r.k}</span>
            <span style={val}>{r.v}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: 'var(--color-on-surface-variant)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        {L('طبقة التحديد فقط — لا يوجد تحرير بعد. تحرير الخصائص والربط يأتي في المرحلة 8B.', 'Selection layer only — no editing yet. Property editing & bindings arrive in Phase 8B.')}
      </p>
    </div>
  );
};

export default RuntimeNodeInspector;
