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
  const UNIT_LABEL = { oz: "oz", floz: "fl oz", lb: "lb", ct: "each" };
  const SUGGESTIONS = ["pasta", "milk", "bread", "eggs", "peanut butter", "cereal", "coffee", "chicken"];
  const STORAGE_KEY = "shelf-scout-list-v1";

  const storeById = Object.fromEntries(DATA.stores.map((s) => [s.id, s]));

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
  const providers = [sampleProvider];

  async function searchAll(query) {
    const results = await Promise.all(providers.map((p) => p.search(query)));
    return results.flat();
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
    stores: new Set(DATA.stores.map((s) => s.id)),
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
    if (o.unit === "lb" && o.size === 1) return "per lb";
    if (o.unit === "ct") return o.size + " ct";
    return o.size + " " + UNIT_LABEL[o.unit];
  }

  function itemKey(item) {
    return item.cat + "|" + item.need.slice().sort().join(",");
  }

  function itemLabel(item) {
    return DATA.categories[item.cat].label;
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
      distance: (a, b) => storeById[a.store].miles - storeById[b.store].miles || a.price - b.price,
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
    $("#store-chips").innerHTML = DATA.stores
      .map(
        (s) =>
          `<button type="button" class="chip chip-store" data-store="${s.id}" aria-pressed="${state.stores.has(
            s.id
          )}">${esc(s.name)} <span class="mi">${s.miles} mi</span></button>`
      )
      .join("");
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

    if (!state.results.length) {
      summary.innerHTML = "";
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

    summary.innerHTML = `<p><strong>${filtered.length}</strong> options at <strong>${storeCount}</strong> ${
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
            </div>
            <h3>${esc(o.name)}</h3>
            <p class="meta">${esc(o.brand)} · ${fmtSize(o)}</p>
            <p class="store"><span class="store-dot" data-s="${o.store}"></span>${esc(
          storeById[o.store].name
        )} <span class="muted">${storeById[o.store].miles} mi</span></p>
            ${
              o.tags.length
                ? `<ul class="tags">${o.tags.map((t) => `<li>${TAGS[t]}</li>`).join("")}</ul>`
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

  // The list item remembers the dietary needs that are active when you add it,
  // limited to tags the chosen product actually has.
  function needFor(offer) {
    return [...state.diet].filter((t) => offer.tags.includes(t));
  }

  function cheapestAt(item, storeId) {
    const options = DATA.offers.filter(
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
    const perStore = DATA.stores
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
    const splitPicks = state.list.map((item) => cheapestAt(item, null));
    const splitTotal = splitPicks.reduce((sum, o) => sum + (o ? o.price : 0), 0);
    const splitStores = new Set(splitPicks.filter(Boolean).map((o) => o.store));

    const rows = perStore
      .map(
        (r) => `<li class="${r === bestFull ? "is-best" : ""}${r.covered < n ? " is-partial" : ""}">
          <div>
            <span class="store-name"><span class="store-dot" data-s="${r.store.id}"></span>${esc(r.store.name)}</span>
            <span class="muted small">${
              r.covered === n ? `All ${n} items` : `${r.covered} of ${n} · missing ${esc(r.missing.join(", "))}`
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
  async function runSearch() {
    state.results = await searchAll(state.query);
    renderResults();
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
      }, 180);
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
      } else if (b.dataset.suggest) {
        state.query = input.value = b.dataset.suggest;
        runSearch();
      } else if (b.dataset.add) {
        const o = DATA.offers.find((x) => x.id === b.dataset.add);
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
        state.stores = new Set(DATA.stores.map((s) => s.id));
        state.maxPrice = $("#max-price").value = "";
        renderControls();
        renderResults();
      }
    });
  }

  renderControls();
  bind();
  renderList();
  runSearch();
})();
