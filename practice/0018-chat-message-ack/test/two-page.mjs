// Cloud harness only. ACK hold/release wraps DataChannel.send here.
// The teaching page has no pause button. Requires puppeteer-core and Chrome.
// Run from this directory after: npm install puppeteer-core
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const URL = 'http://127.0.0.1:3000/';
const outDir = '/tmp/0018-browser-test/out';
fs.mkdirSync(outDir, { recursive: true });

function redact(s) {
  return String(s)
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]');
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 90000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

async function prep(page) {
  await page.evaluateOnNewDocument(() => {
    const Orig = RTCPeerConnection;
    function Wrapped(...args) {
      const pc = new Orig(...args);
      window.__pc = pc;
      const origCreate = pc.createDataChannel.bind(pc);
      pc.createDataChannel = (...a) => {
        const dc = origCreate(...a);
        window.__dc = dc;
        const origSend = dc.send.bind(dc);
        dc.send = (data) => {
          let meta = { kind: 'raw', id: '' };
          try {
            const o = JSON.parse(data);
            meta = { kind: o.type || 'json', id: o.id || '' };
          } catch (_) {}
          window.__sends = window.__sends || [];
          window.__sends.push(meta);
          if (meta.kind === 'ack' && window.__holdAcks) {
            window.__held = window.__held || [];
            window.__held.push(String(data));
            return;
          }
          return origSend(data);
        };
        dc.addEventListener('message', (ev) => {
          let meta = { kind: 'raw', id: '' };
          try {
            const o = JSON.parse(ev.data);
            meta = { kind: o.type || 'json', id: o.id || '' };
          } catch (_) {}
          window.__recvs = window.__recvs || [];
          window.__recvs.push(meta);
        });
        return dc;
      };
      return pc;
    }
    Wrapped.prototype = Orig.prototype;
    window.RTCPeerConnection = Wrapped;
    window.__releaseIds = (ids) => {
      const want = new Set(ids);
      const keep = [];
      const send = [];
      for (const data of window.__held || []) {
        let id = '';
        try { id = JSON.parse(data).id || ''; } catch (_) {}
        if (want.has(id)) send.push(data);
        else keep.push(data);
      }
      window.__held = keep;
      const prev = window.__holdAcks;
      window.__holdAcks = false;
      for (const data of send) window.__dc.send(data);
      window.__holdAcks = prev;
    };
    window.__releaseAll = () => {
      const send = window.__held || [];
      window.__held = [];
      const prev = window.__holdAcks;
      window.__holdAcks = false;
      for (const data of send) window.__dc.send(data);
      window.__holdAcks = prev;
    };
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
}

async function poll(page, pred, timeout = 20000, ...args) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    last = await page.evaluate(pred, ...args);
    if (last === true) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('poll timeout: ' + redact(last).slice(0, 500));
}

async function connect(page, name) {
  await page.evaluate((n) => {
    document.getElementById('name-input').value = n;
    document.getElementById('connect-btn').click();
  }, name);
  await poll(page, () => document.getElementById('status').textContent === 'Status: Connected' ? true : document.getElementById('status').textContent, 40000);
}

async function sendText(page, text) {
  await page.evaluate((value) => {
    document.getElementById('msg-input').value = value;
    document.getElementById('send-btn').click();
  }, text);
}

async function snap(page) {
  return page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    text: document.getElementById('chat-box').innerText,
    sends: window.__sends || [],
    recvs: window.__recvs || [],
    held: (window.__held || []).length,
  }));
}

function idsIn(text) {
  return [...text.matchAll(/id=([0-9a-f-]{36})/gi)].map((m) => m[1]);
}

function countKind(list, kind) {
  return list.filter((x) => x.kind === kind).length;
}

const report = { url: URL, cases: {} };

async function pair() {
  const a = await browser.newPage();
  const b = await browser.newPage();
  await a.setViewport({ width: 900, height: 740 });
  await b.setViewport({ width: 900, height: 740 });
  await prep(a);
  await prep(b);
  await connect(a, 'Alice');
  await connect(b, 'Bob');
  await a.waitForFunction(
    () => document.getElementById('chat-box').innerText.includes('Bob joined'),
    { timeout: 8000 }
  );
  return { a, b };
}

try {
  {
    const { a, b } = await pair();
    await sendText(a, 'hello-from-alice');
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('hello-from-alice'),
      { timeout: 8000 }
    );
    await a.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('收到Bob应用确认'),
      { timeout: 8000 }
    );
    await sendText(b, 'hello-from-bob');
    await a.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('hello-from-bob'),
      { timeout: 8000 }
    );
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('收到Alice应用确认'),
      { timeout: 8000 }
    );
    const alice = await snap(a);
    const bob = await snap(b);
    const aIds = idsIn(alice.text);
    const bIds = idsIn(bob.text);
    report.cases.bidirectional = {
      pass: alice.text.includes('收到Bob应用确认')
        && bob.text.includes('收到Alice应用确认')
        && alice.text.includes('Bob: hello-from-bob')
        && bob.text.includes('Alice: hello-from-alice')
        && new Set(aIds).size === aIds.length
        && bIds.includes(aIds[0])
        && aIds.includes(bIds.find((id) => id !== aIds[0]) || ''),
      alice: redact(alice.text),
      bob: redact(bob.text),
      aliceSends: { chat: countKind(alice.sends, 'chat'), ack: countKind(alice.sends, 'ack') },
      bobSends: { chat: countKind(bob.sends, 'chat'), ack: countKind(bob.sends, 'ack') },
    };
    report.screenshots = false;
    report.screenshotError = 'Page.captureScreenshot timed out on this Chrome; no success screenshot was saved.';
    await a.close();
    await b.close();
  }

  {
    const { a, b } = await pair();
    await b.evaluate(() => { window.__holdAcks = true; });
    await sendText(a, 'same-body');
    await sendText(a, 'same-body');
    await b.waitForFunction(
      () => (document.getElementById('chat-box').innerText.match(/same-body/g) || []).length >= 2,
      { timeout: 8000 }
    );
    const before = await snap(a);
    const bobBefore = await snap(b);
    const ownIds = [...before.text.matchAll(/Me: same-body（id=([0-9a-f-]{36})）本地已提交/g)].map((m) => m[1]);
    await b.evaluate((id) => window.__releaseIds([id]), ownIds[0]);
    await a.waitForFunction(
      (id) => document.getElementById('chat-box').innerText.includes('id=' + id + '）收到Bob应用确认'),
      { timeout: 8000 },
      ownIds[0]
    );
    const mid = await snap(a);
    await b.evaluate((id) => window.__releaseIds([id]), ownIds[1]);
    await a.waitForFunction(
      (id) => document.getElementById('chat-box').innerText.includes('id=' + id + '）收到Bob应用确认'),
      { timeout: 8000 },
      ownIds[1]
    );
    const after = await snap(a);
    const firstConfirmedWhileSecondPending = mid.text.includes(ownIds[0] + '）收到Bob应用确认')
      && mid.text.includes(ownIds[1] + '）本地已提交，尚无对端确认');
    report.cases.sameTextDifferentId = {
      pass: ownIds.length === 2 && ownIds[0] !== ownIds[1]
        && bobBefore.text.includes(ownIds[0]) && bobBefore.text.includes(ownIds[1])
        && (bobBefore.text.match(/same-body/g) || []).length === 2
        && firstConfirmedWhileSecondPending
        && after.text.includes(ownIds[0] + '）收到Bob应用确认')
        && after.text.includes(ownIds[1] + '）收到Bob应用确认'),
      idsDistinct: ownIds[0] !== ownIds[1],
      mid: redact(mid.text),
      after: redact(after.text),
    };
    await a.close();
    await b.close();
  }

  {
    const { a, b } = await pair();
    await b.evaluate(() => { window.__holdAcks = true; });
    await sendText(a, 'pause-check');
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('pause-check'),
      { timeout: 8000 }
    );
    await new Promise((r) => setTimeout(r, 500));
    const held = await snap(a);
    const shown = await snap(b);
    const id = (held.text.match(/id=([0-9a-f-]{36})）本地已提交/) || [])[1];
    const releaseInfo = await b.evaluate((value) => {
      const heldIds = (window.__held || []).map((data) => {
        try { return JSON.parse(data).id; } catch (_) { return 'bad'; }
      });
      window.__releaseIds([value]);
      return { heldIds, hasRelease: typeof window.__releaseIds === 'function', dc: Boolean(window.__dc) };
    }, id);
    report.cases.heldThenReleased = { releaseInfo, idPresent: Boolean(id), whileHeldAlice: redact(held.text), whileHeldBob: redact(shown.text), bobHeldCount: shown.held };
    await poll(a, (value) => document.getElementById('chat-box').innerText.includes('id=' + value + '）收到Bob应用确认') ? true : document.getElementById('chat-box').innerText, 8000, id);
    const released = await snap(a);
    report.cases.heldThenReleased = {
      pass: held.text.includes('pause-check') && held.text.includes('尚无对端确认')
        && !held.text.includes('收到Bob应用确认')
        && shown.text.includes('Alice: pause-check')
        && shown.held === 1
        && released.text.includes('收到Bob应用确认'),
      whileHeldAlice: redact(held.text),
      whileHeldBob: redact(shown.text),
      bobHeldCount: shown.held,
      afterReleaseAlice: redact(released.text),
    };
    await a.close();
    await b.close();
  }

  {
    const { a, b } = await pair();
    await sendText(a, 'once-body');
    await a.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('收到Bob应用确认'),
      { timeout: 8000 }
    );
    const before = await snap(a);
    const bobBefore = await snap(b);
    const id = (before.text.match(/id=([0-9a-f-]{36})/) || [])[1];
    await b.evaluate((value) => {
      window.__dc.send(JSON.stringify({ type: 'ack', id: value }));
      window.__dc.send(JSON.stringify({ type: 'ack', id: 'unknown-id-not-pending' }));
    }, id);
    await a.waitForFunction(
      () => (window.__recvs || []).filter((x) => x.kind === 'ack').length >= 3,
      { timeout: 8000 }
    );
    await new Promise((r) => setTimeout(r, 400));
    const after = await snap(a);
    const bobAfter = await snap(b);
    const meLines = after.text.split('\n').filter((line) => line.startsWith('Me:'));
    report.cases.duplicateAndUnknown = {
      pass: meLines.length === 1
        && meLines[0].includes('收到Bob应用确认')
        && !after.text.includes('unknown-id-not-pending')
        && countKind(after.sends, 'ack') === countKind(before.sends, 'ack')
        && countKind(after.recvs, 'ack') === countKind(before.recvs, 'ack') + 2
        && countKind(bobAfter.sends, 'ack') === countKind(bobBefore.sends, 'ack') + 2
        && countKind(bobAfter.recvs, 'ack') === countKind(bobBefore.recvs, 'ack'),
      aliceAckSendsBefore: countKind(before.sends, 'ack'),
      aliceAckSendsAfter: countKind(after.sends, 'ack'),
      aliceAckRecvsBefore: countKind(before.recvs, 'ack'),
      aliceAckRecvsAfter: countKind(after.recvs, 'ack'),
      bobAckSendsBefore: countKind(bobBefore.sends, 'ack'),
      bobAckSendsAfter: countKind(bobAfter.sends, 'ack'),
      bobAckRecvsBefore: countKind(bobBefore.recvs, 'ack'),
      bobAckRecvsAfter: countKind(bobAfter.recvs, 'ack'),
      meLines: meLines.map(redact),
    };
    await a.close();
    await b.close();
  }

  {
    const { a, b } = await pair();
    await b.evaluate(() => { window.__holdAcks = true; });
    await sendText(a, 'pending-left');
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('pending-left'),
      { timeout: 8000 }
    );
    const id = ((await snap(a)).text.match(/id=([0-9a-f-]{36})）本地已提交/) || [])[1];
    await a.evaluate(() => document.getElementById('disconnect-btn').click());
    await a.waitForFunction(
      () => document.getElementById('status').textContent === 'Status: Disconnected',
      { timeout: 8000 }
    );
    const afterDisc = await snap(a);
    await connect(a, 'Alice');
    await sendText(a, 'after-reconnect');
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('after-reconnect'),
      { timeout: 8000 }
    );
    const newId = ((await snap(a)).text.match(/after-reconnect（id=([0-9a-f-]{36})）本地已提交/) || [])[1];
    await b.evaluate(() => window.__releaseAll());
    await a.waitForFunction(
      (value) => document.getElementById('chat-box').innerText.includes('id=' + value + '）收到Bob应用确认'),
      { timeout: 8000 },
      newId
    );
    const finalSnap = await snap(a);
    const oldStill = finalSnap.text.includes(id + '）本地已提交，尚无对端确认');
    const oldNotRewritten = !finalSnap.text.includes('对端未收到');
    const newConfirmed = finalSnap.text.includes(newId + '）收到Bob应用确认');
    report.cases.disconnectClearsPending = {
      pass: Boolean(id) && Boolean(newId) && id !== newId
        && afterDisc.text.includes(id + '）本地已提交，尚无对端确认')
        && !afterDisc.text.includes('对端未收到')
        && oldStill && oldNotRewritten && newConfirmed,
      afterDisconnect: redact(afterDisc.text),
      afterReconnect: redact(finalSnap.text),
    };
    await a.close();
    await b.close();
  }

  {
    const { a, b } = await pair();
    await sendText(a, 'final-a');
    await sendText(b, 'final-b');
    await a.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('收到Bob应用确认')
        && document.getElementById('chat-box').innerText.includes('Bob: final-b'),
      { timeout: 8000 }
    );
    await b.waitForFunction(
      () => document.getElementById('chat-box').innerText.includes('收到Alice应用确认')
        && document.getElementById('chat-box').innerText.includes('Alice: final-a'),
      { timeout: 8000 }
    );
    const alice = await snap(a);
    const bob = await snap(b);
    report.cases.formalRetest = {
      pass: alice.text.includes('收到Bob应用确认') && bob.text.includes('收到Alice应用确认'),
      alice: redact(alice.text),
      bob: redact(bob.text),
    };
    await a.close();
    await b.close();
  }
  report.ok = Object.values(report.cases).every((c) => c.pass);
} catch (e) {
  report.ok = false;
  report.error = redact(e.stack || e.message);
}

fs.writeFileSync(outDir + '/result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: report.ok,
  error: report.error,
  screenshots: report.screenshots,
  screenshotError: report.screenshotError,
  passes: Object.fromEntries(Object.entries(report.cases).map(([k, v]) => [k, v.pass])),
}, null, 2));
await browser.close();
