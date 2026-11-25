// Expressions actually evaluated in the Echo page on 2026-11-26 JST.
// The page's RTCPeerConnection is a local binding inside start(), not window.pc.
// This file does not modify rustrtc. A test harness evaluated it with
// Runtime.evaluate before and after the Start Connection click.

// Installed before the click. At that moment:
//   Object.prototype.hasOwnProperty.call(window, "pc") === false
//   typeof pc === "undefined"
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

// Called after the page's start() constructed the connection.
// No selector was passed. The same call was repeated at each sample.
const pcs = window.__rustrtcPcs || [];
const pc = pcs[0];
const report = await pc.getStats();
