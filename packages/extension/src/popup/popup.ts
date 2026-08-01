import type { ExtensionSettings, FeedbackItem } from '../shared/types';
import { sendMessage } from '../shared/messaging';
import { getSettings, saveSettings, getFeedback } from '../shared/storage';
import { setHTML } from "../../../pinmark/src/vanilla/domUtils";
import { MarkdownFormatter } from "../../../pinmark/src/vanilla/MarkdownFormatter";

let currentTabId: number | null = null;
let currentTabUrl: string = '';
let isActive = false;
const formatter = new MarkdownFormatter();

// ── DOM refs ──────────────────────────────────────────
const toggleBtnCheckbox = document.getElementById('toggleBtnCheckbox') as HTMLInputElement;
const statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
const statusMsg = document.getElementById('statusMsg') as HTMLElement;

const outputDetailLabel = document.getElementById('outputDetailLabel') as HTMLElement;
const outputDetailSelect = document.getElementById('outputDetail') as HTMLSelectElement;
const outputDetailTrigger = document.getElementById('outputDetailTrigger') as HTMLButtonElement;

const blockInteractionsToggle = document.getElementById('blockInteractions') as HTMLInputElement;
const hideUntilRestartToggle = document.getElementById('hideUntilRestart') as HTMLInputElement;
const reactComponentsToggle = document.getElementById('reactComponents') as HTMLInputElement;
const clearAfterCopyCheckbox = document.getElementById('clearAfterCopy') as HTMLInputElement;
const markerColorInput = document.getElementById('markerColor') as HTMLInputElement;
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;

const swatches = document.querySelectorAll('.swatch[data-color]') as NodeListOf<HTMLButtonElement>;


const autoSyncToggle = document.getElementById('autoSync') as HTMLInputElement;
const mcpEndpointInput = document.getElementById('mcpEndpoint') as HTMLInputElement;
const webhookUrlInput = document.getElementById('webhookUrl') as HTMLInputElement;
const githubTokenInput = document.getElementById('githubToken') as HTMLInputElement;
const githubRepoInput = document.getElementById('githubRepo') as HTMLInputElement;
const copyJsonBtn = document.getElementById('copyJsonBtn') as HTMLButtonElement;

// ── Theme ─────────────────────────────────────────────
let isDark = true;

const THEME_ICONS = {
  light: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 4.3l1.4 1.4"/></svg>`,
  dark: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 13.5A7.5 7.5 0 018.5 2.5a8.5 8.5 0 108 11z"/></svg>`,
  auto: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="14" height="9" rx="1.5"/><path d="M8 17h4M10 14v3"/></svg>`
};

async function applyTheme(theme: 'light' | 'dark' | 'auto') {
  if (theme === 'auto') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    isDark = theme === 'dark';
  }
  document.body.classList.toggle('light', !isDark);
  
  if (themeToggleBtn) {
    setHTML(themeToggleBtn, THEME_ICONS[theme] || THEME_ICONS.auto);
    themeToggleBtn.title = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  }
}

// ── Update toggle button state ─────────────────────────
function updateToggleButton() {
  if (isActive) {
    if (toggleBtnCheckbox) toggleBtnCheckbox.checked = true;
    statusIndicator?.classList.add('active');
  } else {
    if (toggleBtnCheckbox) toggleBtnCheckbox.checked = false;
    statusIndicator?.classList.remove('active');
  }
}

// ── Load settings into UI ─────────────────────────────
function loadSettings(settings: ExtensionSettings) {
  if (outputDetailSelect) {
    outputDetailSelect.value = settings.outputDetail;
    if (outputDetailLabel) {
      const map: Record<string, string> = { minimal: 'Compact', compact: 'Compact', standard: 'Standard', comprehensive: 'Detailed', detailed: 'Detailed', forensic: 'Forensic' };
      outputDetailLabel.textContent = map[settings.outputDetail] || 'Standard';
    }
  }
  if (blockInteractionsToggle) blockInteractionsToggle.checked = settings.blockInteractions;
  if (hideUntilRestartToggle) hideUntilRestartToggle.checked = settings.hideUntilRestart;
  if (clearAfterCopyCheckbox) clearAfterCopyCheckbox.checked = settings.clearAfterCopy;

  // Marker color
  const color = settings.markerColor || '#d63031';
  markerColorInput.value = color;
  updateSwatchSelection(color);

  if (autoSyncToggle) autoSyncToggle.checked = settings.autoSync;
  if (mcpEndpointInput) mcpEndpointInput.value = settings.mcpEndpoint || 'http://127.0.0.1:4747';
  if (webhookUrlInput) webhookUrlInput.value = settings.webhookUrl || '';
  if (githubTokenInput) githubTokenInput.value = settings.githubToken || '';
  if (githubRepoInput) githubRepoInput.value = settings.githubRepo || '';
}

function updateSwatchSelection(color: string) {
  swatches.forEach(s => {
    s.classList.toggle('selected', s.dataset.color?.toLowerCase() === color.toLowerCase());
  });
}

// ── Save a single setting ─────────────────────────────
async function saveSetting(key: keyof ExtensionSettings, value: unknown) {
  await sendMessage({ type: 'SAVE_SETTINGS', settings: { [key]: value } });
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'UPDATE_SETTINGS', settings: { [key]: value } }).catch(() => {});
  }
}

// ── Output Detail Dropdown ─────────────────────────────
let dropdownOpen = false;
let dropdown: HTMLElement | null = null;

function closeDropdown() {
  if (dropdown) { dropdown.remove(); dropdown = null; }
  dropdownOpen = false;
}

function openDropdown() {
  if (dropdownOpen) { closeDropdown(); return; }
  dropdownOpen = true;

  dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu';
  dropdown.style.position = 'fixed';

  const rect = outputDetailTrigger.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.style.left = `${rect.left - 100}px`;

  const options = [
    { value: 'minimal', label: 'Compact' },
    { value: 'standard', label: 'Standard' },
    { value: 'comprehensive', label: 'Detailed' },
    { value: 'forensic', label: 'Forensic' },
  ];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.textContent = opt.label;
    if (outputDetailSelect.value === opt.value) btn.classList.add('active');
    btn.onclick = async () => {
      outputDetailSelect.value = opt.value;
      if (outputDetailLabel) outputDetailLabel.textContent = opt.label;
      await saveSetting('outputDetail', opt.value as 'minimal' | 'standard' | 'comprehensive' | 'forensic');
      closeDropdown();
    };
    dropdown!.appendChild(btn);
  });

  document.body.appendChild(dropdown);

  setTimeout(() => {
    document.addEventListener('click', closeDropdown, { once: true });
  }, 0);
}

outputDetailTrigger?.addEventListener('click', (e) => { e.stopPropagation(); openDropdown(); });

// ── Swatches ──────────────────────────────────────────
swatches.forEach(s => {
  s.addEventListener('click', async () => {
    const color = s.dataset.color!;
    markerColorInput.value = color;
    updateSwatchSelection(color);
    await saveSetting('markerColor', color);
  });
});

markerColorInput?.addEventListener('input', async (e) => {
  const color = (e.target as HTMLInputElement).value;
  updateSwatchSelection(color);
  await saveSetting('markerColor', color);
});

// ── Toggles ───────────────────────────────────────────
blockInteractionsToggle?.addEventListener('change', async () => {
  await saveSetting('blockInteractions', blockInteractionsToggle.checked);
});

hideUntilRestartToggle?.addEventListener('change', async () => {
  await saveSetting('hideUntilRestart', hideUntilRestartToggle.checked);
});

reactComponentsToggle?.addEventListener('change', async () => {
  // no-op: reactComponents is a UI hint only, not a persistent setting
});

clearAfterCopyCheckbox?.addEventListener('change', async () => {
  await saveSetting('clearAfterCopy', clearAfterCopyCheckbox.checked);
});

// ── Theme Toggle ──────────────────────────────────────
themeToggleBtn?.addEventListener('click', async () => {
  const s = await getSettings();
  const themes: Array<'auto' | 'light' | 'dark'> = ['auto', 'dark', 'light'];
  const idx = themes.indexOf((s.theme as 'auto' | 'light' | 'dark') || 'auto');
  const next = themes[(idx + 1) % themes.length];
  await saveSettings({ theme: next });
  applyTheme(next);
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'UPDATE_SETTINGS', settings: { theme: next } }).catch(() => {});
  }
});

// ── Activate / Deactivate ─────────────────────────────
toggleBtnCheckbox?.addEventListener('change', async (e) => {
  e.preventDefault();
  // Revert UI checkbox instantly; we will update it after confirmation
  toggleBtnCheckbox.checked = isActive;

  const nextActive = !isActive;
  try {
    const response = await sendMessage({ type: 'TOGGLE_EXTENSION', isActive: nextActive }) as { isActive: boolean };
    isActive = response.isActive;
    updateToggleButton();

    if (currentTabId !== null) {
      if (isActive) {
        chrome.tabs.sendMessage(currentTabId, { type: 'ACTIVATE_OVERLAY' }).catch(() => {});
      } else {
        chrome.tabs.sendMessage(currentTabId, { type: 'DEACTIVATE_OVERLAY' }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Pinmark] Toggle activation failed:', err);
  }
});

// ── Advanced Panel (inline slide) ────────────────────
const openAdvancedBtn = document.getElementById('openAdvanced') as HTMLButtonElement;
const closeAdvancedBtn = document.getElementById('closeAdvanced') as HTMLButtonElement;
const mainCard = document.querySelector('.card:not(.advanced-panel)') as HTMLElement;
const advancedPanel = document.getElementById('advancedPanel') as HTMLElement;

openAdvancedBtn?.addEventListener('click', () => {
  mainCard.classList.add('slide-out');
  setTimeout(() => {
    mainCard.style.display = 'none';
    mainCard.classList.remove('slide-out');
    advancedPanel.style.display = '';
    advancedPanel.classList.add('slide-in');
    advancedPanel.addEventListener('animationend', () => advancedPanel.classList.remove('slide-in'), { once: true });
  }, 150);
});

closeAdvancedBtn?.addEventListener('click', () => {
  advancedPanel.classList.add('slide-out');
  setTimeout(() => {
    advancedPanel.style.display = 'none';
    advancedPanel.classList.remove('slide-out');
    mainCard.style.display = '';
    mainCard.classList.add('slide-in');
    mainCard.addEventListener('animationend', () => mainCard.classList.remove('slide-in'), { once: true });
  }, 150);
});

// ── Review Panel ─────────────────────────────────────
const openReviewBtn = document.getElementById('openReview') as HTMLButtonElement;
const closeReviewBtn = document.getElementById('closeReview') as HTMLButtonElement;
const reviewPanel = document.getElementById('reviewPanel') as HTMLElement;
const reviewMeta = document.getElementById('reviewMeta') as HTMLElement;
const reviewList = document.getElementById('reviewList') as HTMLElement;

function slideToPanel(panel: HTMLElement) {
  mainCard.classList.add('slide-out');
  setTimeout(() => {
    mainCard.style.display = 'none';
    mainCard.classList.remove('slide-out');
    panel.style.display = '';
    panel.classList.add('slide-in');
    panel.addEventListener('animationend', () => panel.classList.remove('slide-in'), { once: true });
  }, 150);
}

function slideBackFromPanel(panel: HTMLElement) {
  panel.classList.add('slide-out');
  setTimeout(() => {
    panel.style.display = 'none';
    panel.classList.remove('slide-out');
    mainCard.style.display = '';
    mainCard.classList.add('slide-in');
    mainCard.addEventListener('animationend', () => mainCard.classList.remove('slide-in'), { once: true });
  }, 150);
}

openReviewBtn?.addEventListener('click', () => {
  renderReview();
  slideToPanel(reviewPanel);
});

closeReviewBtn?.addEventListener('click', () => slideBackFromPanel(reviewPanel));

// ── Review rendering ─────────────────────────────────
function triageChip(item: FeedbackItem): string {
  const t: any = item.triage;
  const sev = t?.severity || item.severity || 'suggestion';
  const cat = t?.category || item.category || 'question';
  return `<span class="triage-chip sev-${sev}">${cat} · ${sev}</span>`;
}

function diagnosticBadges(item: FeedbackItem): string {
  const perf = (item.performanceMetrics || []).filter((m: any) => m.entryType === 'longtask').length;
  const failing = (item.networkRequests || []).filter((r: any) => r.isError || (r.status && r.status >= 400)).length;
  const stores = ((item.stateSnapshot as any)?.detected || []).length;
  const a11y = (item.a11yIssues || []).length;
  const errors = (item.errorTrace || []).length;
  const badges: string[] = [];
  if (perf > 0) badges.push(`<span class="diag-badge">⏱ ${perf}</span>`);
  if (failing > 0) badges.push(`<span class="diag-badge badge-warn">✗ ${failing}</span>`);
  if (stores > 0) badges.push(`<span class="diag-badge">◈ ${stores}</span>`);
  if (a11y > 0) badges.push(`<span class="diag-badge badge-warn">♿ ${a11y}</span>`);
  if (errors > 0) badges.push(`<span class="diag-badge badge-warn">⚠ ${errors}</span>`);
  return badges.length ? `<div class="review-row">${badges.join('')}</div>` : '';
}

function detailSections(item: FeedbackItem): string {
  const sections: string[] = [];
  const t: any = item.triage;
  if (t?.summary) {
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">Auto-Triage</div>${t.summary}${t.reasons?.length ? ` <span style="opacity:.7">(${t.reasons.join('; ')})</span>` : ''}</div>`);
  }

  const longTasks = (item.performanceMetrics || []).filter((m: any) => m.entryType === 'longtask');
  const tbt = longTasks.reduce((s: number, lt: any) => s + Math.max(0, (lt.duration || 0) - 50), 0);
  const shifts = (item.performanceMetrics || []).filter((m: any) => m.entryType === 'layout-shift');
  if (longTasks.length > 0 || shifts.length > 0) {
    const parts: string[] = [];
    if (longTasks.length > 0) parts.push(`${longTasks.length} long task(s), TBT ${Math.round(tbt)}ms`);
    if (shifts.length > 0) parts.push(`${shifts.length} layout shift(s)`);
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">Performance</div>${parts.join(' · ')}</div>`);
  }

  const failing = (item.networkRequests || []).filter((r: any) => r.isError || (r.status && r.status >= 400));
  if (failing.length > 0) {
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">Network Failures</div>${failing.map((r: any) => `<code>${r.method} ${r.url}</code> → ${r.status ?? 'ERR'}`).join('<br>')}</div>`);
  }

  const issues: any[] = item.a11yIssues || [];
  if (issues.length > 0) {
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">A11y (WCAG)</div>${issues.slice(0, 4).map((i: any) => `${i.type} (${i.wcag})`).join(', ')}${issues.length > 4 ? ` +${issues.length - 4}` : ''}</div>`);
  }

  const errors: any[] = item.errorTrace || [];
  if (errors.length > 0) {
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">Runtime Errors</div>${errors.map((e: any) => {
      const first = (e.stack || [])[0];
      return `<code>${e.name}</code>: ${e.message}${first ? ` @ ${first.fn} ${first.file}:${first.line}` : ''}`;
    }).join('<br>')}</div>`);
  }

  const ss: any = item.stateSnapshot;
  if (ss?.detected?.length) {
    sections.push(`<div class="detail-sec"><div class="detail-sec-title">State</div>${ss.detected.join(', ')}<br><code>${JSON.stringify(ss.snapshot).slice(0, 180)}</code></div>`);
  }

  return sections.join('');
}

async function renderReview() {
  if (!currentTabUrl) {
    setHTML(reviewMeta, 'Open a webpage, then click the Pinmark icon.');
    setHTML(reviewList, '');
    return;
  }
  const items = await getFeedback(currentTabUrl);
  const host = (() => { try { return new URL(currentTabUrl).hostname; } catch { return currentTabUrl; } })();
  setHTML(reviewMeta, `${host} · ${items.length} annotation(s)`);

  if (!items.length) {
    setHTML(reviewList, `<div class="review-empty">No annotations yet.<br>Enable Pinmark and pin something on this page — diagnostics will show up here.</div>`);
    return;
  }

  const sorted = [...items].sort((a, b) => (a.index || 0) - (b.index || 0));
  const html = sorted.map((item) => {
    const selector = item.element?.id ? `#${item.element.id}` : (item.element?.classes?.[0] ? `.${item.element.classes[0]}` : `<${item.element?.tagName || '?'}>`);
    const detailId = `review-detail-${item.id}`;
    const md = formatter.formatItem(item).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<div class="review-item">
      <div class="review-item-head" data-detail="${detailId}">
        <div class="review-item-top">
          <span class="review-idx">#${item.index ?? '?'}</span>
          <span class="review-comment">${item.comment || '(no comment)'}</span>
          ${triageChip(item)}
        </div>
        <span class="review-selector">${selector}</span>
        ${diagnosticBadges(item)}
      </div>
      <div class="review-detail" id="${detailId}" style="display:none">
        ${detailSections(item) || '<span style="opacity:.7">No diagnostics captured for this pin.</span>'}
        <button class="review-copy" data-md="${md}">Copy AI Markdown</button>
      </div>
    </div>`;
  }).join('');
  setHTML(reviewList, html);

  reviewList.querySelectorAll('.review-item-head').forEach((head) => {
    head.addEventListener('click', () => {
      const detail = document.getElementById(head.getAttribute('data-detail') || '') as HTMLElement;
      if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
    });
  });
  reviewList.querySelectorAll('.review-copy').forEach((el) => {
    const btn = el as HTMLButtonElement;
    btn.addEventListener('click', async () => {
      const md = btn.getAttribute('data-md') || '';
      try {
        await navigator.clipboard.writeText(md);
        btn.textContent = 'Copied!'; btn.style.color = '#4ade80';
        setTimeout(() => { btn.textContent = 'Copy AI Markdown'; btn.style.color = ''; }, 1200);
      } catch (e) {
        btn.textContent = 'Copy failed'; btn.style.color = '#f87171';
      }
    });
  });
}

// ── Integrations inputs ───────────────────────────────
autoSyncToggle?.addEventListener('change', async () => {
  await saveSetting('autoSync', autoSyncToggle.checked);
});

mcpEndpointInput?.addEventListener('input', async () => {
  await saveSetting('mcpEndpoint', mcpEndpointInput.value.trim());
});

webhookUrlInput?.addEventListener('input', async () => {
  await saveSetting('webhookUrl', webhookUrlInput.value);
  if (currentTabId) chrome.tabs.sendMessage(currentTabId, { type: 'UPDATE_SETTINGS', settings: { webhookUrl: webhookUrlInput.value } }).catch(() => {});
});

githubTokenInput?.addEventListener('input', async () => {
  await saveSetting('githubToken', githubTokenInput.value);
});

githubRepoInput?.addEventListener('input', async () => {
  await saveSetting('githubRepo', githubRepoInput.value);
});

// ── Copy JSON ─────────────────────────────────────────
copyJsonBtn?.addEventListener('click', () => {
  if (currentTabId !== null && isActive) {
    chrome.tabs.sendMessage(currentTabId, { type: 'COPY_JSON' }).catch(() => {});
    copyJsonBtn.textContent = 'Copied!';
    setTimeout(() => { copyJsonBtn.textContent = 'Copy JSON'; }, 1500);
  }
});

// ── Status helpers ─────────────────────────────────────
function showStatus(msg: string) {
  statusMsg.textContent = msg;
  statusMsg.style.display = 'block';
  setTimeout(hideStatus, 4000);
}
function hideStatus() {
  statusMsg.style.display = 'none';
  statusMsg.textContent = '';
}

// ── Init ──────────────────────────────────────────────
async function init() {
  const settings = await getSettings();
  applyTheme((settings.theme as 'light' | 'dark' | 'auto') || 'auto');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id || null;
  currentTabUrl = tab?.url || '';

  if (currentTabId === null) {
    showStatus('Open a webpage, then click the Pinmark icon.');
    return;
  }

  const response = await sendMessage({ type: 'GET_STATE' }) as { isActive: boolean };
  isActive = response?.isActive || false;
  updateToggleButton();

  const fullSettings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  loadSettings(fullSettings);
}

init();
