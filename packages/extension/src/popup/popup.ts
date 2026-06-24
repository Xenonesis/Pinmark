import type { ExtensionSettings } from '../shared/types';
import { sendMessage } from '../shared/messaging';
import { getSettings, saveSettings } from '../shared/storage';

let currentTabId: number | null = null;
let isActive = false;

// ── DOM refs ──────────────────────────────────────────
const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
const activateLabel = toggleBtn?.querySelector('.activate-label') as HTMLElement;
const activateShortcut = toggleBtn?.querySelector('.activate-shortcut') as HTMLElement;
const statusMsg = document.getElementById('statusMsg') as HTMLElement;

const outputDetailLabel = document.getElementById('outputDetailLabel') as HTMLElement;
const outputDetailSelect = document.getElementById('outputDetail') as HTMLSelectElement;
const outputDetailTrigger = document.getElementById('outputDetailTrigger') as HTMLButtonElement;

const blockInteractionsToggle = document.getElementById('blockInteractions') as HTMLInputElement;
const reactComponentsToggle = document.getElementById('reactComponents') as HTMLInputElement;
const clearAfterCopyCheckbox = document.getElementById('clearAfterCopy') as HTMLInputElement;
const markerColorInput = document.getElementById('markerColor') as HTMLInputElement;
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;

const swatches = document.querySelectorAll('.swatch[data-color]') as NodeListOf<HTMLButtonElement>;

const openAdvancedBtn = document.getElementById('openAdvanced') as HTMLButtonElement;
const closeAdvancedBtn = document.getElementById('closeAdvanced') as HTMLButtonElement;
const mainCard = document.querySelector('.card:not(.advanced-panel)') as HTMLElement;
const advancedPanel = document.getElementById('advancedPanel') as HTMLElement;

const webhookUrlInput = document.getElementById('webhookUrl') as HTMLInputElement;
const githubTokenInput = document.getElementById('githubToken') as HTMLInputElement;
const githubRepoInput = document.getElementById('githubRepo') as HTMLInputElement;
const copyJsonBtn = document.getElementById('copyJsonBtn') as HTMLButtonElement;

// ── Theme ─────────────────────────────────────────────
let isDark = true;

async function applyTheme(theme: 'light' | 'dark' | 'auto') {
  if (theme === 'auto') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    isDark = theme === 'dark';
  }
  document.body.style.background = isDark ? 'transparent' : '#f0f0f0';
  const cards = document.querySelectorAll('.card');
  cards.forEach(c => {
    (c as HTMLElement).style.background = isDark ? '#1a1a1a' : '#ffffff';
    (c as HTMLElement).style.color = isDark ? '#e0e0e0' : '#111';
  });
}

// ── Update toggle button state ─────────────────────────
function updateToggleButton() {
  if (isActive) {
    toggleBtn.classList.add('active');
    activateLabel.textContent = 'Deactivate';
    if (activateShortcut) activateShortcut.textContent = 'on';
  } else {
    toggleBtn.classList.remove('active');
    activateLabel.textContent = 'Activate';
    if (activateShortcut) activateShortcut.textContent = 'off';
  }
}

// ── Load settings into UI ─────────────────────────────
function loadSettings(settings: ExtensionSettings) {
  if (outputDetailSelect) {
    outputDetailSelect.value = settings.outputDetail;
    if (outputDetailLabel) {
      const map: Record<string, string> = { minimal: 'Minimal', standard: 'Standard', comprehensive: 'Detailed' };
      outputDetailLabel.textContent = map[settings.outputDetail] || 'Standard';
    }
  }
  if (blockInteractionsToggle) blockInteractionsToggle.checked = settings.blockInteractions;
  if (clearAfterCopyCheckbox) clearAfterCopyCheckbox.checked = settings.clearAfterCopy;

  // Marker color
  const color = settings.markerColor || '#d63031';
  markerColorInput.value = color;
  updateSwatchSelection(color);

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
    { value: 'minimal', label: 'Minimal' },
    { value: 'standard', label: 'Standard' },
    { value: 'comprehensive', label: 'Detailed' },
  ];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.textContent = opt.label;
    if (outputDetailSelect.value === opt.value) btn.classList.add('active');
    btn.onclick = async () => {
      outputDetailSelect.value = opt.value;
      if (outputDetailLabel) outputDetailLabel.textContent = opt.label;
      await saveSetting('outputDetail', opt.value as 'minimal' | 'standard' | 'comprehensive');
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
toggleBtn?.addEventListener('click', async () => {
  if (currentTabId === null) {
    showStatus('No active tab. Open a webpage first.');
    return;
  }

  const prevState = isActive;
  try {
    const response = await sendMessage({ type: 'TOGGLE_EXTENSION', tabId: currentTabId }) as { isActive: boolean };
    isActive = response.isActive;
    updateToggleButton();

    if (isActive) {
      try {
        await chrome.tabs.sendMessage(currentTabId, { type: 'ACTIVATE_OVERLAY' });
        hideStatus();
      } catch {
        await sendMessage({ type: 'TOGGLE_EXTENSION', tabId: currentTabId });
        isActive = false;
        updateToggleButton();
        showStatus('Could not activate — try refreshing the page.');
      }
    } else {
      chrome.tabs.sendMessage(currentTabId, { type: 'DEACTIVATE_OVERLAY' }).catch(() => {});
    }
  } catch {
    isActive = prevState;
    updateToggleButton();
  }
});

// ── Advanced Panel ─────────────────────────────────────
openAdvancedBtn?.addEventListener('click', () => {
  mainCard.style.display = 'none';
  advancedPanel.style.display = '';
});

closeAdvancedBtn?.addEventListener('click', () => {
  advancedPanel.style.display = 'none';
  mainCard.style.display = '';
});

// ── Integrations inputs ───────────────────────────────
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

  if (currentTabId === null) {
    showStatus('Open a webpage, then click the Pinmark icon.');
    return;
  }

  const response = await sendMessage({ type: 'GET_STATE', tabId: currentTabId }) as { isActive: boolean };
  isActive = response?.isActive || false;
  updateToggleButton();

  const fullSettings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  loadSettings(fullSettings);
}

init();
