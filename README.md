# Shelf Scout

A prototype grocery comparison app. Search for an item and see every store's
option side by side, filtered by your needs (gluten-free, organic, vegan,
dairy-free, non-GMO) and sorted by **unit price**, so a 40 oz jar and a 16 oz
jar compare fairly.

> All stores, brands and prices in this prototype are made-up sample data.

## Features

- **Search** across all stores at once (try "pasta", "gluten-free bread", "organic eggs").
- **Dietary filters** that combine: Gluten-free + Vegan shows only items that are both.
- **Store filter** with distance, plus a max-price limit.
- **Unit-price sorting** with a *Best value* tag, plus *Lowest price* and *Sale* tags.
- **Shopping list with basket comparison.** Shows what your whole list costs at
  each store, which stores are missing items, and how much you'd save by
  splitting the trip across stores. Dietary needs active when you add an item
  are remembered (add pasta with Gluten-free on, and only GF pasta counts).

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Page layout and styles |
| `app.js` | Search, filters, sorting, shopping list and basket comparison |
| `data/products.js` | Sample catalog: 5 stores, 12 item types, ~75 products |

## Connecting real store data

`app.js` gets products through **providers**. Each provider has a
`search(query)` function that returns offers in this shape:

```js
{ id, cat, name, brand, store, size, unit /* oz | floz | lb | ct */,
  price, wasPrice, tags /* ["gf", "organic", "vegan", "df", "ngmo"] */ }
```

To add a real store, write a provider that calls **your own backend**, and have
the backend call the store's API. Store API keys must never be in browser code.

Data sources to look at:

- **Kroger Developer API**: product search and prices by store location (free, needs an account).
- **Walmart affiliate / product APIs**: product and price data (requires approval).
- **Open Food Facts** (free, open): look up a barcode (UPC) to fill in gluten-free,
  organic, vegan and allergen labels that store APIs often leave out.

Prices and stock vary by store location, so a real version should ask for the
shopper's ZIP code and pass it to each provider.

## Next steps

1. Small backend (e.g. Node or Python) with a Kroger provider.
2. ZIP code / location selection.
3. Enrich products with Open Food Facts dietary data by UPC.
4. Price-drop alerts and saved dietary profiles.
