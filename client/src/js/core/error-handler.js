/**
 * Global error handler — catches uncaught errors and unhandled rejections,
 * shows a user-friendly VR overlay with retry, and handles WebXR session loss.
 */

let _overlayShown = false;

function showErrorOverlay(message) {
  if (_overlayShown) return;
  _overlayShown = true;

  const overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.85); display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    color: #fff; font-family: monospace; text-align: center; padding: 20px;
  `;
  overlay.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 12px; color: #ff4444;">Something went wrong</div>
    <div style="font-size: 14px; margin-bottom: 20px; opacity: 0.7; max-width: 400px;">${message || 'An unexpected error occurred.'}</div>
    <button id="error-retry" style="
      padding: 12px 32px; font-size: 16px; border: 2px solid #00ff88;
      background: transparent; color: #00ff88; border-radius: 8px;
      cursor: pointer; font-family: monospace;
    ">Tap to Retry</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('error-retry').addEventListener('click', () => {
    window.location.reload();
  });
}

function showOfflineIndicator() {
  if (document.getElementById('offline-indicator')) return;
  const el = document.createElement('div');
  el.id = 'offline-indicator';
  el.style.cssText = `
    position: fixed; top: 8px; right: 8px; z-index: 99998;
    background: #ff8800; color: #000; padding: 4px 12px;
    border-radius: 4px; font-size: 12px; font-family: monospace;
  `;
  el.textContent = 'Offline Mode';
  document.body.appendChild(el);
}

function hideOfflineIndicator() {
  document.getElementById('offline-indicator')?.remove();
}

function init() {
  // Global error handler
  window.onerror = (msg, src, line, col, err) => {
    console.error('[ErrorHandler]', msg, src, line, col, err);
    // Don't show overlay for minor script errors from extensions
    if (src && !src.includes(location.hostname)) return;
    showErrorOverlay(String(msg).substring(0, 200));
  };

  // Unhandled promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ErrorHandler] Unhandled rejection:', event.reason);
    // Only show overlay for critical failures
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes('Firebase') || msg.includes('auth') || msg.includes('network')) {
      showOfflineIndicator();
    }
  });

  // WebXR session loss recovery
  const scene = document.getElementById('scene') || document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('exit-vr', () => {
      // Check if it was unexpected (not user-initiated)
      const xr = scene.renderer?.xr;
      if (xr && !xr.isPresenting) {
        console.warn('[ErrorHandler] VR session ended unexpectedly');
      }
    });
  }

  // Online/offline detection
  window.addEventListener('offline', showOfflineIndicator);
  window.addEventListener('online', hideOfflineIndicator);
  if (!navigator.onLine) showOfflineIndicator();

  // Audio context blocked handling
  document.addEventListener('click', () => {
    const ctx = window.__audioContext || (window.AudioContext && new AudioContext());
    if (ctx?.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }, { once: true });
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init, showErrorOverlay, showOfflineIndicator };
