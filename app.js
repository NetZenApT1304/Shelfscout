// Shelf Scout prototype: search, dietary filters, unit-price comparison,
// and a shopping list that compares basket totals by store.
(function () {
  "use strict";

  const DATA = window.SHELF_DATA;
  const TAGS = {
    gf: "Gluten-free",
    organic: "Organic",
    vegan: "Vegan",
    df: "Dairy-free",
    ngmo: "Non-GMO",
  };
  const UNIT_LABEL = { oz: "oz", floz: "fl oz", lb: "lb", ct: "each", item: "item" };
  const SUGGESTIONS = ["pasta", "milk", "bread", "eggs", "peanut butter", "cereal", "coffee", "chicken"];
  const STORAGE_KEY = "shelf-scout-list-v1";
  const ZIP_KEY = "shelf-scout-zip-v1";
  const LIVE_STORE_COUNT = 3; // how many nearby Kroger-family stores to search

  // Every store shown in the app. Live stores are added once a ZIP is set.
  let storeList = DATA.stores.map((s, i) => ({ ...s, note: s.miles + " mi", rank: s.miles, live: false }));
  let storeById = {};
  function indexStores() {
    storeById = Object.fromEntries(storeList.map((s) => [s.id, s]));
  }
  indexStores();

  // Every offer seen so far, so the shopping list can compare live stores too.
  const pool = new Map(DATA.offers.map((o) => [o.id, o]));

  // ---- Data providers -------------------------------------------------------
  // Each provider returns offers in the same shape as data/products.js.
  // To add a real store, write a provider that calls your backend
  // (which holds the store's API key) and maps its results to this shape.
  const sampleProvider = {
    name: "Sample catalog",
    async search(query) {
      return DATA.offers.filter((o) => matches(o, query));
    },
  };

  // Live prices from Kroger-family stores, through server.js.
  // Only works when the app is served by server.js with Kroger keys set.
  const live = { available: false, zip: "", locations: [], error: "", dietPending: 0 };

  const krogerProvider = {
    name: "Kroger",
    async search(query) {
      const term = query.trim();
      if (!live.locations.length || term.length < 3) return [];
      const cat = categoryForQuery(term);
      const perStore = await Promise.all(
        live.locations.map(async (loc) => {
          const res = await fetch(
            "/api/kroger/products?" + new URLSearchParams({ term, locationId: loc.locationId })
          );
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Kroger search failed.");
          return body.offers.map((o) => ({ ...o, store: "kr-" + loc.locationId, cat, live: true }));
        })
      );
      const offers = perStore.flat();
      offers.forEach((o) => (o.sources = Object.fromEntries(o.tags.map((t) => [t, "name"]))));
      enrichDiet(offers);
      return offers;
    },
  };

  // Fill in diet tags from Open Food Facts by barcode, through server.js.
  // Runs in the background; results re-render when they arrive.
  const dietCache = new Map(); // Kroger product code -> result (or a pending promise)

  async function enrichDiet(offers) {
    const codes = [...new Set(offers.map((o) => o.upc).filter((c) => c && !dietCache.has(c)))];
    const batches = [];
    for (let i = 0; i < codes.length; i += 40) batches.push(codes.slice(i, i + 40));
    batches.forEach((batch) => {
      const p = fetch("/api/diet?codes=" + batch.join(","))
        .then((r) => (r.ok ? r.json() : { results: {} }))
        .then((body) => batch.forEach((c) => dietCache.set(c, body.results[c] || { found: false })))
        .catch(() => batch.forEach((c) => dietCache.delete(c)));
      batch.forEach((c) => dietCache.set(c, p));
    });
    const pending = [...new Set(offers.map((o) => dietCache.get(o.upc)).filter((v) => v instanceof Promise))];
    if (!pending.length) return offers.forEach(applyDiet);
    live.dietPending++;
    renderResults();
    await Promise.allSettled(pending);
    live.dietPending--;
    offers.forEach(applyDiet);
    renderResults();
    renderList();
  }

  function applyDiet(o) {
    const d = dietCache.get(o.upc);
    if (!d || d instanceof Promise || !d.found || o.offCode) return;
    o.offCode = d.code;
    const tags = new Set(o.tags.filter((t) => !d.excludes.includes(t)));
    d.tags.forEach((t) => tags.add(t));
    const sources = {};
    tags.forEach((t) => (sources[t] = d.sources[t] || o.sources[t] || "name"));
    o.tags = [...tags];
    o.sources = sources;
  }

  const providers = [sampleProvider, krogerProvider];

  async function searchAll(query) {
    const settled = await Promise.allSettled(providers.map((p) => p.search(query)));
    live.error = "";
    const offers = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") offers.push(...r.value);
      else if (providers[i] === krogerProvider) live.error = r.reason.message || "Live prices are unavailable.";
    });
    offers.forEach((o) => pool.set(o.id, o));
    return offers;
  }

  // Live products have no category, so borrow one from the sample catalog
  // when the search clearly means one item type ("gluten-free bread" -> bread).
  // Otherwise the search words become the category.
  function categoryForQuery(query) {
    const cats = new Set(DATA.offers.filter((o) => matches(o, query)).map((o) => o.cat));
    if (cats.size === 1) return [...cats][0];
    return "q:" + query.trim().toLowerCase();
  }

  function normalizeToken(t) {
    return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
  }

  function matches(offer, query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean).map(normalizeToken);
    if (!tokens.length) return false;
    const cat = DATA.categories[offer.cat];
    const hay = [
      offer.name,
      offer.brand,
      cat.label,
      cat.kw,
      offer.tags.map((t) => TAGS[t]).join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .replace(/-/g, " ");
    return tokens.every((t) => hay.includes(t.replace(/-/g, " ")));
  }

  // ---- State ----------------------------------------------------------------
  const state = {
    query: "pasta",
    diet: new Set(),
    stores: new Set(storeList.map((s) => s.id)),
    sort: "unit",
    maxPrice: "",
    results: [],
    list: loadList(),
  };

  function loadList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* storage unavailable */
    }
    // Example list so the basket comparison has something to show.
    return [
      { cat: "pasta", need: ["gf"] },
      { cat: "milk", need: [] },
      { cat: "eggs", need: [] },
      { cat: "bananas", need: [] },
      { cat: "pb", need: [] },
    ];
  }

  function saveList() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.list));
    } catch (e) {
      /* storage unavailable */
    }
  }

  // ---- Helpers --------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => "$" + n.toFixed(2);
  const unitPrice = (o) => o.price / o.size;

  function fmtUnit(o) {
    const u = unitPrice(o);
    const val = u < 0.1 ? "$" + u.toFixed(3) : money(u);
    return val + " / " + UNIT_LABEL[o.unit];
  }

  function fmtSize(o) {
    if (o.sizeText) return o.sizeText;
    if (o.unit === "lb" && o.size === 1) return "per lb";
    if (o.unit === "ct") return o.size + " ct";
    return o.size + " " + UNIT_LABEL[o.unit];
  }

  function itemKey(item) {
    return item.cat + "|" + item.need.slice().sort().join(",");
  }

  function itemLabel(item) {
    if (DATA.categories[item.cat]) return DATA.categories[item.cat].label;
    const q = item.cat.slice(2);
    return q.charAt(0).toUpperCase() + q.slice(1);
  }

  // ---- Filtering ------------------------------------------------------------
  function applyFilters(offers) {
    const max = parseFloat(state.maxPrice);
    return offers.filter(
      (o) =>
        state.stores.has(o.store) &&
        [...state.diet].every((t) => o.tags.includes(t)) &&
        (isNaN(max) || o.price <= max)
    );
  }

  function sortOffers(offers) {
    const by = {
      unit: (a, b) => a.unit.localeCompare(b.unit) || unitPrice(a) - unitPrice(b),
      price: (a, b) => a.price - b.price,
      distance: (a, b) => storeById[a.store].rank - storeById[b.store].rank || a.price - b.price,
    }[state.sort];
    return offers.slice().sort(by);
  }

  // ---- Rendering ------------------------------------------------------------
  function renderControls() {
    $("#diet-chips").innerHTML = Object.entries(TAGS)
      .map(
        ([k, label]) =>
          `<button type="button" class="chip" data-diet="${k}" aria-pressed="${state.diet.has(k)}">${label}</button>`
      )
      .join("");
    $("#store-chips").innerHTML = storeList
      .map(
        (s) =>
          `<button type="button" class="chip chip-store${s.live ? " chip-live" : ""}" data-store="${
            s.id
          }" aria-pressed="${state.stores.has(s.id)}">${s.live ? '<span class="live-dot" aria-hidden="true"></span>' : ""}${esc(
            s.name
          )} <span class="mi">${esc(s.note)}</span></button>`
      )
      .join("");
    renderLiveStatus();
    $("#suggestions").innerHTML =
      '<span class="try">Try</span>' +
      SUGGESTIONS.map((s) => `<button type="button" class="link-btn" data-suggest="${s}">${s}</button>`).join("");
  }

  function renderResults() {
    const filtered = sortOffers(applyFilters(state.results));
    const listEl = $("#results");
    const summary = $("#summary");

    if (!state.query.trim()) {
      summary.innerHTML = "";
      listEl.innerHTML = `<div class="empty"><p>Search for an item to compare prices across stores.</p></div>`;
      return;
    }

    const notice =
      (live.error ? `<p class="notice">Live prices: ${esc(live.error)}</p>` : "") +
      (live.dietPending ? `<p class="checking">Checking dietary labels on Open Food Facts…</p>` : "");

    if (!state.results.length) {
      summary.innerHTML = notice;
      listEl.innerHTML = `<div class="empty"><p>No items match “${esc(
        state.query
      )}” in the sample catalog.</p><p class="muted">The prototype has ${
        Object.keys(DATA.categories).length
      } item types: ${Object.values(DATA.categories)
        .map((c) => c.label.toLowerCase())
        .join(", ")}.</p></div>`;
      return;
    }

    if (!filtered.length) {
      summary.innerHTML = "";
      listEl.innerHTML = `<div class="empty"><p>${state.results.length} results for “${esc(
        state.query
      )}”, but none match your filters.</p><button type="button" class="btn" data-action="clear-filters">Clear filters</button></div>`;
      return;
    }

    // Best value = lowest unit price within each unit type.
    const bestByUnit = {};
    filtered.forEach((o) => {
      if (!bestByUnit[o.unit] || unitPrice(o) < unitPrice(bestByUnit[o.unit])) bestByUnit[o.unit] = o;
    });
    const lowest = filtered.reduce((a, b) => (b.price < a.price ? b : a));
    const storeCount = new Set(filtered.map((o) => o.store)).size;
    const best = Object.values(bestByUnit)[0];

    summary.innerHTML = notice + `<p><strong>${filtered.length}</strong> options at <strong>${storeCount}</strong> ${
      storeCount === 1 ? "store" : "stores"
    }${state.diet.size ? " · " + [...state.diet].map((t) => TAGS[t].toLowerCase()).join(", ") : ""}</p>
      <p class="muted">Best value: <strong>${esc(best.name)}</strong> at ${esc(storeById[best.store].name)}, ${fmtUnit(
      best
    )}</p>`;

    const inList = new Set(state.list.map(itemKey));
    listEl.innerHTML = filtered
      .map((o) => {
        const isBest = bestByUnit[o.unit] === o;
        const isLowest = lowest === o && !isBest;
        const key = itemKey({ cat: o.cat, need: needFor(o) });
        const added = inList.has(key);
        return `<li class="offer${isBest ? " is-best" : ""}">
          <div class="offer-info">
            <div class="badges">
              ${isBest ? '<span class="badge badge-best">Best value</span>' : ""}
              ${isLowest ? '<span class="badge badge-low">Lowest price</span>' : ""}
              ${o.wasPrice ? '<span class="badge badge-sale">Sale</span>' : ""}
              ${o.live ? '<span class="badge badge-live">Live price</span>' : ""}
            </div>
            <h3>${esc(o.name)}</h3>
            <p class="meta">${esc(o.brand)} · ${fmtSize(o)}</p>
            <p class="store"><span class="store-dot" data-s="${o.store}"></span>${esc(
          storeById[o.store].name
        )} <span class="muted">${esc(storeById[o.store].note)}</span></p>
            ${
              o.tags.length
                ? `<ul class="tags">${o.tags.map((t) => tagPill(o, t)).join("")}</ul>`
                : ""
            }
            ${
              o.offCode
                ? `<p class="source">Diet info: <a href="https://world.openfoodfacts.org/product/${esc(
                    o.offCode
                  )}" target="_blank" rel="noopener">Open Food Facts</a></p>`
                : o.live
                ? `<p class="source">Diet info from the product name only</p>`
                : ""
            }
          </div>
          <div class="price-tag">
            <div class="price">${money(o.price)}</div>
            ${o.wasPrice ? `<div class="was">${money(o.wasPrice)}</div>` : ""}
            <div class="unit">${fmtUnit(o)}</div>
            <button type="button" class="add-btn" data-add="${o.id}" ${added ? "disabled" : ""}>${
          added ? "On list" : "+ Add to list"
        }</button>
          </div>
        </li>`;
      })
      .join("");
  }

  const SOURCE_NOTE = {
    label: "On the product label",
    ingredients: "Based on the ingredient list, not a label claim",
    name: "From the product name",
  };
  function tagPill(o, t) {
    const src = (o.sources && o.sources[t]) || "label";
    return `<li class="src-${src}" title="${SOURCE_NOTE[src]}">${TAGS[t]}${src === "ingredients" ? "*" : ""}</li>`;
  }

  // The list item remembers the dietary needs that are active when you add it,
  // limited to tags the chosen product actually has.
  function needFor(offer) {
    return [...state.diet].filter((t) => offer.tags.includes(t));
  }

  function cheapestAt(item, storeId) {
    const options = [...pool.values()].filter(
      (o) => o.cat === item.cat && (!storeId || o.store === storeId) && item.need.every((t) => o.tags.includes(t))
    );
    return options.sort((a, b) => a.price - b.price)[0] || null;
  }

  function renderList() {
    const el = $("#list");
    $("#list-count").textContent = state.list.length ? `${state.list.length} items` : "";

    if (!state.list.length) {
      el.innerHTML = `<p class="muted">Add items with <strong>+ Add to list</strong>. Shelf Scout then shows what your whole basket costs at each store.</p>`;
      return;
    }

    const items = state.list
      .map(
        (item, i) => `<li>
          <span>${esc(itemLabel(item))}${item.need
          .map((t) => ` <span class="need">${TAGS[t]}</span>`)
          .join("")}</span>
          <button type="button" class="remove" data-remove="${i}" aria-label="Remove ${esc(itemLabel(item))}">×</button>
        </li>`
      )
      .join("");

    // Basket total at each store, using the cheapest matching product there.
    const perStore = storeList
      .filter((s) => state.stores.has(s.id))
      .map((s) => {
        const picks = state.list.map((item) => cheapestAt(item, s.id));
        const found = picks.filter(Boolean);
        return {
          store: s,
          total: found.reduce((sum, o) => sum + o.price, 0),
          covered: found.length,
          missing: state.list.filter((_, i) => !picks[i]).map(itemLabel),
        };
      })
      .sort((a, b) => b.covered - a.covered || a.total - b.total);

    const n = state.list.length;
    const bestFull = perStore.find((r) => r.covered === n);

    // Cheapest split: each item from whichever store has it cheapest.
    const splitPicks = state.list.map((item) =>
      [...pool.values()]
        .filter((o) => state.stores.has(o.store) && o.cat === item.cat && item.need.every((t) => o.tags.includes(t)))
        .sort((a, b) => a.price - b.price)[0] || null
    );
    const splitTotal = splitPicks.reduce((sum, o) => sum + (o ? o.price : 0), 0);
    const splitStores = new Set(splitPicks.filter(Boolean).map((o) => o.store));

    const rows = perStore
      .map(
        (r) => `<li class="${r === bestFull ? "is-best" : ""}${r.covered < n ? " is-partial" : ""}">
          <div>
            <span class="store-name"><span class="store-dot" data-s="${r.store.id}"></span>${esc(r.store.name)}</span>
            <span class="muted small">${
              r.covered === n
                ? `All ${n} items`
                : `${r.covered} of ${n} · ${r.store.live ? "no price yet for" : "missing"} ${esc(r.missing.join(", "))}`
            }</span>
          </div>
          <strong class="total">${money(r.total)}</strong>
        </li>`
      )
      .join("");

    el.innerHTML = `<ul class="list-items">${items}</ul>
      <h3 class="sub">Where to shop</h3>
      <ul class="basket">${rows}</ul>
      ${
        bestFull && splitStores.size > 1 && bestFull.total - splitTotal > 0.005
          ? `<p class="split">Splitting across ${splitStores.size} stores costs <strong>${money(
              splitTotal
            )}</strong>, saving ${money(bestFull.total - splitTotal)} over ${esc(bestFull.store.name)}.</p>`
          : ""
      }
      <button type="button" class="link-btn" data-action="clear-list">Clear list</button>`;
  }

  // ---- Events ---------------------------------------------------------------
  let searchSeq = 0;
  async function runSearch() {
    const seq = ++searchSeq;
    const results = await searchAll(state.query);
    if (seq !== searchSeq) return; // a newer search has started
    state.results = results;
    renderResults();
    renderList();
  }

  // Look up live prices for everything already on the list, so the
  // "Where to shop" totals include the live stores.
  async function refreshListPrices() {
    if (!live.locations.length || !state.list.length) return;
    await Promise.allSettled(
      state.list.map(async (item) => {
        const term = [...item.need.map((t) => TAGS[t]), itemLabel(item)].join(" ");
        const offers = await krogerProvider.search(term);
        offers.forEach((o) => {
          o.cat = item.cat; // keep the list's category even if the words differ
          pool.set(o.id, o);
        });
      })
    );
    renderList();
  }

  function bind() {
    const input = $("#q");
    input.value = state.query;

    $("#search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.query = input.value;
      runSearch();
    });

    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.query = input.value;
        runSearch();
      }, 450);
    });

    $("#sort").addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderResults();
    });

    $("#max-price").addEventListener("input", (e) => {
      state.maxPrice = e.target.value;
      renderResults();
    });

    document.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.diet) {
        const k = b.dataset.diet;
        state.diet.has(k) ? state.diet.delete(k) : state.diet.add(k);
        renderControls();
        renderResults();
      } else if (b.dataset.store) {
        const k = b.dataset.store;
        if (state.stores.has(k) && state.stores.size === 1) return;
        state.stores.has(k) ? state.stores.delete(k) : state.stores.add(k);
        renderControls();
        renderResults();
        renderList();
      } else if (b.dataset.suggest) {
        state.query = input.value = b.dataset.suggest;
        runSearch();
      } else if (b.dataset.add) {
        const o = pool.get(b.dataset.add);
        const item = { cat: o.cat, need: needFor(o) };
        if (!state.list.some((x) => itemKey(x) === itemKey(item))) {
          state.list.push(item);
          saveList();
          renderList();
          renderResults();
        }
      } else if (b.dataset.remove) {
        state.list.splice(Number(b.dataset.remove), 1);
        saveList();
        renderList();
        renderResults();
      } else if (b.dataset.action === "clear-list") {
        state.list = [];
        saveList();
        renderList();
        renderResults();
      } else if (b.dataset.action === "clear-filters") {
        state.diet.clear();
        state.stores = new Set(storeList.map((s) => s.id));
        state.maxPrice = $("#max-price").value = "";
        renderControls();
        renderResults();
      }
    });
  }

  // ---- Live store setup -------------------------------------------------------
  function renderLiveStatus() {
    const el = $("#live");
    if (!live.available) {
      el.innerHTML = `<p class="live-off">Live Kroger prices are off. Run <code>node server.js</code> with Kroger keys to turn them on (see README).</p>`;
      return;
    }
    const where = live.locations.length
      ? `Live prices from ${live.locations.length} Kroger-family ${live.locations.length === 1 ? "store" : "stores"} near ${esc(live.zip)}`
      : "Enter your ZIP code to add live prices from nearby Kroger-family stores.";
    el.innerHTML = `<form id="zip-form" class="zip-form">
        <label for="zip">ZIP</label>
        <input id="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="45202" value="${esc(live.zip)}">
        <button type="submit" class="btn btn-small">${live.locations.length ? "Update" : "Find stores"}</button>
      </form>
      <p class="live-on"><span class="live-dot" aria-hidden="true"></span>${where}</p>`;
    $("#zip-form").addEventListener("submit", (e) => {
      e.preventDefault();
      setZip($("#zip").value.trim());
    });
  }

  async function setZip(zip) {
    try {
      const res = await fetch("/api/kroger/locations?zip=" + encodeURIComponent(zip));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not find stores.");
      if (!body.locations.length) throw new Error("No Kroger-family stores found near " + zip + ".");
      live.zip = zip;
      live.locations = body.locations.slice(0, LIVE_STORE_COUNT);
      live.error = "";
      try {
        localStorage.setItem(ZIP_KEY, zip);
      } catch (e) {
        /* storage unavailable */
      }
      storeList = storeList.filter((s) => !s.live);
      live.locations.forEach((loc, i) => {
        const id = "kr-" + loc.locationId;
        storeList.unshift({ id, name: loc.name || loc.chain, note: loc.city, address: loc.address, rank: -10 + i, live: true });
        state.stores.add(id);
      });
      storeList.sort((a, b) => a.rank - b.rank);
      indexStores();
      $("#sample-note").innerHTML = "<b>Prototype.</b> Stores with a blue dot have live Kroger prices; the rest are sample data.";
      refreshListPrices();
    } catch (err) {
      live.error = err.message;
    }
    renderControls();
    renderList();
    runSearch();
  }

  async function initLive() {
    if (location.protocol === "file:") return;
    try {
      const res = await fetch("/api/status");
      if (!res.ok) return;
      const status = await res.json();
      live.available = Boolean(status.kroger);
    } catch (e) {
      return; // no server (for example the static preview)
    }
    renderLiveStatus();
    let saved = "";
    try {
      saved = localStorage.getItem(ZIP_KEY) || "";
    } catch (e) {
      /* storage unavailable */
    }
    if (live.available && saved) setZip(saved);
  }

  renderControls();
  bind();
  renderList();
  runSearch();
  initLive();
})();
