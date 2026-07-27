// ─────────────────────────────────────────────────────────────────────────────
// AI Assistant (Phase G2.1) — the intelligent layer's UI.
//
// Prompt builder + generators (layout / theme / logic / data / full app) + suggestion assistants
// (refactor / accessibility / performance) + code explanation + AI history. Every action calls the
// AI engine, which generates through the EXISTING BuilderStore — so all output is undoable /
// draftable / publishable. No external AI dependency.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Sparkles, Wand2, Palette, Braces, Database, AppWindow, Layers, Accessibility, Gauge, MessageSquareText, History, Check, Undo2 } from 'lucide-react';
import type { BuilderStore } from '../../../component-platform/BuilderStore';
import * as AI from '../../../component-platform/ai/aiEngine';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 10 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const es: React.CSSProperties = { padding: '7px 9px', borderRadius: 8, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 12 };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' };
const ghost: React.CSSProperties = { ...btn, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)' };

export const AIAssistant: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [prompt, setPrompt] = useState('Create a restaurant home page');
  const [result, setResult] = useState('');
  const [tab, setTab] = useState<'generate' | 'assist' | 'explain' | 'history'>('generate');
  const [appKind, setAppKind] = useState('restaurant');
  const [suggestions, setSuggestions] = useState<AI.Suggestion[]>([]);
  const [explain, setExplain] = useState('');

  const say = (s: string) => setResult(s);

  return (
    <div id="ai_assistant" style={{ ...card, padding: 10, display: 'grid', gap: 8, gridTemplateRows: 'auto auto 1fr', minHeight: 190 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Sparkles size={14} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{L('مساعد الذكاء الاصطناعي', 'AI Builder')}</span>
        {(['generate', 'assist', 'explain', 'history'] as const).map(t => <button key={t} id={`ai_tab_${t}`} onClick={() => setTab(t)} style={{ ...ghost, padding: '4px 9px', fontSize: 10.5, background: tab === t ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: tab === t ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t}</button>)}
        <button id="ai_undo" onClick={() => store.undo()} title={L('تراجع عن التوليد', 'Undo generation')} style={{ ...ghost, marginInlineStart: 'auto', padding: '4px 8px' }}><Undo2 size={12} />{L('تراجع', 'Undo')}</button>
      </div>

      {tab === 'generate' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="ai_prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={L('صف الشاشة… مثال: صفحة مطعم', 'Describe a screen… e.g. restaurant home page')} style={{ ...es, flex: 1 }} />
          </div>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button id="ai_gen_layout" onClick={() => { const r = AI.generateLayout(store, prompt); say(`✓ ${L('تمّ توليد تخطيط', 'Generated layout')}: ${r.page} (${r.nodes} ${L('عنصر', 'nodes')})`); }} style={btn}><Wand2 size={12} />{L('توليد تخطيط', 'Generate layout')}</button>
              <button id="ai_gen_theme" onClick={() => { const r = AI.generateTheme(store, prompt); say(`✓ ${L('سمة', 'Theme')}: ${r.name}`); }} style={ghost}><Palette size={12} />{L('سمة', 'Theme')}</button>
              <button id="ai_gen_logic" onClick={() => { const r = AI.generateLogic(store, prompt); say(`✓ ${L('منطق', 'Logic')}: ${r.summary}`); }} style={ghost}><Braces size={12} />{L('منطق', 'Logic')}</button>
              <button id="ai_gen_data" onClick={() => { const r = AI.generateData(store, prompt); say(`✓ ${L('بيانات', 'Data')}: ${r.entities} ${L('كيان', 'entities')}`); }} style={ghost}><Database size={12} />{L('بيانات', 'Data')}</button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={lbl}>{L('تطبيق كامل', 'Full app')}:</span>
              <select id="ai_app_kind" value={appKind} onChange={e => setAppKind(e.target.value)} style={es}>{AI.APP_KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
              <button id="ai_gen_app" onClick={() => { const r = AI.generateApp(store, appKind); say(`✓ ${r.summary}`); }} style={btn}><AppWindow size={12} />{L('توليد تطبيق', 'Generate app')}</button>
            </div>
            {result && <div id="ai_result" style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', fontSize: 11, fontWeight: 600, color: 'var(--color-primary-fixed,#a3f95b)' }}>{result}</div>}
          </div>
        </>
      )}

      {tab === 'assist' && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button id="ai_refactor" onClick={() => setSuggestions(AI.analyzeRefactor(store))} style={ghost}><Layers size={12} />{L('إعادة هيكلة', 'Refactor')}</button>
            <button id="ai_a11y" onClick={() => setSuggestions(AI.analyzeAccessibility(store))} style={ghost}><Accessibility size={12} />{L('الوصول', 'Accessibility')}</button>
            <button id="ai_a11y_fix" onClick={() => { const n = AI.applyAccessibilityFixes(store); say(`✓ ${n} ${L('تسمية أُضيفت', 'labels added')}`); setSuggestions(AI.analyzeAccessibility(store)); }} style={btn}><Check size={12} />{L('إصلاح الوصول', 'Fix a11y')}</button>
            <button id="ai_perf" onClick={() => setSuggestions(AI.analyzePerformance(store))} style={ghost}><Gauge size={12} />{L('الأداء', 'Performance')}</button>
          </div>
          <div style={{ display: 'grid', gap: 4, overflow: 'auto', maxHeight: 150 }} id="ai_suggestions">
            {suggestions.map((s, i) => <div key={i} className="ai-suggestion" data-kind={s.kind} data-severity={s.severity} style={{ ...card, padding: '5px 8px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 10.5 }}><span style={{ width: 7, height: 7, borderRadius: 999, marginTop: 3, background: s.severity === 'warn' ? '#ffb454' : 'var(--color-primary-fixed,#a3f95b)' }} /><span style={{ flex: 1 }}>{s.message}</span></div>)}
            {suggestions.length === 0 && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('اضغط زراً للتحليل', 'Run an analysis above')}</span>}
            {result && <div id="ai_result" style={{ fontSize: 10.5, color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }}>{result}</div>}
          </div>
        </>
      )}

      {tab === 'explain' && (
        <>
          <button id="ai_explain" onClick={() => { const sel = store.getSelectedId(); setExplain(sel ? AI.explainNode(store, sel) : L('اختر عنصراً أولاً', 'Select a component first.')); }} style={btn}><MessageSquareText size={12} />{L('اشرح المكوّن المحدّد', 'Explain selected component')}</button>
          <pre id="ai_explain_out" style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--color-on-surface)', margin: 0, lineHeight: 1.5 }}>{explain || L('سيظهر الشرح هنا', 'Explanation will appear here.')}</pre>
        </>
      )}

      {tab === 'history' && (
        <div style={{ display: 'grid', gap: 3, overflow: 'auto' }} id="ai_history">
          <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><History size={11} />{L('سجلّ التوليد (قابل للتراجع)', 'AI history (reversible via undo)')}</span>
          {store.aiHistory().map((h, i) => <div key={i} className="ai-log-row" data-action={h.action} style={{ ...card, padding: '4px 8px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 10.5 }}><span style={{ color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700, minWidth: 60 }}>{h.action}</span><span style={{ flex: 1, color: 'var(--color-on-surface-variant)' }}>{h.detail}</span></div>)}
          {store.aiHistory().length === 0 && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا توليدات بعد', 'No generations yet')}</span>}
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
