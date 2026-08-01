// Deterministic auto-triage: classifies a pin (category / intent / severity)
// from the captured diagnostics bundle at pin time. The result pre-fills the
// modal's Category/Intent/Severity dropdowns (user can override) and is stored
// on the pin as `triage` for the AI. Pure heuristics — no network, never throws.

export interface TriageInput {
  performanceMetrics?: any[];
  networkRequests?: any[];
  a11yIssues?: any[];
  errorTrace?: any[];
  fpsMetrics?: any[];
  memoryMetrics?: any;
  domMetrics?: any;
}

export interface TriageResult {
  category: 'bug' | 'improvement' | 'question' | 'design';
  intent: 'fix' | 'change' | 'question' | 'approve';
  severity: 'blocking' | 'important' | 'suggestion';
  summary: string;
  reasons: string[];
}

const SEVERITY_ORDER = { suggestion: 0, important: 1, blocking: 2 } as const;

/** Fold the strongest signal into the running classification. */
function fold(
  current: { category: TriageResult['category']; intent: TriageResult['intent']; severity: TriageResult['severity']; reasons: string[] },
  next: { category?: TriageResult['category']; intent?: TriageResult['intent']; severity?: TriageResult['severity']; reason: string },
) {
  current.reasons.push(next.reason);
  if (next.severity && SEVERITY_ORDER[next.severity] > SEVERITY_ORDER[current.severity]) {
    current.severity = next.severity;
  }
  // Category precedence: bug > improvement > design > question
  const CAT_ORDER = { question: 0, design: 1, improvement: 2, bug: 3 } as const;
  if (next.category && CAT_ORDER[next.category] > CAT_ORDER[current.category]) {
    current.category = next.category;
    current.intent = next.intent || current.intent;
  }
}

export function autoTriage(input: TriageInput): TriageResult {
  const reasons: string[] = [];
  let category: TriageResult['category'] = 'question';
  let intent: TriageResult['intent'] = 'question';
  let severity: TriageResult['severity'] = 'suggestion';
  const current = { category, intent, severity, reasons: reasons as string[] };

  const perf = input.performanceMetrics || [];
  const errors = input.errorTrace || [];
  const network = input.networkRequests || [];
  const a11y = input.a11yIssues || [];

  // ── Runtime errors: strongest bug signal ──
  if (errors.length > 0) {
    const hasFatal = errors.some((e: any) => e.type === 'error');
    fold(current, {
      category: 'bug',
      intent: 'fix',
      severity: hasFatal ? 'blocking' : 'important',
      reason: `${errors.length} runtime error(s) captured (${errors.map((e: any) => e.name).join(', ')})`,
    });
  }

  // ── Network failures ──
  const failing = network.filter((r: any) => r.isError || (r.status && r.status >= 400));
  const serverFailures = failing.filter((r: any) => r.isError || (r.status && r.status >= 500));
  if (failing.length > 0) {
    fold(current, {
      category: 'bug',
      intent: 'fix',
      severity: serverFailures.length > 0 ? 'blocking' : 'important',
      reason: `${failing.length} failing request(s) (${failing.map((r: any) => `${r.method} ${r.status ?? 'ERR'}`).join(', ')})`,
    });
  }

  // ── Layout stability (CLS) ──
  const clsEntries = perf.filter((p: any) => p.entryType === 'layout-shift');
  const maxCls = clsEntries.reduce((m: number, e: any) => Math.max(m, e.value || 0), 0);
  if (maxCls > 0.1) {
    fold(current, {
      category: 'bug',
      intent: 'fix',
      severity: maxCls > 0.25 ? 'blocking' : 'important',
      reason: `layout shift detected (max CLS ${maxCls.toFixed(3)})`,
    });
  }

  // ── Main-thread blocking ──
  const longTasks = perf.filter((p: any) => p.entryType === 'longtask');
  const totalBlocking = longTasks.reduce((s: number, t: any) => s + Math.max(0, (t.duration || 0) - 50), 0);
  if (longTasks.length > 0) {
    fold(current, {
      category: 'improvement',
      intent: 'fix',
      severity: totalBlocking > 500 ? 'blocking' : 'important',
      reason: `${longTasks.length} long task(s) (${Math.round(totalBlocking)}ms total blocking time)`,
    });
  }

  // ── Memory ──
  if (input.memoryMetrics && input.memoryMetrics.usedJSHeapSize > 100 * 1024 * 1024) {
    fold(current, {
      category: 'improvement',
      intent: 'fix',
      severity: 'important',
      reason: `memory usage ${(input.memoryMetrics.usedJSHeapSize / 1048576).toFixed(0)}MB`,
    });
  }

  // ── Accessibility ──
  const a11yErrors = a11y.filter((i: any) => i.severity === 'error');
  const a11yWarnings = a11y.filter((i: any) => i.severity === 'warning');
  if (a11yErrors.length > 0 || a11yWarnings.length > 0) {
    fold(current, {
      category: 'improvement',
      intent: 'change',
      severity: a11yErrors.length > 0 ? 'important' : 'suggestion',
      reason: `${a11y.length} WCAG issue(s) (${a11yErrors.length} error, ${a11yWarnings.length} warning)`,
    });
  }

  // ── DOM weight ──
  if (input.domMetrics && input.domMetrics.totalNodes > 1500) {
    fold(current, {
      category: 'improvement',
      intent: 'change',
      severity: 'suggestion',
      reason: `large DOM (${input.domMetrics.totalNodes} nodes)`,
    });
  }

  // ── FPS dips ──
  const fpsDips = (input.fpsMetrics || []).filter((f: any) => f.fps < 30);
  if (fpsDips.length > 0) {
    fold(current, {
      category: 'improvement',
      intent: 'fix',
      severity: 'important',
      reason: `${fpsDips.length} FPS dip(s) below 30`,
    });
  }

  // ── Nothing found → not actionable ──
  if (reasons.length === 0) {
    return {
      category: 'question',
      intent: 'approve',
      severity: 'suggestion',
      summary: 'No performance, network, state, or accessibility problems detected on the pinned element.',
      reasons: [],
    };
  }

  const top = reasons[0];
  let summary = `Auto-triage: ${current.category} (${current.severity}) — ${top}.`;
  if (reasons.length > 1) summary += ` Also: ${reasons.slice(1, 3).join('; ')}.`;

  return { category: current.category, intent: current.intent, severity: current.severity, summary, reasons };
}
