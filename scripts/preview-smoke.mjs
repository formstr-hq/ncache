// Smoke test for the /preview endpoint.
//
//   node scripts/preview-smoke.mjs          # offline only (fixtures, no network)
//   node scripts/preview-smoke.mjs --live   # also spawn the server and test real events
//
// Offline mode only needs `pnpm build` to have run. Live mode needs relay
// access and will skip (not fail) if the relays are unreachable.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { nip19, SimplePool } from "nostr-tools";
import { buildEventPreview } from "../dist/services/preview.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIVE = process.argv.includes("--live");
const PORT = Number(process.env.SMOKE_PORT || 5199);
const RELAYS = (
  process.env.NOSTR_RELAYS ??
  "wss://relay.formstr.app,wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol"
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const POLLERAMA_URL = (
  process.env.POLLERAMA_URL ?? "https://pollerama.fun"
).replace(/\/$/, "");

const pk = "a".repeat(64);
const base = { pubkey: pk, created_at: 1_700_000_000 };

// ---------------------------------------------------------------------------
// 1. Offline: the pure preview builder
// ---------------------------------------------------------------------------
function offline() {
  console.log("offline: buildEventPreview");

  const note = buildEventPreview({
    ...base,
    id: "b".repeat(64),
    kind: 1,
    content: "gm https://example.com/pic.jpg",
    tags: [],
  });
  assert.equal(note.kind, 1);
  assert.equal(note.image, "https://example.com/pic.jpg");
  assert.ok(note.reference.startsWith("nevent1"), "note ref is nevent");
  assert.equal(note.summary, "gm https://example.com/pic.jpg");

  const reply = buildEventPreview({
    ...base,
    id: "c".repeat(64),
    kind: 1,
    content: "nice",
    tags: [["subject", "Re: hi"], ["imeta", "url https://cdn.example.com/a.webp"]],
  });
  assert.equal(reply.title, "Re: hi");
  assert.equal(reply.image, "https://cdn.example.com/a.webp");

  const poll = buildEventPreview({
    ...base,
    id: "e".repeat(64),
    kind: 1068,
    content: "Best chain?",
    tags: [
      ["option", "opt1", "Bitcoin"],
      ["option", "opt2", "Nostr"],
      ["polltype", "singlechoice"],
      ["endsAt", "1800000000"],
    ],
  });
  assert.equal(poll.poll.type, "singlechoice");
  assert.equal(poll.poll.options.length, 2);
  assert.equal(poll.poll.options[1].label, "Nostr");
  assert.equal(poll.poll.endsAt, 1_800_000_000);

  const article = buildEventPreview({
    ...base,
    id: "f".repeat(64),
    kind: 30023,
    content: "body",
    tags: [
      ["d", "my-article"],
      ["title", "Hello"],
      ["summary", "sum"],
      ["image", "https://x.io/i.png"],
      ["published_at", "1699999999"],
    ],
  });
  assert.equal(article.title, "Hello");
  assert.equal(article.image, "https://x.io/i.png");
  assert.equal(article.published_at, 1_699_999_999);
  assert.ok(article.reference.startsWith("naddr1"), "article ref is naddr");

  // canonical links into the live pollerama app
  assert.ok(
    note.url.startsWith(`${POLLERAMA_URL}/note/nevent1`),
    "note url -> /note/:nevent"
  );
  assert.ok(
    poll.url.startsWith(`${POLLERAMA_URL}/note/nevent1`),
    "poll url -> /note/:nevent"
  );
  assert.ok(
    article.url.startsWith(`${POLLERAMA_URL}/feeds/articles/naddr1`),
    "article url -> /feeds/articles/:naddr"
  );
  // kinds pollerama can't render get no url
  const form = buildEventPreview({
    ...base,
    id: "2".repeat(64),
    kind: 30168,
    content: "",
    tags: [["d", "form-1"]],
  });
  assert.equal(form.url, undefined, "form naddr has no pollerama url");

  // overlong note content is truncated
  const long = buildEventPreview({
    ...base,
    id: "1".repeat(64),
    kind: 1,
    content: "x".repeat(1000),
    tags: [],
  });
  assert.ok(long.summary.length <= 280, "summary is capped");

  console.log("offline: OK");
}

// ---------------------------------------------------------------------------
// 2. Live: spawn the server and exercise /preview for real events
// ---------------------------------------------------------------------------
function firstEvent(kinds, limit = 1) {
  const pool = new SimplePool();
  return new Promise((resolve) => {
    let settled = false;
    const done = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.close();
      pool.close([]);
      resolve(event ?? null);
    };
    const sub = pool.subscribeMany(RELAYS, { kinds, limit }, {
      onevent: (event) => done(event),
    });
    const timer = setTimeout(() => done(null), 15000);
  });
}

async function get(url) {
  const res = await fetch(url);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function head(url) {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

async function live() {
  console.log("live: spawning server on", PORT);
  const server = spawn("node", ["dist/index.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), NOSTR_RELAYS: RELAYS.join(",") },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const stop = () => server.kill("SIGKILL");

  try {
    // wait for it to answer
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(`http://127.0.0.1:${PORT}/decode/nope`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    const cases = [];
    const note = await firstEvent([1]);
    if (note) {
      cases.push(["note  (kind 1)", nip19.neventEncode({ id: note.id, kind: 1, author: note.pubkey })]);
      cases.push(["note1 (kind 1)", nip19.noteEncode(note.id)]);
    }
    const poll = await firstEvent([1068]);
    if (poll) {
      cases.push(["poll  (kind 1068)", nip19.neventEncode({ id: poll.id, kind: 1068, author: poll.pubkey })]);
    }
    const article = await firstEvent([30023]);
    if (article) {
      const d = article.tags.find((t) => t[0] === "d")?.[1] ?? "";
      cases.push(["article (kind 30023)", nip19.naddrEncode({ kind: 30023, pubkey: article.pubkey, identifier: d })]);
    }

    if (cases.length === 0) {
      console.log("live: relays unreachable or empty — skipping (this is not a failure)");
      return;
    }

    for (const [label, id] of cases) {
      const { status, body } = await get(`http://127.0.0.1:${PORT}/preview/${id}`);
      assert.equal(status, 200, `${label} -> HTTP ${status}`);
      assert.ok(body.preview, `${label} has preview`);
      assert.ok(
        body.preview.url?.startsWith(`${POLLERAMA_URL}/`),
        `${label} preview.url points at pollerama`
      );
      console.log(`live: ${label} -> kind ${body.preview.kind}, url ${body.preview.url}`);

      // /open/:identifier should 302 there
      const redirect = await head(`http://127.0.0.1:${PORT}/open/${id}`);
      assert.equal(redirect.status, 302, `${label} /open -> HTTP ${redirect.status}`);
      assert.equal(redirect.location, body.preview.url, `${label} /open Location`);
    }

    // negative cases
    assert.equal((await get(`http://127.0.0.1:${PORT}/preview/nope`)).status, 400);
    assert.equal(
      (await get(`http://127.0.0.1:${PORT}/preview/${nip19.npubEncode(pk)}`)).status,
      400
    );
    console.log("live: OK");
  } finally {
    stop();
  }
}

offline();
if (LIVE) {
  await live();
} else {
  console.log("(run with --live to also test the running server against real events)");
}
