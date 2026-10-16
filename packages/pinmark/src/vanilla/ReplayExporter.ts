import { escapeHTML } from './domUtils.js';

interface ReplayEventLike {
  type?: number;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
}

interface NetworkRequestLike {
  url?: string;
  method?: string;
  status?: number;
  timestamp?: number;
  duration?: number;
  isError?: boolean;
  [key: string]: unknown;
}

interface ConsoleLogLike {
  type?: string;
  message?: string;
  timestamp?: number;
  time?: number;
  args?: unknown[];
  [key: string]: unknown;
}

export interface ReplayAnnotationLike {
  id?: string;
  index?: number;
  comment?: string;
  url?: string;
  timestamp?: number;
  sessionReplayEvents?: ReplayEventLike[];
  networkRequests?: NetworkRequestLike[];
  consoleLogs?: ConsoleLogLike[];
  [key: string]: unknown;
}

function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function generateStandaloneReplayHtml(annotation: ReplayAnnotationLike | unknown): string {
  const ann = (annotation && typeof annotation === 'object' ? annotation : {}) as ReplayAnnotationLike;

  const events: ReplayEventLike[] = Array.isArray(ann.sessionReplayEvents)
    ? ann.sessionReplayEvents
    : [];

  const networkRequests: NetworkRequestLike[] = Array.isArray(ann.networkRequests)
    ? ann.networkRequests
    : [];

  const consoleLogs: ConsoleLogLike[] = Array.isArray(ann.consoleLogs)
    ? ann.consoleLogs
    : [];

  const firstTimestamp = events.length > 0 ? (events[0].timestamp || 0) : 0;
  const lastTimestamp = events.length > 1 ? (events[events.length - 1].timestamp || 0) : firstTimestamp;
  const totalDurationMs = Math.max(0, lastTimestamp - firstTimestamp);
  const durationLabel = formatDuration(totalDurationMs);

  // Combine network and console logs into sorted activity list
  type ActivityItem = {
    kind: 'network' | 'console';
    timestamp: number;
    offsetMs: number;
    title: string;
    detail: string;
    isError: boolean;
    statusBadge?: string;
  };

  const activityList: ActivityItem[] = [];

  for (const req of networkRequests) {
    const ts = typeof req.timestamp === 'number' ? req.timestamp : (ann.timestamp || 0);
    const offset = firstTimestamp > 0 ? Math.max(0, ts - firstTimestamp) : 0;
    const isErr = Boolean(req.isError || (typeof req.status === 'number' && req.status >= 400));
    activityList.push({
      kind: 'network',
      timestamp: ts,
      offsetMs: offset,
      title: `${req.method || 'GET'} ${req.url || ''}`,
      detail: req.status ? `Status: ${req.status}` : 'Pending/Completed',
      isError: isErr,
      statusBadge: req.status ? String(req.status) : (req.method || 'NET'),
    });
  }

  for (const log of consoleLogs) {
    const ts = typeof log.timestamp === 'number'
      ? log.timestamp
      : (typeof log.time === 'number' ? log.time : (ann.timestamp || 0));
    const offset = firstTimestamp > 0 ? Math.max(0, ts - firstTimestamp) : 0;
    const logType = log.type || 'log';
    const isErr = logType === 'error';
    const msg = log.message || (Array.isArray(log.args) ? log.args.join(' ') : JSON.stringify(log));
    activityList.push({
      kind: 'console',
      timestamp: ts,
      offsetMs: offset,
      title: `console.${logType}`,
      detail: msg,
      isError: isErr,
      statusBadge: logType.toUpperCase(),
    });
  }

  activityList.sort((a, b) => a.timestamp - b.timestamp);

  const safeAnnotationJson = safeJsonStringify(ann);

  const annotationIndex = ann.index !== undefined ? `#${ann.index}` : 'Pin';
  const annotationId = ann.id ? String(ann.id) : 'Replay';
  const commentText = ann.comment || 'No comment provided';
  const targetUrl = ann.url || '';
  const dateString = ann.timestamp
    ? new Date(ann.timestamp).toLocaleString()
    : 'Unknown time';

  const activityHtml = activityList.length === 0
    ? '<div class="pinmark-empty-rail">No network or console diagnostics recorded.</div>'
    : activityList.map((item, idx) => {
        const offsetLabel = `+${(item.offsetMs / 1000).toFixed(1)}s`;
        const itemClass = `pinmark-activity-item ${item.isError ? 'pinmark-is-error' : ''} pinmark-kind-${item.kind}`;
        return `
          <div class="${itemClass}" data-offset="${item.offsetMs}" data-index="${idx}" title="Click to seek">
            <div class="pinmark-activity-header">
              <span class="pinmark-badge ${item.isError ? 'pinmark-badge-error' : 'pinmark-badge-neutral'}">${escapeHTML(item.statusBadge || item.kind)}</span>
              <span class="pinmark-activity-title" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span>
              <span class="pinmark-activity-offset">${offsetLabel}</span>
            </div>
            <div class="pinmark-activity-detail">${escapeHTML(item.detail)}</div>
          </div>
        `;
      }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pinmark Replay - ${escapeHTML(annotationId)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/rrweb@2.1.1/dist/rrweb.min.css" />
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .brand-pill {
      background: #6366f1;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .index-pill {
      background: #27272a;
      color: #f4f4f5;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #3f3f46;
    }
    .annotation-comment {
      font-size: 14px;
      font-weight: 600;
      color: #fafafa;
    }
    .annotation-url {
      font-size: 12px;
      color: #a1a1aa;
      text-decoration: none;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .annotation-url:hover {
      color: #818cf8;
      text-decoration: underline;
    }
    .header-meta {
      font-size: 12px;
      color: #71717a;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .main-container {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 380px;
      min-height: 0;
      height: calc(100vh - 65px);
    }
    @media (max-width: 900px) {
      .main-container {
        grid-template-columns: 1fr;
        height: auto;
      }
    }
    .player-section {
      display: flex;
      flex-direction: column;
      background: #09090b;
      min-width: 0;
      position: relative;
    }
    #pinmark-player-viewport {
      flex: 1;
      position: relative;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      min-height: 480px;
    }
    #pinmark-player-viewport .replayer-wrapper {
      transform-origin: center center;
    }
    .player-controls {
      background: #18181b;
      border-top: 1px solid #27272a;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-icon {
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #f4f4f5;
      border-radius: 6px;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.15s ease;
      user-select: none;
    }
    .btn-icon:hover {
      background: #3f3f46;
      border-color: #52525b;
    }
    .btn-icon:active {
      transform: scale(0.96);
    }
    #pinmark-scrubber {
      flex: 1;
      accent-color: #6366f1;
      height: 6px;
      cursor: pointer;
    }
    #pinmark-time {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: #a1a1aa;
      min-width: 105px;
      text-align: center;
      font-family: monospace;
    }
    .speed-group {
      display: flex;
      gap: 4px;
      background: #27272a;
      padding: 2px;
      border-radius: 6px;
    }
    .pinmark-speed-btn {
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pinmark-speed-btn:hover {
      color: #ffffff;
    }
    .pinmark-speed-btn.active {
      background: #6366f1;
      color: #ffffff;
    }
    .rail-section {
      background: #18181b;
      border-left: 1px solid #27272a;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .rail-header {
      padding: 14px 18px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rail-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      color: #d4d4d8;
    }
    .rail-count {
      font-size: 11px;
      background: #27272a;
      color: #a1a1aa;
      padding: 2px 7px;
      border-radius: 10px;
    }
    .rail-content {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
    }
    .pinmark-empty-rail {
      color: #71717a;
      font-size: 13px;
      text-align: center;
      padding: 40px 10px;
    }
    .pinmark-activity-item {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pinmark-activity-item:hover {
      border-color: #3f3f46;
      background: #141418;
    }
    .pinmark-activity-item.active-activity {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.12);
      box-shadow: 0 0 0 1px #6366f1;
    }
    .pinmark-activity-item.pinmark-is-error {
      border-left: 3px solid #ef4444;
    }
    .pinmark-activity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .pinmark-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: monospace;
    }
    .pinmark-badge-neutral {
      background: #27272a;
      color: #a1a1aa;
    }
    .pinmark-badge-error {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .pinmark-activity-title {
      font-size: 12px;
      font-weight: 600;
      color: #f4f4f5;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pinmark-activity-offset {
      font-size: 11px;
      color: #71717a;
      font-family: monospace;
      white-space: nowrap;
    }
    .pinmark-activity-detail {
      font-size: 11px;
      color: #a1a1aa;
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 48px;
      overflow: hidden;
    }
    .pinmark-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
      color: #a1a1aa;
    }
    .pinmark-placeholder h3 {
      color: #f4f4f5;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <span class="brand-pill">Pinmark Replay</span>
      <span class="index-pill">${escapeHTML(annotationIndex)}</span>
      <span class="annotation-comment">${escapeHTML(commentText)}</span>
      ${targetUrl ? `<a class="annotation-url" href="${escapeHTML(targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(targetUrl)}</a>` : ''}
    </div>
    <div class="header-meta">
      <span>${escapeHTML(annotationId)}</span>
      <span>${escapeHTML(dateString)}</span>
    </div>
  </header>

  <div class="main-container">
    <section class="player-section">
      <div id="pinmark-player-viewport"></div>
      <div class="player-controls">
        <button id="pinmark-restart" class="btn-icon" title="Restart (Home)">⏮</button>
        <button id="pinmark-play-pause" class="btn-icon" title="Play/Pause (Space)">▶</button>
        <input type="range" id="pinmark-scrubber" min="0" value="0" step="10" />
        <span id="pinmark-time">00:00 / ${durationLabel}</span>
        <div class="speed-group">
          <button class="pinmark-speed-btn active" data-speed="1">1x</button>
          <button class="pinmark-speed-btn" data-speed="1.5">1.5x</button>
          <button class="pinmark-speed-btn" data-speed="2">2x</button>
        </div>
      </div>
    </section>

    <aside class="rail-section">
      <div class="rail-header">
        <span class="rail-title">Diagnostic Activity</span>
        <span class="rail-count">${activityList.length} items</span>
      </div>
      <div class="rail-content">
        ${activityHtml}
      </div>
    </aside>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/rrweb@2.1.1/dist/rrweb.min.js"></script>
  <script>
    (function() {
      const annotation = ${safeAnnotationJson};
      const events = Array.isArray(annotation.sessionReplayEvents) ? annotation.sessionReplayEvents : [];
      const viewportEl = document.getElementById('pinmark-player-viewport');
      const playPauseBtn = document.getElementById('pinmark-play-pause');
      const restartBtn = document.getElementById('pinmark-restart');
      const scrubber = document.getElementById('pinmark-scrubber');
      const timeLabel = document.getElementById('pinmark-time');
      const speedBtns = document.querySelectorAll('.pinmark-speed-btn');
      const activityItems = document.querySelectorAll('.pinmark-activity-item');

      function formatTime(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      }

      if (!events || events.length < 2) {
        if (viewportEl) {
          viewportEl.innerHTML = '<div class="pinmark-placeholder"><h3>No Replay Recorded</h3><p>This annotation does not contain recorded DOM mutation events.</p></div>';
        }
        return;
      }

      const firstTimestamp = events[0].timestamp || 0;
      const lastTimestamp = events[events.length - 1].timestamp || firstTimestamp;
      const totalDuration = Math.max(0, lastTimestamp - firstTimestamp);

      if (scrubber) {
        scrubber.max = totalDuration;
        scrubber.value = 0;
      }
      if (timeLabel) {
        timeLabel.textContent = '00:00 / ' + formatTime(totalDuration);
      }

      if (typeof rrweb === 'undefined' || !rrweb.Replayer) {
        if (viewportEl) {
          viewportEl.innerHTML = '<div class="pinmark-placeholder"><h3 style="color:#ef4444;">rrweb.Replayer Unavailable</h3><p>Could not load rrweb bundle from CDN. Check your network connection.</p></div>';
        }
        return;
      }

      let currentSpeed = 1;
      let isPlaying = false;
      let animFrameId = null;

      let replayer = null;
      try {
        replayer = new rrweb.Replayer(events, {
          root: viewportEl,
          mouseTail: true,
          speed: currentSpeed,
          autoPlay: false,
          showWarning: false,
          showDebug: false
        });
      } catch (err) {
        if (viewportEl) {
          viewportEl.innerHTML = '<div class="pinmark-placeholder"><h3 style="color:#ef4444;">Playback Initialization Failed</h3><p>' + (err && err.message ? err.message : String(err)) + '</p></div>';
        }
        return;
      }

      function highlightActivity(offsetMs) {
        activityItems.forEach(function(item) {
          const itemOffset = Number(item.getAttribute('data-offset') || 0);
          if (Math.abs(itemOffset - offsetMs) < 1200) {
            item.classList.add('active-activity');
          } else {
            item.classList.remove('active-activity');
          }
        });
      }

      function updateLoop() {
        if (!isPlaying || !replayer) return;
        const current = replayer.getCurrentTime();
        if (scrubber) scrubber.value = current;
        if (timeLabel) timeLabel.textContent = formatTime(current) + ' / ' + formatTime(totalDuration);
        highlightActivity(current);

        if (current >= totalDuration) {
          isPlaying = false;
          if (playPauseBtn) playPauseBtn.textContent = '▶';
        } else {
          animFrameId = requestAnimationFrame(updateLoop);
        }
      }

      function play() {
        if (!replayer) return;
        const currentVal = Number(scrubber ? scrubber.value : 0);
        if (currentVal >= totalDuration) {
          replayer.play(0);
        } else {
          replayer.play(currentVal);
        }
        isPlaying = true;
        if (playPauseBtn) playPauseBtn.textContent = '⏸';
        cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(updateLoop);
      }

      function pause() {
        if (!replayer) return;
        replayer.pause();
        isPlaying = false;
        if (playPauseBtn) playPauseBtn.textContent = '▶';
        cancelAnimationFrame(animFrameId);
      }

      if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function() {
          if (isPlaying) {
            pause();
          } else {
            play();
          }
        });
      }

      if (restartBtn) {
        restartBtn.addEventListener('click', function() {
          pause();
          if (replayer) {
            replayer.play(0);
            replayer.pause();
          }
          if (scrubber) scrubber.value = 0;
          if (timeLabel) timeLabel.textContent = '00:00 / ' + formatTime(totalDuration);
          highlightActivity(0);
        });
      }

      if (scrubber) {
        scrubber.addEventListener('input', function() {
          const target = Number(scrubber.value);
          if (timeLabel) timeLabel.textContent = formatTime(target) + ' / ' + formatTime(totalDuration);
          highlightActivity(target);
          if (replayer) {
            replayer.pause(target);
          }
          isPlaying = false;
          if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
      }

      speedBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          speedBtns.forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          currentSpeed = Number(btn.getAttribute('data-speed') || 1);
          if (replayer && typeof replayer.setConfig === 'function') {
            replayer.setConfig({ speed: currentSpeed });
          }
        });
      });

      activityItems.forEach(function(item) {
        item.addEventListener('click', function() {
          const offset = Number(item.getAttribute('data-offset') || 0);
          if (scrubber) scrubber.value = offset;
          if (timeLabel) timeLabel.textContent = formatTime(offset) + ' / ' + formatTime(totalDuration);
          highlightActivity(offset);
          if (replayer) {
            replayer.pause(offset);
          }
          isPlaying = false;
          if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
      });

      document.addEventListener('keydown', function(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Space') {
          e.preventDefault();
          if (isPlaying) pause(); else play();
        }
      });
    })();
  </script>
</body>
</html>`;
}
