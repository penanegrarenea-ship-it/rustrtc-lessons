// Expressions evaluated against the unmodified Audio Saver page
// on 2026-11-27 JST (cloud Linux VM).
// The page's RTCPeerConnection is a local binding (`let pc = null`
// inside the page script), not window.pc. Stop later sets pc = null.
// This file does not modify rustrtc. Install the hook before clicking
// Start Recording. Do not run this whole file as one script.

// Installed before the click. At that moment window.pc does not exist.
(() => {
  const Orig = window.RTCPeerConnection;
  function Wrapped(config) {
    const pc = new Orig(config);
    window.__rustrtcPcs = window.__rustrtcPcs || [];
    window.__rustrtcPcs.push(pc);
    return pc;
  }
  Wrapped.prototype = Orig.prototype;
  Object.setPrototypeOf(Wrapped, Orig);
  for (const key of Object.getOwnPropertyNames(Orig)) {
    if (key === "prototype" || key === "length" || key === "name") continue;
    const desc = Object.getOwnPropertyDescriptor(Orig, key);
    if (desc) Object.defineProperty(Wrapped, key, desc);
  }
  window.RTCPeerConnection = Wrapped;
  window.__pcHookInstalled = true;
  return {
    pageHasWindowPc: Object.prototype.hasOwnProperty.call(window, "pc"),
    typeofPc: typeof pc
  };
})();

// Called after Start Recording constructed the connection.
// No selector was passed. Repeat the getStats call at each sample.
// Do not redeclare const pcs / const pc on the later sample.
const pcs = window.__rustrtcPcs || [];
const pc = pcs[0];
const report = await pc.getStats();
