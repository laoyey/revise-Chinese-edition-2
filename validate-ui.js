const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = __dirname;
const profile = path.join(root, ".edge-test-profile");
const artifacts = path.join(root, ".validation");
fs.mkdirSync(artifacts, { recursive: true });
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
let server, browser, ws;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (_) { await sleep(100); }
  }
  throw new Error("等待测试组件就绪超时");
}

async function main() {
  server = spawn(process.execPath, [path.join(root, "server.js"), "--port", "7100"], { cwd: root, stdio: "ignore" });
  await waitFor(async () => {
    const response = await fetch("http://127.0.0.1:7100/");
    assert.equal(response.status, 200);
    return response;
  });

  browser = spawn(edge, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=9222", `--user-data-dir=${profile}`,
    "--window-size=1440,1000", "about:blank"
  ], { stdio: "ignore" });

  const target = await waitFor(async () => {
    const response = await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" });
    return response.json();
  });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const screenshot = async name => {
    const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(artifacts, name), Buffer.from(result.data, "base64"));
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:7100/" });
  await waitFor(async () => { if (await evaluate("document.readyState") !== "complete") throw new Error("loading"); return true; });
  await sleep(200);

  assert.equal(await evaluate("document.querySelectorAll('.chapter-card').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('.stat-card').length"), 4);
  assert((await evaluate("document.body.innerText")).includes("共 150 题"));
  await screenshot("home.png");

  await evaluate("document.getElementById('startButton').click()");
  await sleep(150);
  assert.equal(await evaluate("document.querySelectorAll('#optionsList .option-button').length"), 4);
  assert((await evaluate("document.getElementById('quizTitle').textContent")).includes("利率的含义"));
  await evaluate("document.querySelector('[data-option=\"3\"]').click()");
  assert.equal(await evaluate("document.querySelector('#optionsList .correct') !== null"), true);
  assert((await evaluate("document.getElementById('feedback').innerText")).includes("回答正确"));

  await evaluate("document.getElementById('nextButton').click()");
  await evaluate("document.querySelector('[data-option=\"0\"]').click()");
  assert.equal(await evaluate("document.querySelector('#optionsList .wrong') !== null"), true);
  assert((await evaluate("document.getElementById('feedback').innerText")).includes("正确答案"));
  await evaluate("document.getElementById('bookmarkButton').click()");
  assert((await evaluate("document.getElementById('bookmarkButton').innerText")).includes("已收藏"));
  await screenshot("quiz.png");

  await evaluate("document.querySelector('[data-filter=\"wrong\"]').click()");
  assert((await evaluate("document.getElementById('questionPosition').textContent")).includes("1 / 1"));
  await evaluate("document.getElementById('scoreButton').click()");
  assert.equal(await evaluate("document.getElementById('scoreDialog').open"), true);
  assert((await evaluate("document.getElementById('scoreContent').innerText")).includes("本章成绩"));
  await evaluate("document.getElementById('closeScoreButton').click()");

  await send("Page.reload");
  await sleep(400);
  assert((await evaluate("document.getElementById('chapterProgressStats').innerText")).includes("2"));
  await evaluate("document.querySelector('[data-filter=\"all\"]').click()");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('interest-rate-studio-v1')).bookmarks.length"), 1);

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.getElementById('homeNav').click()");
  await sleep(200);
  const overflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
  assert.equal(overflow, false, "移动端出现横向溢出");
  await screenshot("mobile.png");
  assert.deepEqual(errors, [], "浏览器出现 JavaScript 异常");

  console.log("PASS: 页面渲染、答题正误、解析、收藏、错题筛选、成绩弹窗、本地保存与移动端布局均通过。无 JavaScript 异常。");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws) try { ws.close(); } catch (_) {}
  if (browser && browser.pid) spawnSync("taskkill", ["/pid", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
  if (server && server.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
});
