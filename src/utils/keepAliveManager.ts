/**
 * On Ao Preview Keep-Alive & Anti-Pause / Anti-Reload Engine
 * Prevents browser tab discarding, timer freezing, audio suspension, and accidental reloads in AI Studio.
 */

class KeepAliveManager {
  private static instance: KeepAliveManager;
  private audioCtx: AudioContext | null = null;
  private silentOsc: OscillatorNode | null = null;
  private silentGain: GainNode | null = null;
  private worker: Worker | null = null;
  private lockAbort: AbortController | null = null;
  private wakeLockObj: any = null;
  private intervalId: any = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): KeepAliveManager {
    if (!KeepAliveManager.instance) {
      KeepAliveManager.instance = new KeepAliveManager();
    }
    return KeepAliveManager.instance;
  }

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Silent Web Audio Loop (Triggers Browser Media Keep-Alive)
    this.initSilentAudioKeepAlive();

    // 2. Unthrottled Dedicated Web Worker Heartbeat
    this.initWebWorkerHeartbeat();

    // 3. Web Locks API (Prevents Chrome Tab Discarding & Freezing)
    this.initWebLock();

    // 4. Screen & CPU WakeLock
    this.initWakeLock();

    // 5. Foreground / Background Visibility Listener
    this.initVisibilityHandlers();

    // 6. User interaction auto-resume listener (click, keydown, touch)
    this.initUserGestureResumer();
  }

  /**
   * Browser power-saving algorithms freeze JavaScript execution unless
   * an active Web Audio context is running. We initialize an inaudible, silent
   * audio graph that keeps the entire preview tab at maximum priority.
   */
  private initSilentAudioKeepAlive() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      
      // Create a silent oscillator with gain near 0
      this.silentGain = this.audioCtx.createGain();
      this.silentGain.gain.setValueAtTime(0.000001, this.audioCtx.currentTime);
      this.silentGain.connect(this.audioCtx.destination);

      this.silentOsc = this.audioCtx.createOscillator();
      this.silentOsc.type = 'sine';
      this.silentOsc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      this.silentOsc.connect(this.silentGain);
      this.silentOsc.start();

      // If initially suspended by autoplay policy, resume immediately
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch (e) {
      // AudioContext might require user gesture on strict browsers
    }
  }

  /**
   * Web Workers run in a distinct OS thread and are never throttled by background tab policies.
   */
  private initWebWorkerHeartbeat() {
    try {
      const workerCode = `
        let timer = setInterval(() => {
          postMessage('heartbeat');
        }, 4000);
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));

      this.worker.onmessage = () => {
        this.sendPing();
      };
    } catch (e) {
      // Fallback interval
      this.intervalId = setInterval(() => {
        this.sendPing();
      }, 5000);
    }
  }

  private sendPing() {
    try {
      fetch('/api/bot/ping', {
        method: 'GET',
        cache: 'no-store',
        keepalive: true
      }).catch(() => {});

      // Keep audio context actively running if suspended
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * Web Locks API locks prevent the browser tab discarder from killing the preview.
   */
  private initWebLock() {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      try {
        this.lockAbort = new AbortController();
        navigator.locks.request('onao_ai_studio_preview_keepalive_lock', { signal: this.lockAbort.signal, mode: 'shared' }, () => {
          return new Promise(() => {
            // Hold lock perpetually
          });
        }).catch(() => {});
      } catch (e) {}
    }
  }

  /**
   * Request Screen WakeLock
   */
  private async initWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockObj = await (navigator as any).wakeLock?.request('screen');
      } catch (e) {}
    }
  }

  /**
   * Re-acquire locks and resume audio on tab refocus
   */
  private initVisibilityHandlers() {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (!this.wakeLockObj) {
          this.initWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);
  }

  /**
   * Auto-resume AudioContext on first user interaction if locked by browser autoplay policy
   */
  private initUserGestureResumer() {
    const resumeOnGesture = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (!this.wakeLockObj) {
        this.initWakeLock();
      }
    };

    window.addEventListener('click', resumeOnGesture, { passive: true });
    window.addEventListener('keydown', resumeOnGesture, { passive: true });
    window.addEventListener('touchstart', resumeOnGesture, { passive: true });
  }

  public destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.lockAbort) {
      this.lockAbort.abort();
      this.lockAbort = null;
    }
    if (this.silentOsc) {
      try { this.silentOsc.stop(); } catch (e) {}
      this.silentOsc = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
    this.isInitialized = false;
  }
}

export const keepAliveEngine = KeepAliveManager.getInstance();
