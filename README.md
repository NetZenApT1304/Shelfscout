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

Needs [Node.js](https://nodejs.org) 18 or newer. No packages to install.

```sh
node server.js        # then open http://localhost:8000
```

Without Kroger keys the app runs on sample data only. You can also open
`index.html` directly in a browser for the sample-data version.

## Live Kroger prices

The app can show real prices from Kroger-family stores (Kroger, Ralphs,
Fred Meyer, King Soopers, Harris Teeter, Smith's, Fry's, QFC and others).

1. Create a free account at <https://developer.kroger.com>.
2. Register an application and choose the **Products** API (production
   environment). Copy the **Client ID** and **Client Secret**.
3. Copy `.env.example` to `.env` and paste them in:
   ```
   KROGER_CLIENT_ID=your-client-id
   KROGER_CLIENT_SECRET=your-client-secret
   ```
4. Run `node server.js`, open <http://localhost:8000>, and enter your ZIP code.

The app then searches the 3 nearest Kroger-family stores alongside the sample
stores. Live results have a **Live price** tag and a blue store dot, and the
shopping list looks up live prices for everything on it.

How it works:

- `server.js` signs in to Kroger with your keys and calls the Locations and
  Products APIs. The keys never reach the browser, and `.env` is in `.gitignore`.
- Results are cached (30 min for products, 1 day for store lookups) to stay well
  under Kroger's daily request limits.
- Sizes like "1 gal", "half gallon" or "6 ct / 12 fl oz" are converted to
  ounces or counts so unit prices compare fairly.
- Dietary tags for Kroger products come from **Open Food Facts** (see below),
  with the product name as a fallback.

## Dietary labels (Open Food Facts)

Kroger's product data has no dietary labels, so `server.js` looks each product
up by barcode in [Open Food Facts](https://world.openfoodfacts.org), a free,
open food database. No account or key is needed.

| Tag | Counts when |
|---|---|
| Gluten-free | Labeled gluten-free, **or** the ingredient list has no gluten (shown with *) |
| Organic | Labeled organic (USDA, EU, etc.) |
| Vegan | Labeled vegan, **or** every ingredient is vegan (shown with *) |
| Dairy-free | Labeled dairy-free or vegan, **or** no milk in the ingredients (shown with *) |
| Non-GMO | Labeled Non-GMO |

- If the data lists gluten or milk as an allergen or "may contain", the product
  is left out of Gluten-free or Dairy-free, even if its name suggests otherwise.
- Tags marked with * are worked out from ingredients, not a label claim, so
  shoppers with allergies or celiac disease should still check the package.
- Products not in Open Food Facts fall back to the product name and say so.
- Lookups are cached in `.cache/openfoodfacts.json` (7 days, or 1 day for
  products not found) and kept under Open Food Facts' 100-per-minute limit.
- Open Food Facts asks apps to identify themselves. Set `OFF_USER_AGENT` in
  `.env` to your app name and a contact email.
- The data is under the Open Database License. Each product links to its
  Open Food Facts page as attribution.

How a Kroger code becomes a barcode: Kroger's 13-digit product codes leave off
the barcode's final check digit (`0001111041700`). `server.js` adds it back
(`0011110417008`) before the lookup.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Page layout and styles |
| `server.js` | Serves the app and calls the Kroger API (keeps keys private) |
| `.env.example` | Template for your Kroger keys |
| `app.js` | Search, filters, sorting, shopping list and basket comparison |
| `data/products.js` | Sample catalog: 5 stores, 12 item types, ~75 products |

## Adding more stores

`app.js` gets products through **providers** (`sampleProvider`,
`krogerProvider`). Each has a `search(query)` function that returns offers in
this shape:

```js
{ id, cat, name, brand, store, size, unit /* oz | floz | lb | ct | item */,
  price, wasPrice, tags /* ["gf", "organic", "vegan", "df", "ngmo"] */ }
```

To add a store, add a route to `server.js` that calls the store's API, and a
provider in `app.js` that calls that route. Store API keys must never be in
browser code.

Other data sources to look at:

- **Walmart affiliate / product APIs**: product and price data (requires approval).

## Next steps

1. Let shoppers pick which nearby stores to include.
2. Add a second real chain.
3. Allergen filters (peanuts, soy, eggs) using the same Open Food Facts data.
4. Price-drop alerts and saved dietary profiles.
