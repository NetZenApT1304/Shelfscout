// Shelf Scout server: serves the app and proxies the Kroger API so the
// API key stays on the server. No dependencies; needs Node 18+.
//
//   1. Copy .env.example to .env and fill in your Kroger client ID and secret.
//   2. node server.js
//   3. Open http://localhost:8000

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT) || 8000;
const KROGER_BASE = (process.env.KROGER_API_BASE || "https://api.kroger.com/v1").replace(/\/$/, "");
const CLIENT_ID = process.env.KROGER_CLIENT_ID || "";
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET || "";
const ROOT = __dirname;

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---- Kroger API -------------------------------------------------------------

let token = null; // { value, expiresAt }

async function getToken() {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  const res = await fetch(KROGER_BASE + "/connect/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });
  if (!res.ok) throw new HttpError(502, `Kroger sign-in failed (${res.status}). Check KROGER_CLIENT_ID and KROGER_CLIENT_SECRET.`);
  const body = await res.json();
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in || 1800) * 1000 };
  return token.value;
}

async function kroger(pathAndQuery) {
  const res = await fetch(KROGER_BASE + pathAndQuery, {
    headers: { Authorization: "Bearer " + (await getToken()), Accept: "application/json" },
  });
  if (res.status === 401) token = null;
  if (!res.ok) throw new HttpError(502, `Kroger API error (${res.status}).`);
  return res.json();
}

// Small in-memory cache so repeated searches don't use up the daily API limit.
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  const value = await fn();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

async function findLocations(zip) {
  const q = new URLSearchParams({ "filter.zipCode.near": zip, "filter.limit": "6" });
  const body = await cached("loc:" + zip, 24 * 3600_000, () => kroger("/locations?" + q));
  return (body.data || []).map((l) => ({
    locationId: l.locationId,
    chain: titleCase(l.chain || "Kroger"),
    name: l.name || "",
    address: l.address ? `${l.address.addressLine1}, ${l.address.city}, ${l.address.state}` : "",
    city: l.address ? `${titleCase(l.address.city || "")}, ${l.address.state || ""}` : "",
  }));
}

async function searchProducts(term, locationId) {
  const q = new URLSearchParams({ "filter.term": term, "filter.locationId": locationId, "filter.limit": "30" });
  const body = await cached(`p:${locationId}:${term.toLowerCase()}`, 30 * 60_000, () => kroger("/products?" + q));
  const offers = [];
  for (const p of body.data || []) {
    const item = (p.items || [])[0];
    if (!item || !item.price) continue; // not sold at this store
    const regular = Number(item.price.regular) || 0;
    const promo = Number(item.price.promo) || 0;
    if (!regular && !promo) continue;
    const onSale = promo > 0 && promo < regular;
    const size = parseSize(item.size, item.soldBy);
    offers.push({
      id: `kr-${locationId}-${p.productId}`,
      upc: p.upc || p.productId,
      name: p.description || "",
      brand: p.brand || "",
      sizeText: item.size || "",
      size: size.size,
      unit: size.unit,
      price: onSale ? promo : regular || promo,
      wasPrice: onSale ? regular : null,
      tags: inferTags(`${p.description} ${p.brand} ${(p.categories || []).join(" ")}`),
    });
  }
  return offers;
}

// "1 gal" -> 128 floz, "16 oz" -> 16 oz, "12 ct" -> 12 ct, sold by weight -> per lb.
function parseSize(text, soldBy) {
  if (String(soldBy || "").toUpperCase() === "WEIGHT") return { size: 1, unit: "lb" };
  const s = String(text || "")
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/half[\s-]?gal(lon)?/, "0.5 gal")
    .replace(/gallons?/, "gal")
    .replace(/quarts?/, "qt")
    .replace(/pints?/, "pt")
    .replace(/pounds?/, "lb")
    .replace(/ounces?/, "oz")
    .replace(/(\d*\.?\d+)?\s*dozen/, (_, n) => (n ? n * 12 : 12) + " ct");
  const multi = s.match(/(\d+)\s*(?:pk|pack|ct)?\s*\/\s*(\d*\.?\d+)\s*(fl\s*oz|oz)/); // "6 ct / 12 fl oz"
  if (multi) return { size: Number(multi[1]) * Number(multi[2]), unit: /fl/.test(multi[3]) ? "floz" : "oz" };
  const m = s.match(/(\d*\.?\d+)?\s*\b(fl\.?\s*oz|oz|gal|qt|pt|lbs?|ct|count|each|ea|pk|pack)\b/);
  if (!m) return { size: 1, unit: "item" };
  const n = m[1] ? Number(m[1]) : 1;
  const u = m[2].replace(/\s|\./g, "");
  if (u === "floz") return { size: n, unit: "floz" };
  if (u === "oz") return { size: n, unit: "oz" };
  if (u === "gal") return { size: n * 128, unit: "floz" };
  if (u === "qt") return { size: n * 32, unit: "floz" };
  if (u === "pt") return { size: n * 16, unit: "floz" };
  if (u === "lb" || u === "lbs") return { size: n * 16, unit: "oz" };
  return { size: n, unit: "ct" };
}

// Kroger's basic product data has no diet attributes, so read them from the
// product name. Open Food Facts (by UPC) is the planned upgrade for this.
function inferTags(text) {
  const t = text.toLowerCase();
  const tags = [];
  if (/gluten[\s-]?free/.test(t)) tags.push("gf");
  if (/organic/.test(t)) tags.push("organic");
  if (/\bvegan\b|plant[\s-]?based/.test(t)) tags.push("vegan");
  if (/dairy[\s-]?free|non[\s-]?dairy|almond milk|oat milk|soy milk|coconut milk/.test(t)) tags.push("df");
  if (/non[\s-]?gmo/.test(t)) tags.push("ngmo");
  return tags;
}

function titleCase(s) {
  return String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- HTTP -------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/plain" };

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(ROOT, rel));
  const ok =
    file.startsWith(ROOT + path.sep) &&
    !rel.split("/").some((part) => part.startsWith(".")) &&
    rel !== "server.js";
  if (!ok || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/status") {
      return sendJson(res, 200, { kroger: Boolean(CLIENT_ID && CLIENT_SECRET) });
    }
    if (url.pathname.startsWith("/api/kroger/")) {
      if (!CLIENT_ID || !CLIENT_SECRET) throw new HttpError(503, "Kroger keys are not set. Add them to .env and restart the server.");
      if (url.pathname === "/api/kroger/locations") {
        const zip = url.searchParams.get("zip") || "";
        if (!/^\d{5}$/.test(zip)) throw new HttpError(400, "Enter a 5-digit ZIP code.");
        return sendJson(res, 200, { locations: await findLocations(zip) });
      }
      if (url.pathname === "/api/kroger/products") {
        const term = (url.searchParams.get("term") || "").trim();
        const locationId = url.searchParams.get("locationId") || "";
        if (term.length < 3) throw new HttpError(400, "Search needs at least 3 letters.");
        if (!/^[0-9A-Za-z]{1,20}$/.test(locationId)) throw new HttpError(400, "Missing store location.");
        return sendJson(res, 200, { offers: await searchProducts(term, locationId) });
      }
      throw new HttpError(404, "Unknown API route.");
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: err.status ? err.message : "Server error." });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Shelf Scout running at http://localhost:${PORT}`);
    console.log(CLIENT_ID && CLIENT_SECRET ? "Kroger live prices: on" : "Kroger live prices: off (add keys to .env)");
  });
}

module.exports = { parseSize, inferTags, server };
