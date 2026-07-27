// ─────────────────────────────────────────────────────────────────────────────
// AI Assistant (Phase G2.1) — the intelligent layer's UI.
//
// Prompt builder + generators (layout / theme / logic / data / full app) + suggestion assistants
// (refactor / accessibility / performance) + code explanation + AI history. Every action calls the
// AI engine, which generates through the EXISTING BuilderStore — so all output is undoable /
// draftable / publishable. No external AI dependency.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Sparkles, Wand2, Palette, Braces, Database, AppWindow, Layers, Accessibility, Gauge, MessageSquareText, History, Check, Undo2, Brain, ChevronRight } from 'lucide-react';
import type { BuilderStore } from '../../../component-platform/BuilderStore';
import * as AI from '../../../component-platform/ai/aiEngine';
import * as INTEL from '../../../component-platform/ai/intelligence';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 10 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const es: React.CSSProperties = { padding: '7px 9px', borderRadius: 8, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 12 };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' };
const ghost: React.CSSProperties = { ...btn, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)' };

export const AIAssistant: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [prompt, setPrompt] = useState('Create a restaurant home page');
  const [result, setResult] = useState('');
  const [tab, setTab] = useState<'generate' | 'intel' | 'assist' | 'explain' | 'history'>('generate');
  const [appKind, setAppKind] = useState('restaurant');
  const [suggestions, setSuggestions] = useState<AI.Suggestion[]>([]);
  const [explain, setExplain] = useState('');
  const [scores, setScores] = useState<INTEL.Scores | null>(null);
  const [findings, setFindings] = useState<INTEL.Finding[]>([]);
  const [openFinding, setOpenFinding] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<Record<string, string>>({});

  const say = (s: string) => setResult(s);

  return (
    <div id="ai_assistant" style={{ ...card, padding: 10, display: 'grid', gap: 8, gridTemplateRows: 'auto auto 1fr', minHeight: 190 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Sparkles size={14} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{L('مساعد الذكاء الاصطناعي', 'AI Builder')}</span>
        {(['generate', 'intel', 'assist', 'explain', 'history'] as const).map(t => <button key={t} id={`ai_tab_${t}`} onClick={() => setTab(t)} style={{ ...ghost, padding: '4px 9px', fontSize: 10.5, background: tab === t ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: tab === t ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t === 'intel' ? 'intelligence' : t}</button>)}
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

      {tab === 'intel' && (() => {
        const SCORE_COLOR = (v: number) => v >= 80 ? 'var(--color-primary-fixed,#a3f95b)' : v >= 55 ? '#ffb454' : '#ff6b6b';
        const bar = (label: string, key: keyof INTEL.Scores) => scores && (
          <div id={`intel_score_${key}`} data-score={scores[key]} className="intel-score" style={{ display: 'grid', gridTemplateColumns: '92px 1fr 32px', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{label}</span>
            <span style={{ height: 7, borderRadius: 999, background: 'var(--color-surface-container-high)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${scores[key]}%`, background: SCORE_COLOR(scores[key]), borderRadius: 999 }} /></span>
            <span style={{ fontSize: 11, fontWeight: 800, textAlign: 'end', color: SCORE_COLOR(scores[key]) }}>{scores[key]}</span>
          </div>
        );
        const analyze = () => { setScores(INTEL.score(store)); setFindings(INTEL.allFindings(store)); };
        return (
          <div style={{ display: 'grid', gap: 8, overflow: 'auto', alignContent: 'start' }} id="ai_intel">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button id="intel_analyze" onClick={analyze} style={btn}><Brain size={12} />{L('حلّل التصميم', 'Analyze design')}</button>
              <button id="intel_learn" onClick={() => setPrefs(INTEL.learnPreferences(store))} style={ghost}><Sparkles size={11} />{L('تعلّم التفضيلات', 'Learn preferences')}</button>
              {scores && <button id="intel_apply" onClick={() => { const n = INTEL.applyImprovements(store); analyze(); say(`✓ ${L('طُبّق', 'Applied')} ${n} ${L('تحسيناً', 'improvements')}`); }} style={{ ...btn, background: 'var(--color-primary-fixed)' }}><Check size={12} />{L('تطبيق التحسينات', 'Apply improvements')} ({INTEL.improvementPlan(store).length})</button>}
            </div>
            {scores && <div id="intel_scores" style={{ ...card, padding: 8, display: 'grid', gap: 5, background: 'var(--color-surface-container-high)' }}>
              <div id="intel_score_overall" data-score={scores.overall} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}><span style={{ fontSize: 11, fontWeight: 800 }}>{L('النتيجة الإجمالية', 'Overall')}</span><span style={{ fontSize: 22, fontWeight: 800, color: SCORE_COLOR(scores.overall) }}>{scores.overall}</span><span style={{ ...lbl }}>/100</span></div>
              {bar(L('التصميم', 'Design'), 'design')}{bar(L('تجربة المستخدم', 'UX'), 'ux')}{bar(L('الوصول', 'Accessibility'), 'accessibility')}{bar('SEO', 'seo')}{bar(L('الأداء', 'Performance'), 'performance')}{bar(L('التجاوب', 'Responsive'), 'responsiveness')}{bar(L('قابلية الصيانة', 'Maintainability'), 'maintainability')}
            </div>}
            {Object.keys(prefs).length > 0 && <div id="intel_prefs" style={{ ...card, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--color-surface-container-high)' }}>{Object.entries(prefs).map(([k, v]) => <span key={k} className="intel-pref" data-key={k} style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>{k}: <b style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>{v}</b></span>)}</div>}
            {result && <div id="ai_result" style={{ fontSize: 10.5, color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }}>{result}</div>}
            <div style={{ display: 'grid', gap: 4 }} id="intel_findings">
              {findings.map((f, i) => (
                <div key={i} className="intel-finding" data-area={f.area} data-severity={f.severity} style={{ ...card, background: 'var(--color-surface-container-high)', overflow: 'hidden' }}>
                  <button onClick={() => setOpenFinding(openFinding === i ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'start' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: f.severity === 'error' ? '#ff6b6b' : f.severity === 'warn' ? '#ffb454' : 'var(--color-primary-fixed,#a3f95b)' }} />
                    <span style={{ ...lbl, textTransform: 'uppercase', minWidth: 78 }}>{f.area}</span>
                    <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{f.title}</span>
                    {f.fix && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed)' }}>fix</span>}
                    <ChevronRight size={11} style={{ transform: openFinding === i ? 'rotate(90deg)' : 'none' }} />
                  </button>
                  {openFinding === i && <div className="intel-reason" style={{ padding: '2px 10px 8px 21px', display: 'grid', gap: 3, fontSize: 9.5, color: 'var(--color-on-surface-variant)' }}>
                    <div><b style={{ color: 'var(--color-on-surface)' }}>WHY:</b> {f.why}</div>
                    <div><b style={{ color: 'var(--color-on-surface)' }}>WHAT:</b> {f.what}</div>
                    <div><b style={{ color: 'var(--color-on-surface)' }}>IMPACT:</b> {f.impact}</div>
                    <div><b style={{ color: 'var(--color-on-surface)' }}>TRADEOFF:</b> {f.tradeoff}</div>
                  </div>}
                </div>
              ))}
              {scores && findings.length === 0 && <span style={{ fontSize: 10.5, color: 'var(--color-primary-fixed,#a3f95b)' }}>✓ {L('لا مشاكل — التصميم ممتاز', 'No issues — excellent design')}</span>}
              {!scores && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('اضغط «حلّل» للحصول على النتائج والتوصيات', 'Press Analyze for scores + reasoned recommendations')}</span>}
            </div>
          </div>
        );
      })()}

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
