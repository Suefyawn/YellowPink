// Tiny haptic taps on key mobile actions (add-to-cart, place order). The
// Vibration API is widely supported on Android browsers and silently no-ops on
// iOS Safari + desktop, so this is always safe to call. We keep the pulses
// short, anything longer feels like an error buzz rather than feedback.

export function tapHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(10); } catch {}
  }
}

export function successHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([15, 40, 15]); } catch {}
  }
}
