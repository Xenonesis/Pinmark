/**
 * AnimationInspector.ts
 * Detects CSS animations/transitions on elements, records click sequences,
 * and provides pause/resume control for page animations.
 */

export interface AnimationInfo {
  type: 'css-animation' | 'css-transition';
  name: string;
  duration: string;
  timingFunction: string;
  iterationCount: string;
  direction?: string;
  property?: string; // for transitions
}

export interface RecordedStep {
  index: number;
  timestamp: number;
  type: 'click' | 'hover' | 'input' | 'scroll';
  selector: string;
  elementTag: string;
  elementText: string;
  x: number;
  y: number;
  value?: string;
  scrollY?: number;
}

const INSPECTOR_STYLES = `
  .pmk-anim-panel {
    position: fixed;
    bottom: 70px;
    right: 20px;
    width: 320px;
    max-height: 420px;
    background: #111113;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    z-index: 2147483645;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .pmk-anim-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 0 2px;
    flex-shrink: 0;
  }

  .pmk-anim-tab {
    flex: 1;
    padding: 9px 4px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.35);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s;
    white-space: nowrap;
    letter-spacing: 0.01em;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .pmk-anim-tab:hover { color: rgba(255,255,255,0.65); }
  .pmk-anim-tab.active {
    color: rgba(255,255,255,0.9);
    border-bottom-color: rgba(255,255,255,0.6);
  }

  .pmk-anim-body {
    overflow-y: auto;
    flex: 1;
    padding: 12px;
  }

  .pmk-anim-empty {
    color: rgba(255,255,255,0.25);
    font-size: 11px;
    text-align: center;
    padding: 28px 0;
    line-height: 1.6;
  }

  .pmk-anim-section-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.3);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 8px;
  }

  /* CSS Inspector tab */
  .pmk-anim-el-info {
    font-size: 11px;
    font-family: 'SF Mono', monospace;
    color: rgba(255,255,255,0.5);
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 5px;
    padding: 6px 8px;
    margin-bottom: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pmk-anim-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 7px;
    padding: 10px;
    margin-bottom: 6px;
  }

  .pmk-anim-card-type {
    font-size: 10px;
    font-weight: 500;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }

  .pmk-anim-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-family: 'SF Mono', monospace;
    line-height: 1.8;
  }

  .pmk-anim-prop { color: rgba(255,255,255,0.35); }
  .pmk-anim-val  { color: rgba(255,255,255,0.7); }

  .pmk-anim-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    font-family: 'SF Mono', monospace;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.6);
    margin-right: 4px;
    margin-bottom: 3px;
  }

  /* Recorder tab */
  .pmk-rec-controls {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .pmk-rec-btn {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.6);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  .pmk-rec-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }

  .pmk-rec-btn.recording {
    background: rgba(220,38,38,0.15);
    border-color: rgba(220,38,38,0.4);
    color: #f87171;
  }

  .pmk-rec-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    animation: pmkRecPulse 1s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pmkRecPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .pmk-step {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    margin-bottom: 5px;
    font-size: 11px;
  }

  .pmk-step-num {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.6);
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pmk-step-info { flex: 1; }
  .pmk-step-type { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 500; text-transform: uppercase; }
  .pmk-step-el { color: rgba(255,255,255,0.65); font-family: 'SF Mono', monospace; }
  .pmk-step-time { font-size: 10px; color: rgba(255,255,255,0.2); white-space: nowrap; }

  /* Pause tab */
  .pmk-pause-status {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .pmk-pause-big-btn {
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.7);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    margin-bottom: 8px;
  }

  .pmk-pause-big-btn:hover { background: rgba(255,255,255,0.08); }
  .pmk-pause-big-btn.active {
    background: rgba(251,191,36,0.12);
    border-color: rgba(251,191,36,0.3);
    color: #fbbf24;
  }

  .pmk-copy-steps-btn {
    width: 100%;
    padding: 7px;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    background: transparent;
    color: rgba(255,255,255,0.35);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    margin-top: 6px;
  }

  .pmk-copy-steps-btn:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04); }
`;

export class AnimationInspector {
  private shadowRoot: ShadowRoot;
  private panel: HTMLElement | null = null;
  private activeTab: 'inspect' | 'record' | 'pause' = 'inspect';

  // Inspect tab state
  private hoveredElement: HTMLElement | null = null;
  private inspectMouseHandler: ((e: MouseEvent) => void) | null = null;

  // Record tab state
  private isRecording = false;
  private recordedSteps: RecordedStep[] = [];
  private recordHandlers: Array<{ type: string; handler: EventListener }> = [];
  private recordStart = 0;

  // Pause tab state
  private isPaused = false;
  public getIsPaused() { return this.isPaused; }
  private pauseStyleEl: HTMLStyleElement | null = null;

  public onAnnotate?: (data: { animationData: AnimationInfo[]; steps: RecordedStep[]; element?: HTMLElement }) => void;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
    this.injectStyles();
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = INSPECTOR_STYLES;
    this.shadowRoot.appendChild(style);
  }

  public show() {
    if (this.panel) return;
    this.panel = this.buildPanel();
    this.shadowRoot.appendChild(this.panel);
    this.switchTab(this.activeTab);
  }

  public hide() {
    this.stopRecording();
    this.stopInspectListener();
    this.panel?.remove();
    this.panel = null;
  }

  public toggle() {
    if (this.panel) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isVisible() {
    return !!this.panel;
  }

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'pmk-anim-panel';

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'pmk-anim-tabs';

    const tabDefs: Array<{ id: 'inspect' | 'record' | 'pause'; label: string }> = [
      { id: 'inspect', label: 'CSS Inspector' },
      { id: 'record', label: 'Recorder' },
      { id: 'pause', label: 'Pause Ctrl' },
    ];

    tabDefs.forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'pmk-anim-tab';
      btn.textContent = label;
      btn.dataset.tab = id;
      btn.onclick = () => this.switchTab(id);
      tabs.appendChild(btn);
    });

    // Body
    const body = document.createElement('div');
    body.className = 'pmk-anim-body';
    body.id = 'pmk-anim-body';

    panel.appendChild(tabs);
    panel.appendChild(body);
    return panel;
  }

  private switchTab(tab: 'inspect' | 'record' | 'pause') {
    this.activeTab = tab;

    // Update tab buttons
    this.panel?.querySelectorAll('.pmk-anim-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab);
    });

    // Cleanup previous tab
    if (tab !== 'inspect') this.stopInspectListener();

    // Render body
    const body = this.panel?.querySelector('#pmk-anim-body') as HTMLElement;
    if (!body) return;
    body.innerHTML = '';

    if (tab === 'inspect') this.renderInspectTab(body);
    if (tab === 'record') this.renderRecordTab(body);
    if (tab === 'pause') this.renderPauseTab(body);
  }

  // ── CSS INSPECTOR TAB ──────────────────────────────────────────

  private renderInspectTab(body: HTMLElement) {
    const label = document.createElement('div');
    label.className = 'pmk-anim-section-label';
    label.textContent = 'Hover an element to inspect animations';
    body.appendChild(label);

    const elInfo = document.createElement('div');
    elInfo.className = 'pmk-anim-el-info';
    elInfo.textContent = 'Move cursor over page elements...';
    elInfo.id = 'pmk-el-info';
    body.appendChild(elInfo);

    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'pmk-anim-results';
    body.appendChild(resultsDiv);

    this.startInspectListener(elInfo, resultsDiv);
  }

  private startInspectListener(elInfoEl: HTMLElement, resultsEl: HTMLElement) {
    this.inspectMouseHandler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      // Ignore our own UI
      if (el.closest('.pmk-anim-panel') || el.getRootNode() === this.shadowRoot) return;

      if (el === this.hoveredElement) return;
      this.hoveredElement = el;

      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      elInfoEl.textContent = `${tag}${id}${cls}`;

      const animations = this.getElementAnimations(el);
      this.renderAnimationResults(resultsEl, animations, el);
    };

    document.addEventListener('mousemove', this.inspectMouseHandler, { passive: true });
  }

  private stopInspectListener() {
    if (this.inspectMouseHandler) {
      document.removeEventListener('mousemove', this.inspectMouseHandler);
      this.inspectMouseHandler = null;
    }
    this.hoveredElement = null;
  }

  private getElementAnimations(el: HTMLElement): AnimationInfo[] {
    const results: AnimationInfo[] = [];
    const computed = window.getComputedStyle(el);

    // CSS Animations
    const animNames = computed.animationName?.split(',').map(s => s.trim()).filter(s => s && s !== 'none') || [];
    const animDurations = computed.animationDuration?.split(',').map(s => s.trim()) || [];
    const animTimings = computed.animationTimingFunction?.split(',').map(s => s.trim()) || [];
    const animIterations = computed.animationIterationCount?.split(',').map(s => s.trim()) || [];
    const animDirections = computed.animationDirection?.split(',').map(s => s.trim()) || [];

    animNames.forEach((name, i) => {
      results.push({
        type: 'css-animation',
        name,
        duration: animDurations[i] || animDurations[0] || '0s',
        timingFunction: animTimings[i] || animTimings[0] || 'ease',
        iterationCount: animIterations[i] || animIterations[0] || '1',
        direction: animDirections[i] || animDirections[0] || 'normal',
      });
    });

    // CSS Transitions
    const transProps = computed.transitionProperty?.split(',').map(s => s.trim()).filter(s => s && s !== 'none') || [];
    const transDurations = computed.transitionDuration?.split(',').map(s => s.trim()) || [];
    const transTimings = computed.transitionTimingFunction?.split(',').map(s => s.trim()) || [];

    transProps.forEach((prop, i) => {
      const dur = transDurations[i] || transDurations[0] || '0s';
      if (dur === '0s') return; // skip trivial transitions
      results.push({
        type: 'css-transition',
        name: 'transition',
        property: prop,
        duration: dur,
        timingFunction: transTimings[i] || transTimings[0] || 'ease',
        iterationCount: '1',
      });
    });

    // Also check Web Animations API
    try {
      const webAnims = (el as any).getAnimations?.() as Animation[];
      if (webAnims && webAnims.length > 0) {
        webAnims.forEach((anim) => {
          const effect = anim.effect as KeyframeEffect | null;
          const timing = effect?.getTiming?.();
          if (timing && !results.find(r => r.name === ((anim as any).animationName || anim.id))) {
            results.push({
              type: 'css-animation',
              name: (anim as any).animationName || anim.id || 'unnamed',
              duration: timing.duration ? `${timing.duration}ms` : '0ms',
              timingFunction: 'ease',
              iterationCount: String(timing.iterations ?? 1),
            });
          }
        });
      }
    } catch { /* ignore */ }

    return results;
  }

  private renderAnimationResults(container: HTMLElement, animations: AnimationInfo[], el: HTMLElement) {
    container.innerHTML = '';

    if (animations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pmk-anim-empty';
      empty.textContent = 'No CSS animations or transitions\ndetected on this element.';
      container.appendChild(empty);
      return;
    }

    animations.forEach(anim => {
      const card = document.createElement('div');
      card.className = 'pmk-anim-card';

      const typeLabel = document.createElement('div');
      typeLabel.className = 'pmk-anim-card-type';
      typeLabel.textContent = anim.type === 'css-animation' ? 'CSS Animation' : 'CSS Transition';
      card.appendChild(typeLabel);

      const rows: Array<[string, string]> = [];
      if (anim.type === 'css-animation') {
        rows.push(['name', anim.name]);
      } else {
        rows.push(['property', anim.property || '']);
      }
      rows.push(['duration', anim.duration]);
      rows.push(['timing', anim.timingFunction.length > 22 ? anim.timingFunction.slice(0, 22) + '…' : anim.timingFunction]);
      if (anim.type === 'css-animation') {
        rows.push(['iterations', anim.iterationCount]);
        if (anim.direction && anim.direction !== 'normal') rows.push(['direction', anim.direction]);
      }

      rows.forEach(([prop, val]) => {
        const row = document.createElement('div');
        row.className = 'pmk-anim-row';
        row.innerHTML = `<span class="pmk-anim-prop">${prop}</span><span class="pmk-anim-val">${val}</span>`;
        card.appendChild(row);
      });

      // Annotate button
      const annotateBtn = document.createElement('button');
      annotateBtn.style.cssText = 'margin-top:8px;width:100%;padding:5px 0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:5px;color:rgba(255,255,255,0.5);font-size:11px;cursor:pointer;font-family:inherit;transition:all 0.15s;';
      annotateBtn.textContent = 'Save as Annotation';
      annotateBtn.onmouseenter = () => { annotateBtn.style.background = 'rgba(255,255,255,0.1)'; annotateBtn.style.color = 'rgba(255,255,255,0.85)'; };
      annotateBtn.onmouseleave = () => { annotateBtn.style.background = 'rgba(255,255,255,0.05)'; annotateBtn.style.color = 'rgba(255,255,255,0.5)'; };
      annotateBtn.onclick = () => {
        this.onAnnotate?.({ animationData: [anim], steps: [], element: el });
        annotateBtn.textContent = 'Saved!';
        setTimeout(() => { annotateBtn.textContent = 'Save as Annotation'; }, 1500);
      };
      card.appendChild(annotateBtn);
      container.appendChild(card);
    });
  }

  // ── RECORDER TAB ──────────────────────────────────────────────

  private renderRecordTab(body: HTMLElement) {
    const controls = document.createElement('div');
    controls.className = 'pmk-rec-controls';

    const recBtn = document.createElement('button');
    recBtn.className = `pmk-rec-btn${this.isRecording ? ' recording' : ''}`;
    recBtn.id = 'pmk-rec-btn';
    if (this.isRecording) {
      recBtn.innerHTML = `<span class="pmk-rec-dot"></span>Stop`;
    } else {
      recBtn.innerHTML = `● Record`;
    }
    recBtn.onclick = () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
      this.switchTab('record');
    };

    const clearBtn = document.createElement('button');
    clearBtn.className = 'pmk-rec-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => {
      this.recordedSteps = [];
      this.switchTab('record');
    };

    controls.appendChild(recBtn);
    controls.appendChild(clearBtn);
    body.appendChild(controls);

    if (this.recordedSteps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pmk-anim-empty';
      empty.textContent = this.isRecording
        ? 'Recording... Click elements on the page.'
        : 'Click Record to start capturing\nuser interaction steps.';
      body.appendChild(empty);
    } else {
      const label = document.createElement('div');
      label.className = 'pmk-anim-section-label';
      label.textContent = `${this.recordedSteps.length} step${this.recordedSteps.length !== 1 ? 's' : ''} recorded`;
      body.appendChild(label);

      this.recordedSteps.forEach(step => {
        const stepEl = document.createElement('div');
        stepEl.className = 'pmk-step';
        const elapsed = ((step.timestamp - this.recordStart) / 1000).toFixed(1);
        stepEl.innerHTML = `
          <div class="pmk-step-num">${step.index}</div>
          <div class="pmk-step-info">
            <div class="pmk-step-type">${step.type}</div>
            <div class="pmk-step-el">${step.elementTag}${step.elementText ? ` — "${step.elementText}"` : ''}</div>
          </div>
          <div class="pmk-step-time">+${elapsed}s</div>
        `;
        body.appendChild(stepEl);
      });

      const saveBtn = document.createElement('button');
      saveBtn.className = 'pmk-copy-steps-btn';
      saveBtn.textContent = 'Save as Annotation';
      saveBtn.onclick = () => {
        this.onAnnotate?.({ animationData: [], steps: this.recordedSteps });
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = 'Save as Annotation'; }, 1500);
      };
      body.appendChild(saveBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'pmk-copy-steps-btn';
      copyBtn.textContent = 'Copy as JSON';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(this.recordedSteps, null, 2)).catch(() => {});
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy as JSON'; }, 1500);
      };
      body.appendChild(copyBtn);
    }
  }

  private startRecording() {
    if (this.isRecording) return;
    this.isRecording = true;
    this.recordedSteps = [];
    this.recordStart = Date.now();

    const addStep = (type: RecordedStep['type'], e: Event) => {
      const el = e.target as HTMLElement;
      if (!el || el.getRootNode() === this.shadowRoot) return;

      const text = (el.textContent || '').trim().slice(0, 40);
      const me = e as MouseEvent;

      this.recordedSteps.push({
        index: this.recordedSteps.length + 1,
        timestamp: Date.now(),
        type,
        selector: this.getSelector(el),
        elementTag: el.tagName.toLowerCase(),
        elementText: text,
        x: me.clientX ?? 0,
        y: me.clientY ?? 0,
        value: type === 'input' ? (el as HTMLInputElement).value : undefined,
      });
    };

    const clickH: EventListener = (e) => addStep('click', e);
    const inputH: EventListener = (e) => addStep('input', e);

    document.addEventListener('click', clickH, { capture: true, passive: true });
    document.addEventListener('input', inputH, { capture: true, passive: true });

    this.recordHandlers = [
      { type: 'click', handler: clickH },
      { type: 'input', handler: inputH },
    ];
  }

  private stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.recordHandlers.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler, { capture: true } as any);
    });
    this.recordHandlers = [];
  }

  private getSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return `${tag}${cls}`;
  }

  // ── PAUSE CONTROL TAB ─────────────────────────────────────────

  private renderPauseTab(body: HTMLElement) {
    const status = document.createElement('div');
    status.className = 'pmk-pause-status';
    status.textContent = this.isPaused
      ? 'All CSS animations and transitions are currently paused.'
      : 'Pause all CSS animations and transitions on this page for inspection.';
    body.appendChild(status);

    const pauseBtn = document.createElement('button');
    pauseBtn.className = `pmk-pause-big-btn${this.isPaused ? ' active' : ''}`;
    pauseBtn.textContent = this.isPaused ? 'Resume All Animations' : 'Pause All Animations';
    pauseBtn.onclick = () => {
      if (this.isPaused) {
        this.resumeAnimations();
      } else {
        this.pauseAnimations();
      }
      this.switchTab('pause');
    };
    body.appendChild(pauseBtn);

    // Transition-only pause
    const transLabel = document.createElement('div');
    transLabel.className = 'pmk-anim-section-label';
    transLabel.style.marginTop = '14px';
    transLabel.textContent = 'Quick Actions';
    body.appendChild(transLabel);

    const slowBtn = document.createElement('button');
    slowBtn.className = 'pmk-pause-big-btn';
    slowBtn.textContent = 'Slow Motion (10x slower)';
    slowBtn.onclick = () => {
      this.setAnimationSpeed(0.1);
      slowBtn.textContent = 'Slow Motion active';
      setTimeout(() => { slowBtn.textContent = 'Slow Motion (10x slower)'; }, 3000);
    };
    body.appendChild(slowBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'pmk-copy-steps-btn';
    resetBtn.textContent = 'Reset animation speed';
    resetBtn.onclick = () => this.setAnimationSpeed(1);
    body.appendChild(resetBtn);
  }

  public togglePause() {
    if (this.isPaused) this.resumeAnimations();
    else this.pauseAnimations();
  }

  public pauseAnimations() {
    if (this.isPaused) return;
    this.isPaused = true;

    if (!this.pauseStyleEl) {
      this.pauseStyleEl = document.createElement('style');
      this.pauseStyleEl.id = 'pinmark-pause-animations';
    }
    // Deep freeze: pauses keyframes and uses 99999s transition delay to completely lock hover/focus/active states
    this.pauseStyleEl.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition-property: all !important;
        transition-duration: 0s !important;
        transition-delay: 99999s !important;
      }
    `;
    document.head.appendChild(this.pauseStyleEl);
  }

  public resumeAnimations() {
    this.isPaused = false;
    this.pauseStyleEl?.remove();
  }

  private setAnimationSpeed(multiplier: number) {
    if (!this.pauseStyleEl) {
      this.pauseStyleEl = document.createElement('style');
      this.pauseStyleEl.id = 'pinmark-anim-speed';
    }
    if (multiplier === 1) {
      this.pauseStyleEl.remove();
      return;
    }
    this.pauseStyleEl.textContent = `
      *, *::before, *::after {
        animation-duration: calc(var(--pmk-orig-dur, 1s) * ${1 / multiplier}) !important;
        transition-duration: calc(var(--pmk-orig-tdur, 0.3s) * ${1 / multiplier}) !important;
      }
    `;
    document.head.appendChild(this.pauseStyleEl);
  }

  public destroy() {
    this.hide();
    this.resumeAnimations();
  }
}
