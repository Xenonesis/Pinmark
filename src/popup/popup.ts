import type { ExtensionSettings } from '../shared/types';
import { sendMessage } from '../shared/messaging';

let currentTabId: number | null = null;
let isActive = false;

const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
const btnText = toggleBtn?.querySelector('.btn-text') as HTMLElement;

const settingsInputs = {
  markerColor: document.getElementById('markerColor') as HTMLInputElement,
  outputDetail: document.getElementById('outputDetail') as HTMLSelectElement,
  theme: document.getElementById('theme') as HTMLSelectElement,
  clearAfterCopy: document.getElementById('clearAfterCopy') as HTMLInputElement,
  blockInteractions: document.getElementById('blockInteractions') as HTMLInputElement,
};

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id || null;

  if (currentTabId === null) return;

  const response = await sendMessage({ type: 'GET_STATE', tabId: currentTabId }) as { isActive: boolean };
  isActive = response.isActive;
  updateToggleButton();

  const settings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  loadSettings(settings);
}

function updateToggleButton() {
  if (isActive) {
    toggleBtn?.classList.add('active');
    if (btnText) btnText.textContent = 'Deactivate';
  } else {
    toggleBtn?.classList.remove('active');
    if (btnText) btnText.textContent = 'Activate';
  }
}

function loadSettings(settings: ExtensionSettings) {
  if (settingsInputs.markerColor) settingsInputs.markerColor.value = settings.markerColor;
  if (settingsInputs.outputDetail) settingsInputs.outputDetail.value = settings.outputDetail;
  if (settingsInputs.theme) settingsInputs.theme.value = settings.theme;
  if (settingsInputs.clearAfterCopy) settingsInputs.clearAfterCopy.checked = settings.clearAfterCopy;
  if (settingsInputs.blockInteractions) settingsInputs.blockInteractions.checked = settings.blockInteractions;
}

async function saveSetting(key: keyof ExtensionSettings, value: unknown) {
  await sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { [key]: value },
  });
}

toggleBtn?.addEventListener('click', async () => {
  if (currentTabId === null) return;

  const response = await sendMessage({ type: 'TOGGLE_EXTENSION', tabId: currentTabId }) as { isActive: boolean };
  isActive = response.isActive;
  updateToggleButton();

  if (isActive) {
    chrome.tabs.sendMessage(currentTabId, { type: 'ACTIVATE_OVERLAY' });
  } else {
    chrome.tabs.sendMessage(currentTabId, { type: 'DEACTIVATE_OVERLAY' });
  }
});

settingsInputs.markerColor?.addEventListener('input', async (e) => {
  await saveSetting('markerColor', (e.target as HTMLInputElement).value);
});

settingsInputs.outputDetail?.addEventListener('change', async (e) => {
  await saveSetting('outputDetail', (e.target as HTMLSelectElement).value);
});

settingsInputs.theme?.addEventListener('change', async (e) => {
  await saveSetting('theme', (e.target as HTMLSelectElement).value);
});

settingsInputs.clearAfterCopy?.addEventListener('change', async (e) => {
  await saveSetting('clearAfterCopy', (e.target as HTMLInputElement).checked);
});

settingsInputs.blockInteractions?.addEventListener('change', async (e) => {
  await saveSetting('blockInteractions', (e.target as HTMLInputElement).checked);
});

init();
