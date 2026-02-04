/**
 * VR Core Framework - Shared utilities for Quest TWA VR games
 * Usage: <script src="/framework/vr-core.js"></script>
 */
window.VRCore = (function() {
  'use strict';

  /** @type {boolean|null} Cached Quest detection result */
  var _isQuestCached = null;

  /** @type {number} Current refresh rate (default 90Hz for Quest 2/3) */
  var _currentRefreshRate = 90;

  /** @type {XRSession|null} Active XR session reference for runtime rate changes */
  var _activeXRSession = null;

  /**
   * Detect if running on Meta Quest device.
   * Checks userAgent for Quest identifiers.
   * @returns {boolean} True if on Quest device
   */
  function isQuest() {
    if (_isQuestCached !== null) return _isQuestCached;
    var ua = navigator.userAgent || '';
    _isQuestCached = /Quest/.test(ua) || /OculusBrowser/.test(ua);
    return _isQuestCached;
  }

  /**
   * Create and manage a loading screen.
   * @param {Object} opts
   * @param {string} opts.title - Game title HTML (e.g. "MY GAME<span>VR</span>")
   * @param {string} opts.titleColor - Title color (default: #5af)
   * @param {string} opts.accentColor - Accent/bar color (default: #a855f7)
   * @param {string[]} opts.tips - Array of loading tips (optional)
   * @param {number} opts.timeout - Max loading time in ms (default: 8000)
   */
  function loadingScreen(opts) {
    opts = opts || {};
    var titleColor = opts.titleColor || '#5af';
    var accentColor = opts.accentColor || '#a855f7';
    var barGradient = 'linear-gradient(90deg, ' + titleColor + ', ' + accentColor + ')';

    var screen = document.createElement('div');
    screen.id = 'loading-screen';
    screen.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#0a0a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:monospace;transition:opacity 0.4s';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:28px;margin-bottom:16px;color:' + titleColor;
    title.innerHTML = opts.title || 'VR GAME';
    screen.appendChild(title);

    var track = document.createElement('div');
    track.style.cssText = 'width:120px;height:3px;background:#222;border-radius:2px;overflow:hidden';
    var bar = document.createElement('div');
    bar.id = 'loading-bar';
    bar.style.cssText = 'width:0%;height:100%;background:' + barGradient + ';transition:width 0.3s';
    track.appendChild(bar);
    screen.appendChild(track);

    if (opts.tips && opts.tips.length) {
      var tip = document.createElement('div');
      tip.style.cssText = 'font-size:13px;opacity:0.6;margin-top:12px;max-width:300px;text-align:center';
      tip.textContent = opts.tips[Math.floor(Math.random() * opts.tips.length)];
      screen.appendChild(tip);
    }

    document.body.insertBefore(screen, document.body.firstChild);

    // Animate progress bar
    var p = 0;
    var iv = setInterval(function() {
      p = Math.min(p + Math.random() * 15, 90);
      bar.style.width = p + '%';
    }, 300);

    function dismiss() {
      clearInterval(iv);
      bar.style.width = '100%';
      setTimeout(function() {
        screen.style.opacity = '0';
        setTimeout(function() { screen.remove(); }, 400);
      }, 200);
    }

    var sc = document.querySelector('a-scene');
    if (sc) {
      if (sc.hasLoaded) dismiss();
      else sc.addEventListener('loaded', dismiss);
    } else {
      window.addEventListener('load', dismiss);
    }
    setTimeout(dismiss, opts.timeout || 8000);
  }

  /**
   * Auto-enter VR mode when on Quest TWA.
   * Call after scene 'loaded' event.
   * @param {HTMLElement} sceneEl - The a-scene element
   */
  function autoEnterVR(sceneEl) {
    if (!sceneEl) sceneEl = document.getElementById('scene');
    if (!sceneEl) return;

    function tryEnter() {
      if (navigator.xr && sceneEl.enterVR) {
        navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
          if (supported && !sceneEl.is('vr-mode')) sceneEl.enterVR();
        }).catch(function() {});
      }
    }

    if (sceneEl.hasLoaded) tryEnter();
    else sceneEl.addEventListener('loaded', tryEnter);
  }

  /**
   * Clear all service workers and caches.
   * Important for TWA to avoid stale content.
   */
  function clearServiceWorkers() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister(); });
      });
      caches.keys().then(function(names) {
        names.forEach(function(n) { caches.delete(n); });
      });
    }
  }

  /**
   * Pre-warm shaders by rendering a hidden frame.
   * Prevents frame drops from shader compilation on first visible frame.
   * @param {THREE.WebGLRenderer} renderer - Three.js renderer
   * @param {THREE.Scene} scene3D - Three.js scene
   * @param {THREE.Camera} camera - Three.js camera
   */
  function prewarmShaders(renderer, scene3D, camera) {
    if (!renderer || !scene3D || !camera) return;
    renderer.compile(scene3D, camera);
    console.log('[VRCore] Shaders pre-warmed');
  }

  /**
   * Disable antialiasing on an A-Frame scene.
   * Must be called BEFORE scene initialization (before 'loaded' event).
   * For scenes already loaded, logs a warning since antialias cannot be changed at runtime.
   *
   * @param {HTMLElement} sceneEl - The a-scene element
   * @returns {boolean} True if antialiasing was disabled, false if scene already loaded
   */
  function disableAntialias(sceneEl) {
    if (!sceneEl) sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return false;

    if (sceneEl.hasLoaded) {
      // Check if antialias is already disabled
      var renderer = sceneEl.renderer;
      if (renderer && renderer.getContext) {
        var gl = renderer.getContext();
        var attrs = gl.getContextAttributes();
        if (attrs && attrs.antialias === false) {
          console.log('[VRCore] Antialiasing already disabled');
          return true;
        }
      }
      console.warn('[VRCore] Scene already loaded - antialias must be set via renderer="antialias: false" attribute');
      return false;
    }

    // Set renderer attribute before scene loads
    var currentRenderer = sceneEl.getAttribute('renderer') || '';
    if (currentRenderer.indexOf('antialias') === -1) {
      if (currentRenderer) {
        sceneEl.setAttribute('renderer', currentRenderer + '; antialias: false');
      } else {
        sceneEl.setAttribute('renderer', 'antialias: false');
      }
      console.log('[VRCore] Disabled antialiasing via renderer attribute');
    }
    return true;
  }

  /**
   * Apply Quest-specific performance optimizations.
   * Fixes VRC.Quest.Performance.1 rejection by:
   * - Requesting target refresh rate via WebXR (default 90Hz)
   * - Setting pixelRatio to 1.0 (no scaling)
   * - Disabling antialiasing
   * - Pre-warming shaders
   * - Polling mechanism for APK race condition
   *
   * @param {HTMLElement} sceneEl - The a-scene element
   * @param {Object} [opts] - Options
   * @param {number} [opts.refreshRate=90] - Target refresh rate (72, 80, 90, 120)
   */
  function applyQuestOptimizations(sceneEl, opts) {
    opts = opts || {};
    var targetRate = opts.refreshRate || 90;
    _currentRefreshRate = targetRate;

    if (!sceneEl) sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.warn('[VRCore] No a-scene found for Quest optimizations');
      return;
    }

    if (!isQuest()) {
      console.log('[VRCore] Not on Quest, skipping Quest optimizations');
      return;
    }

    // Disable antialiasing (must happen before scene loads for full effect)
    disableAntialias(sceneEl);

    function applyRendererOptimizations() {
      var renderer = sceneEl.renderer;
      if (!renderer) return;

      // Set pixel ratio to 1.0 for Quest performance
      renderer.setPixelRatio(1.0);
      console.log('[VRCore] Set pixelRatio to 1.0');

      // Pre-warm shaders to prevent compilation hitches
      var scene3D = sceneEl.object3D;
      var camera = sceneEl.camera;
      if (scene3D && camera) {
        prewarmShaders(renderer, scene3D, camera);
      }
    }

    /**
     * Request target refresh rate on XR session.
     * @param {XRSession} session
     */
    function requestRefreshRate(session) {
      if (!session || typeof session.updateTargetFrameRate !== 'function') return;

      _activeXRSession = session;
      session.updateTargetFrameRate(targetRate).then(function() {
        console.log('[VRCore] Set refresh rate to ' + targetRate + 'Hz');
      }).catch(function(err) {
        console.warn('[VRCore] Failed to set ' + targetRate + 'Hz:', err.message);
        // Fallback to 72Hz if higher rate not supported
        if (targetRate > 72) {
          session.updateTargetFrameRate(72).then(function() {
            _currentRefreshRate = 72;
            console.log('[VRCore] Fallback to 72Hz');
          }).catch(function() {});
        }
      });
    }

    /**
     * Poll for XR session availability (APK race condition fix).
     * TWA APK may auto-enter VR before session is fully ready.
     */
    function pollForSession() {
      var attempts = 0;
      var maxAttempts = 50; // 5 seconds at 100ms intervals
      var pollInterval = 100;

      var poll = setInterval(function() {
        attempts++;
        var session = sceneEl.xrSession;

        if (session) {
          clearInterval(poll);
          requestRefreshRate(session);
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          console.warn('[VRCore] XR session not available after 5s polling');
        }
      }, pollInterval);
    }

    if (sceneEl.hasLoaded) {
      applyRendererOptimizations();
    } else {
      sceneEl.addEventListener('loaded', applyRendererOptimizations);
    }

    sceneEl.addEventListener('enter-vr', function() {
      var xrSession = sceneEl.xrSession;
      if (xrSession) {
        requestRefreshRate(xrSession);
      } else {
        // APK race condition: VR entered but session not ready yet
        pollForSession();
      }
    });

    // Track session end
    sceneEl.addEventListener('exit-vr', function() {
      _activeXRSession = null;
    });

    console.log('[VRCore] Quest optimizations applied (target: ' + targetRate + 'Hz)');
  }

  /**
   * Change refresh rate at runtime.
   * Only works when in VR mode with an active XR session.
   * @param {number} rate - Target refresh rate (72, 80, 90, 120)
   * @returns {boolean} True if request was made, false if no active session
   */
  function setRefreshRate(rate) {
    if (!_activeXRSession) {
      console.warn('[VRCore] No active XR session - cannot change refresh rate');
      return false;
    }

    if (typeof _activeXRSession.updateTargetFrameRate !== 'function') {
      console.warn('[VRCore] updateTargetFrameRate not supported');
      return false;
    }

    _activeXRSession.updateTargetFrameRate(rate).then(function() {
      _currentRefreshRate = rate;
      console.log('[VRCore] Changed refresh rate to ' + rate + 'Hz');
    }).catch(function(err) {
      console.warn('[VRCore] Failed to change to ' + rate + 'Hz:', err.message);
    });

    return true;
  }

  /**
   * Get current target refresh rate.
   * @returns {number} Current refresh rate (default 90)
   */
  function getRefreshRate() {
    return _currentRefreshRate;
  }

  return {
    loadingScreen: loadingScreen,
    autoEnterVR: autoEnterVR,
    clearServiceWorkers: clearServiceWorkers,
    isQuest: isQuest,
    applyQuestOptimizations: applyQuestOptimizations,
    disableAntialias: disableAntialias,
    setRefreshRate: setRefreshRate,
    getRefreshRate: getRefreshRate
  };
})();
