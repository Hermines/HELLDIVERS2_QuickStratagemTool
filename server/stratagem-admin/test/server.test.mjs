import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CatalogStore } from "../lib/store.mjs";
import { createCatalogServer, validateBundledIcons } from "../server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const seedItemCount = JSON.parse(
  await readFile(path.join(root, "data", "seed-catalog.json"), "utf8"),
).items.length;

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hd2-catalog-server-"));
  const store = new CatalogStore({
    dataRoot: directory,
    seedPath: path.join(root, "data", "seed-catalog.json"),
    privateKeyPath: path.join(directory, "keys", "private.pem"),
    publicKeyPath: path.join(directory, "keys", "public.pem"),
  });
  await store.initialize();
  const server = createCatalogServer({
    store,
    access: { authenticate: async () => ({ email: "owner@example.com" }) },
    bundledIconRoot: path.join(root, "bundled-icons"),
    publicOrigin: "https://update.example.test",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${address.port}`, store };
}

test("public manifest and immutable catalog are available", async (t) => {
  const { base } = await fixture(t);
  const manifestResponse = await fetch(`${base}/api/v1/stratagems/manifest`);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.catalogVersion, 1);
  assert.match(manifestResponse.headers.get("cache-control"), /max-age=60/);
  assert.equal(manifestResponse.headers.get("x-content-type-options"), "nosniff");
  const catalogResponse = await fetch(`${base}${manifest.catalogPath}`);
  assert.equal((await catalogResponse.json()).items.length, seedItemCount);
  assert.match(catalogResponse.headers.get("cache-control"), /immutable/);
});

test("unknown catalog versions respond with 404 instead of 500", async (t) => {
  const { base } = await fixture(t);
  const response = await fetch(`${base}/api/v1/stratagems/catalog/9999999999`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "not_found");
});

function rawRequest(port, requestText) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.on("error", reject);
    socket.on("connect", () => socket.write(requestText));
    let response = "";
    socket.on("data", (chunk) => {
      response += chunk.toString("latin1");
    });
    socket.on("close", () => resolve(response));
    setTimeout(() => {
      socket.destroy();
      resolve(response);
    }, 2000);
  });
}

test("a malformed request target gets a 400 and does not kill the process", async (t) => {
  const { base } = await fixture(t);
  const url = new URL(base);
  // fetch would reject this target locally, so the raw request has to be
  // written to the socket to prove the server survives parsing it.
  const response = await rawRequest(
    Number(url.port),
    "GET //[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
  );
  assert.match(response, /^HTTP\/1\.1 400/);
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
});

test("admin publishes with CSRF checks and optimistic concurrency", async (t) => {
  const { base } = await fixture(t);
  const current = await (await fetch(`${base}/admin/api/catalog`)).json();
  const denied = await fetch(`${base}/admin/api/catalog`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseVersion: 1, items: current.catalog.items }),
  });
  assert.equal(denied.status, 403);
  const published = await fetch(`${base}/admin/api/catalog`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-hd2-admin": "1",
      origin: "https://update.example.test",
    },
    body: JSON.stringify({ baseVersion: 1, items: current.catalog.items }),
  });
  assert.equal(published.status, 200);
  assert.equal((await published.json()).manifest.catalogVersion, 2);
});

test("publishing an item whose bundled icon is missing from the server is rejected", async (t) => {
  const { base } = await fixture(t);
  const current = await (await fetch(`${base}/admin/api/catalog`)).json();
  const items = structuredClone(current.catalog.items);
  items[0].icon = { kind: "bundled", value: "Definitely_Not_Present.svg" };
  const rejected = await fetch(`${base}/admin/api/catalog`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-hd2-admin": "1",
      origin: "https://update.example.test",
    },
    body: JSON.stringify({ baseVersion: current.manifest.catalogVersion, items }),
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).message, /Definitely_Not_Present\.svg/);
  const unchanged = await (await fetch(`${base}/admin/api/catalog`)).json();
  assert.equal(unchanged.manifest.catalogVersion, current.manifest.catalogVersion);
});

test("admin serves only allowlisted assets and safe bundled icon names", async (t) => {
  const { base } = await fixture(t);
  assert.equal((await fetch(`${base}/admin/`)).status, 200);
  assert.equal((await fetch(`${base}/admin/app.js`)).status, 200);
  const stylesheet = await (await fetch(`${base}/admin/styles.css`)).text();
  assert.match(stylesheet, /\.catalog-pane[^}]*min-height:\s*0/s);
  assert.match(stylesheet, /\.catalog-list\s*{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
  assert.equal((await fetch(`${base}/admin/secret.txt`)).status, 404);
  const icon = await fetch(`${base}/admin/api/bundled-icon/Machine_Gun_Stratagem_Icon.svg`);
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get("content-type"), "image/svg+xml");
  assert.match(await icon.text(), /<svg\b/i);
  assert.equal((await fetch(`${base}/admin/api/bundled-icon/..%2Fsecret.svg`)).status, 404);
  assert.equal((await fetch(`${base}/admin/api/bundled-icon/not-present.svg`)).status, 404);
});

test("startup validation rejects an incomplete bundled icon package", async (t) => {
  const { store } = await fixture(t);
  const emptyDirectory = await mkdtemp(path.join(os.tmpdir(), "hd2-empty-icons-"));
  t.after(() => rm(emptyDirectory, { recursive: true, force: true }));
  await assert.rejects(
    validateBundledIcons(store, emptyDirectory),
    new RegExp(`Bundled icon validation failed \\(${seedItemCount} missing\\)`),
  );
  assert.equal(await validateBundledIcons(store, path.join(root, "bundled-icons")), seedItemCount);
});

test("admin can be fail-closed while public catalog remains available", async (t) => {
  const { base, store } = await fixture(t);
  const server = createCatalogServer({
    store,
    access: { authenticate: async () => { throw new Error("must not run"); } },
    bundledIconRoot: path.join(root, "bundled-icons"),
    publicOrigin: "https://update.example.test",
    adminDisabled: true,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${port}/admin/`)).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/stratagems/manifest`)).status, 200);
});
