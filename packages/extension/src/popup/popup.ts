import type { ExtensionSettings } from '../shared/types';
import { sendMessage } from '../shared/messaging';
import { ThemeProvider, type ThemeStorage, type ThemeMode } from '../shared/theme-provider';
import { getSettings, saveSettings } from '../shared/storage';

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
  githubToken: document.getElementById('githubToken') as HTMLInputElement,
  githubRepo: document.getElementById('githubRepo') as HTMLInputElement,
  webhookUrl: document.getElementById('webhookUrl') as HTMLInputElement,
};

// Theme adapter backed by the ExtensionSettings.theme field (keeps it in
// sync with the rest of the extension's settings).
const settingsThemeStorage: ThemeStorage = {
  async get() {
    const s = await getSettings();
    const t = s.theme;
    return t === 'light' || t === 'dark' || t === 'auto' ? t : null;
  },
  async set(mode: ThemeMode) {
    await saveSettings({ theme: mode });
  },
};

const theme = new ThemeProvider({
  storage: settingsThemeStorage,
});

async function init() {
  await theme.init();
  if (settingsInputs.theme) settingsInputs.theme.value = theme.mode;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id || null;

  if (currentTabId === null) {
    const status = document.getElementById('statusMsg');
    if (status) {
      status.textContent = '⚠ Open a webpage first, then click the Pinmark icon to annotate.';
      status.style.display = 'block';
    }
    return;
  }

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
  if (settingsInputs.githubToken) settingsInputs.githubToken.value = settings.githubToken || '';
  if (settingsInputs.githubRepo) settingsInputs.githubRepo.value = settings.githubRepo || '';
  if (settingsInputs.webhookUrl) settingsInputs.webhookUrl.value = settings.webhookUrl || '';
}

async function saveSetting(key: keyof ExtensionSettings, value: unknown) {
  await sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { [key]: value },
  });
  // Relay to the active tab's content script so overlay settings
  // (clearAfterCopy, blockInteractions, markerColor) take effect immediately.
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      type: 'UPDATE_SETTINGS',
      settings: { [key]: value },
    }).catch(() => {
      // content script may not be loaded yet — ignore
    });
  }
}

toggleBtn?.addEventListener('click', async () => {
  if (currentTabId === null) {
    const status = document.getElementById('statusMsg');
    if (status) {
      status.textContent = '⚠ No active tab detected. Try clicking the extension icon while on a webpage.';
      status.style.display = 'block';
    }
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
      } catch (msgError) {
        // Content script not reachable — revert state and warn the user
        await sendMessage({ type: 'TOGGLE_EXTENSION', tabId: currentTabId });
        isActive = false;
        updateToggleButton();
        const status = document.getElementById('statusMsg');
        if (status) {
          status.textContent = '⚠ Could not activate — try refreshing the page or enabling file:// access in chrome://extensions';
          status.style.display = 'block';
          setTimeout(() => { status.style.display = 'none'; }, 5000);
        }
        return;
      }
      // Clear any previous error
      const status = document.getElementById('statusMsg');
      if (status) { status.style.display = 'none'; status.textContent = ''; }
    } else {
      chrome.tabs.sendMessage(currentTabId, { type: 'DEACTIVATE_OVERLAY' }).catch(() => {});
    }
  } catch (bgError) {
    // Background not reachable
    isActive = prevState;
    updateToggleButton();
    console.error('Toggle failed:', bgError);
  }
});

const copyJsonBtn = document.getElementById('copyJsonBtn') as HTMLButtonElement;
copyJsonBtn?.addEventListener('click', async () => {
  if (currentTabId !== null && isActive) {
    chrome.tabs.sendMessage(currentTabId, { type: 'COPY_JSON' }).catch(() => {});
    const btnTextSpan = copyJsonBtn.querySelector('.btn-text');
    if (btnTextSpan) {
      btnTextSpan.textContent = 'Copied!';
      copyJsonBtn.style.background = 'var(--pmk-success, #22c55e)';
      copyJsonBtn.style.color = 'white';
      setTimeout(() => {
        btnTextSpan.textContent = 'Copy JSON';
        copyJsonBtn.style.background = 'var(--pmk-bg-3)';
        copyJsonBtn.style.color = 'var(--pmk-text)';
      }, 1500);
    }
  }
});

settingsInputs.markerColor?.addEventListener('input', async (e) => {
  await saveSetting('markerColor', (e.target as HTMLInputElement).value);
});

settingsInputs.outputDetail?.addEventListener('change', async (e) => {
  await saveSetting('outputDetail', (e.target as HTMLSelectElement).value);
});

settingsInputs.theme?.addEventListener('change', async (e) => {
  const mode = (e.target as HTMLSelectElement).value as ThemeMode;
  await theme.set(mode);
});

settingsInputs.clearAfterCopy?.addEventListener('change', async (e) => {
  await saveSetting('clearAfterCopy', (e.target as HTMLInputElement).checked);
});

settingsInputs.blockInteractions?.addEventListener('change', async (e) => {
  await saveSetting('blockInteractions', (e.target as HTMLInputElement).checked);
});

settingsInputs.githubToken?.addEventListener('input', async (e) => {
  await saveSetting('githubToken', (e.target as HTMLInputElement).value);
});

settingsInputs.githubRepo?.addEventListener('input', async (e) => {
  await saveSetting('githubRepo', (e.target as HTMLInputElement).value);
});

settingsInputs.webhookUrl?.addEventListener('input', async (e) => {
  await saveSetting('webhookUrl', (e.target as HTMLInputElement).value);
});

init();
