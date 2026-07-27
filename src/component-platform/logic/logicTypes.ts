// ─────────────────────────────────────────────────────────────────────────────
// Application Logic types (Phase 9B). Pure types shared by the logic engines + UI.
// ─────────────────────────────────────────────────────────────────────────────

export type VarScope = 'global' | 'tenant' | 'environment' | 'runtime' | 'session' | 'screen' | 'component' | 'computed';
export const VAR_SCOPES: VarScope[] = ['global', 'tenant', 'environment', 'runtime', 'session', 'screen', 'component', 'computed'];

export type VarType = 'string' | 'number' | 'boolean' | 'color' | 'image' | 'object' | 'array' | 'date' | 'json' | 'reference';
export const VAR_TYPES: VarType[] = ['string', 'number', 'boolean', 'color', 'image', 'object', 'array', 'date', 'json', 'reference'];

export interface Variable {
  id: string;
  name: string;
  scope: VarScope;
  type: VarType;
  value: unknown;
  /** For computed variables — an expression over the scope. */
  computed?: string;
  description?: string;
}

export type BindingMode = 'oneway' | 'twoway' | 'computed' | 'expression' | 'conditional';
export interface Binding {
  mode: BindingMode;
  /** Expression evaluated against the logic scope (var / state / data / theme / ctx). */
  expr: string;
  fallback?: string;
}

export type ActionType =
  | 'navigate' | 'dialog' | 'bottomSheet' | 'snackbar' | 'toast' | 'api' | 'submit'
  | 'setVariable' | 'updateState' | 'copy' | 'share' | 'download' | 'upload'
  | 'login' | 'logout' | 'refresh' | 'delay' | 'animation' | 'workflow';
export const ACTION_TYPES: ActionType[] = ['setVariable', 'updateState', 'navigate', 'toast', 'snackbar', 'dialog', 'bottomSheet', 'api', 'submit', 'copy', 'share', 'download', 'upload', 'login', 'logout', 'refresh', 'delay', 'animation', 'workflow'];

export interface ActionSpec {
  id: string;
  event: string;          // e.g. 'click', 'submit'
  type: ActionType;
  params: Record<string, unknown>;
}

export type ConditionTarget = 'visible' | 'enabled';
export interface Condition { target: ConditionTarget; expr: string; }

export type ValidatorKind = 'required' | 'email' | 'phone' | 'regex' | 'min' | 'max' | 'custom';
export const VALIDATOR_KINDS: ValidatorKind[] = ['required', 'email', 'phone', 'regex', 'min', 'max', 'custom'];
export interface Validator { kind: ValidatorKind; value?: string | number; message?: string; }

export type WorkflowNodeType = 'start' | 'action' | 'api' | 'condition' | 'delay' | 'loop' | 'variable' | 'navigation' | 'notification' | 'storage' | 'authentication' | 'finish';
export const WORKFLOW_NODE_TYPES: WorkflowNodeType[] = ['start', 'variable', 'condition', 'action', 'api', 'navigation', 'notification', 'storage', 'authentication', 'delay', 'loop', 'finish'];
export interface WorkflowNode { id: string; type: WorkflowNodeType; label: string; config: Record<string, unknown>; }
export interface Workflow { id: string; name: string; nodes: WorkflowNode[]; }
export interface WorkflowTraceStep { nodeId: string; type: WorkflowNodeType; label: string; result: string; }

export type DataSourceKind = 'local' | 'supabase' | 'firebase' | 'rest' | 'graphql' | 'json' | 'static' | 'runtime' | 'media' | 'storage' | 'auth' | 'tenant' | 'flags';
export const DATA_SOURCE_KINDS: DataSourceKind[] = ['local', 'json', 'static', 'runtime', 'supabase', 'firebase', 'rest', 'graphql', 'media', 'storage', 'auth', 'tenant', 'flags'];
export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  /** Sample/seed payload used at build time; live connection wraps the existing service. */
  sample: unknown;
  /** Which existing service this source wraps (audit trail — never a duplicate implementation). */
  reuses?: string;
  config?: Record<string, unknown>;
}
