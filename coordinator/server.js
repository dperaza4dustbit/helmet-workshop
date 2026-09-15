"use strict";

const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const CREDENTIALS_PATH =
  process.env.CREDENTIALS_PATH || "/data/credentials.csv";
const STATE_PATH = process.env.STATE_PATH || "/data/state.json";
const CONSOLE_URL = process.env.CONSOLE_URL || "";
const IDP_NAME = process.env.IDP_NAME || "htpasswd";
const SESSION_SECRET =
  process.env.COORDINATOR_SESSION_SECRET || "change-me-in-production";

const app = express();
app.use(cookieParser(SESSION_SECRET));

/** @type {Promise<void>} */
let lock = Promise.resolve();

function withLock(fn) {
  const run = lock.then(fn);
  lock = run.catch(() => {});
  return run;
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.assignments || typeof parsed.nextIndex !== "number") {
      throw new Error("invalid state shape");
    }
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      return { fingerprint: "", nextIndex: 0, assignments: {} };
    }
    throw err;
  }
}

function credentialsFingerprint(csvText) {
  return crypto.createHash("sha256").update(csvText).digest("hex");
}

function loadQueueAndState() {
  const csv = fs.readFileSync(CREDENTIALS_PATH, "utf8");
  const fingerprint = credentialsFingerprint(csv);
  const queue = parseCredentials(csv);
  let state = readState();
  if (state.fingerprint !== fingerprint) {
    state = { fingerprint, nextIndex: 0, assignments: {} };
    writeState(state);
  }
  return { queue, state };
}

function writeState(state) {
  const dir = path.dirname(STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}

function parseCredentials(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const userIdx = header.indexOf("username");
  const passIdx = header.indexOf("password");
  const nsIdx = header.indexOf("namespace");
  if (userIdx === -1 || passIdx === -1 || nsIdx === -1) {
    throw new Error("credentials CSV must have username,password,namespace columns");
  }

  const queue = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) {
      continue;
    }
    queue.push({
      username: cols[userIdx].trim(),
      password: cols[passIdx].trim(),
      namespace: cols[nsIdx].trim(),
    });
  }
  return queue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(res, entry, stats) {
  const consoleLink = CONSOLE_URL
    ? `<a class="btn" href="${escapeHtml(CONSOLE_URL)}" target="_blank" rel="noopener">Open OpenShift Console</a>`
    : `<p class="muted">Console URL not configured on coordinator.</p>`;

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helmet Workshop — Your login</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #151515; background: #f5f5f5; }
    body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
    h1 { font-size: 1.35rem; margin-top: 0; }
    dl { display: grid; grid-template-columns: 9rem 1fr; gap: .5rem 1rem; }
    dt { font-weight: 600; }
    dd { margin: 0; font-family: ui-monospace, monospace; word-break: break-all; }
    .btn { display: inline-block; margin-top: 1rem; padding: .6rem 1rem; background: #ee0000; color: #fff; text-decoration: none; border-radius: 4px; }
    .muted { color: #666; font-size: .9rem; }
    ol { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Your workshop environment</h1>
    <p class="muted">Save this page — your assignment is tied to this browser session.</p>
    <dl>
      <dt>Console</dt><dd>${CONSOLE_URL ? escapeHtml(CONSOLE_URL) : "—"}</dd>
      <dt>Login with</dt><dd>${escapeHtml(IDP_NAME)} (HTPasswd)</dd>
      <dt>Username</dt><dd id="user">${escapeHtml(entry.username)}</dd>
      <dt>Password</dt><dd id="pass">${escapeHtml(entry.password)}</dd>
      <dt>Namespace</dt><dd>${escapeHtml(entry.namespace)}</dd>
    </dl>
    ${consoleLink}
    <h2>Next steps</h2>
    <ol>
      <li>Open the console and log in with the identity provider <strong>${escapeHtml(IDP_NAME)}</strong>.</li>
      <li>Select project <strong>${escapeHtml(entry.namespace)}</strong>.</li>
      <li>Go to <strong>Workloads → Pods → workshop</strong> → <strong>Terminal</strong>.</li>
      <li>Run <code>cd "$ORDER_DEMO_HOME" && make build</code></li>
    </ol>
    <p class="muted">${escapeHtml(stats.assigned)} of ${escapeHtml(stats.total)} slots assigned · ${escapeHtml(stats.remaining)} remaining</p>
  </div>
</body>
</html>`);
}

function renderExhausted(res, stats) {
  res.status(503).type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Workshop full</title></head>
<body style="font-family:system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem;">
  <h1>All workshop slots are assigned</h1>
  <p>Every participant credential has already been claimed. Ask an instructor if you need help.</p>
  <p class="muted">${escapeHtml(stats.assigned)} of ${escapeHtml(stats.total)} slots assigned.</p>
</body></html>`);
}

function renderError(res, message) {
  res.status(500).type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Coordinator error</title></head>
<body style="font-family:system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem;">
  <h1>Coordinator unavailable</h1>
  <p>${escapeHtml(message)}</p>
</body></html>`);
}

function stats(state, total) {
  const assigned = Object.keys(state.assignments).length;
  return {
    assigned: String(assigned),
    total: String(total),
    remaining: String(Math.max(total - state.nextIndex, 0)),
  };
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  withLock(() => {
    try {
      const { queue, state: initialState } = loadQueueAndState();
      const total = queue.length;
      if (total === 0) {
        return renderError(res, "No credentials loaded.");
      }

      const state = initialState;
      const sessionId = req.signedCookies?.ws_session;
      if (sessionId && state.assignments[sessionId]) {
        return renderPage(res, state.assignments[sessionId], stats(state, total));
      }

      if (state.nextIndex >= total) {
        return renderExhausted(res, stats(state, total));
      }

      const entry = queue[state.nextIndex];
      const newSession = crypto.randomUUID();
      state.nextIndex += 1;
      state.assignments[newSession] = entry;
      writeState(state);

      res.cookie("ws_session", newSession, {
        signed: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      renderPage(res, entry, stats(state, total));
    } catch (err) {
      console.error(err);
      renderError(res, err.message);
    }
  }).catch((err) => {
    console.error(err);
    renderError(res, err.message);
  });
});

app.listen(PORT, () => {
  console.log(`workshop coordinator listening on :${PORT}`);
});
