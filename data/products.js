// Sample catalog for the prototype. All stores, brands and prices are made up.
// Real store data replaces this through a provider in app.js (see README).
(function () {
  const stores = [
    { id: "hf", name: "Harbor Foods", miles: 0.6 },
    { id: "bw", name: "Brightway Grocery", miles: 1.2 },
    { id: "vc", name: "ValuCart", miles: 2.8 },
    { id: "gl", name: "Greenleaf Market", miles: 3.5 },
    { id: "pp", name: "Penny Pantry", miles: 4.1 },
  ];

  const categories = {
    milk: { label: "Milk", kw: "dairy" },
    bread: { label: "Bread", kw: "loaf toast sandwich" },
    pasta: { label: "Pasta", kw: "noodles spaghetti penne rotini" },
    pb: { label: "Peanut butter", kw: "pb spread nut" },
    eggs: { label: "Eggs", kw: "egg dozen" },
    cereal: { label: "Cereal", kw: "breakfast granola" },
    bananas: { label: "Bananas", kw: "banana fruit produce" },
    chicken: { label: "Chicken breast", kw: "poultry meat protein" },
    yogurt: { label: "Yogurt", kw: "greek dairy" },
    coffee: { label: "Coffee", kw: "ground roast beans" },
    rice: { label: "Rice", kw: "grain jasmine basmati" },
    spinach: { label: "Spinach", kw: "salad greens produce leafy" },
  };

  // [category, name, brand, store, size, unit, price, wasPrice, tags]
  // units: floz, oz, lb, ct   tags: gf organic vegan df ngmo
  const rows = [
    ["milk", "Whole Milk", "ValuCart Basics", "vc", 128, "floz", 3.29, null, "gf"],
    ["milk", "Whole Milk", "Brightway", "bw", 128, "floz", 3.79, null, "gf"],
    ["milk", "Whole Milk", "Harbor Dairy", "hf", 128, "floz", 3.99, 4.49, "gf"],
    ["milk", "Whole Milk", "Penny Pantry", "pp", 128, "floz", 3.09, null, "gf"],
    ["milk", "Organic Whole Milk", "Meadowcrest", "gl", 64, "floz", 5.49, null, "gf organic"],
    ["milk", "Organic Whole Milk", "Meadowcrest", "bw", 64, "floz", 5.19, null, "gf organic"],
    ["milk", "Unsweetened Almond Milk", "Silverbrook", "vc", 64, "floz", 2.79, null, "gf vegan df ngmo"],
    ["milk", "Organic Oat Milk", "Fieldhouse", "gl", 64, "floz", 4.99, null, "organic vegan df ngmo"],
    ["milk", "Lactose-Free 2% Milk", "Harbor Dairy", "hf", 52, "floz", 4.29, null, "gf"],

    ["bread", "White Sandwich Bread", "ValuCart Basics", "vc", 20, "oz", 1.49, null, "vegan"],
    ["bread", "White Sandwich Bread", "Penny Pantry", "pp", 20, "oz", 1.29, null, "vegan"],
    ["bread", "100% Whole Wheat Bread", "Hearthstone", "bw", 24, "oz", 3.49, null, "vegan ngmo"],
    ["bread", "100% Whole Wheat Bread", "Hearthstone", "hf", 24, "oz", 3.79, null, "vegan ngmo"],
    ["bread", "Organic Sprouted Grain Bread", "Seedling Bakery", "gl", 24, "oz", 5.99, null, "organic vegan ngmo"],
    ["bread", "Gluten-Free Multigrain Bread", "Clearfield", "gl", 18, "oz", 6.49, null, "gf df ngmo"],
    ["bread", "Gluten-Free White Bread", "Clearfield", "bw", 18, "oz", 5.99, 6.79, "gf df"],
    ["bread", "Gluten-Free Sandwich Bread", "ValuCart Free From", "vc", 15, "oz", 4.49, null, "gf df"],

    ["pasta", "Spaghetti", "Penny Pantry", "pp", 16, "oz", 0.89, null, "vegan"],
    ["pasta", "Spaghetti", "ValuCart Basics", "vc", 16, "oz", 0.99, null, "vegan"],
    ["pasta", "Spaghetti", "Romano Fratelli", "bw", 16, "oz", 1.79, null, "vegan ngmo"],
    ["pasta", "Penne Rigate", "Romano Fratelli", "hf", 16, "oz", 1.89, 2.29, "vegan ngmo"],
    ["pasta", "Organic Whole Wheat Penne", "Terra Verde", "gl", 16, "oz", 2.99, null, "organic vegan ngmo"],
    ["pasta", "Chickpea Rotini", "Pulse Kitchen", "bw", 8, "oz", 3.49, null, "gf vegan df ngmo"],
    ["pasta", "Brown Rice Spaghetti", "Terra Verde", "gl", 12, "oz", 3.79, null, "gf organic vegan df"],
    ["pasta", "Gluten-Free Corn & Rice Penne", "ValuCart Free From", "vc", 12, "oz", 2.19, null, "gf vegan df"],
    ["pasta", "Red Lentil Penne", "Pulse Kitchen", "hf", 8, "oz", 3.29, null, "gf vegan df ngmo"],

    ["pb", "Creamy Peanut Butter", "Penny Pantry", "pp", 16, "oz", 1.99, null, "gf vegan df"],
    ["pb", "Creamy Peanut Butter", "ValuCart Basics", "vc", 40, "oz", 4.79, null, "gf vegan df"],
    ["pb", "Creamy Peanut Butter", "Golden Acre", "bw", 16, "oz", 3.29, null, "gf vegan df"],
    ["pb", "Organic Crunchy Peanut Butter", "Hillside Organics", "gl", 16, "oz", 4.99, null, "gf organic vegan df ngmo"],
    ["pb", "Natural Peanut Butter", "Golden Acre", "hf", 28, "oz", 5.49, 6.29, "gf vegan df ngmo"],

    ["eggs", "Large White Eggs", "ValuCart Basics", "vc", 12, "ct", 2.49, null, "gf df"],
    ["eggs", "Large White Eggs", "Penny Pantry", "pp", 18, "ct", 3.39, null, "gf df"],
    ["eggs", "Large Brown Eggs", "Sunny Ridge", "bw", 12, "ct", 3.99, null, "gf df"],
    ["eggs", "Cage-Free Large Eggs", "Sunny Ridge", "hf", 12, "ct", 4.29, null, "gf df"],
    ["eggs", "Organic Pasture-Raised Eggs", "Meadowcrest", "gl", 12, "ct", 6.99, null, "gf df organic ngmo"],
    ["eggs", "Organic Free-Range Eggs", "Meadowcrest", "bw", 12, "ct", 5.79, 6.49, "gf df organic"],

    ["cereal", "Toasted Oat O's", "ValuCart Basics", "vc", 12, "oz", 1.99, null, "vegan"],
    ["cereal", "Honey Oat Flakes", "Penny Pantry", "pp", 14, "oz", 2.29, null, ""],
    ["cereal", "Toasted Oat O's", "Morning Mill", "bw", 12, "oz", 3.99, null, "vegan"],
    ["cereal", "Organic Ancient Grain Flakes", "Hillside Organics", "gl", 10, "oz", 4.79, null, "organic vegan ngmo"],
    ["cereal", "Gluten-Free Crispy Rice", "Morning Mill", "hf", 11, "oz", 3.89, null, "gf vegan df"],
    ["cereal", "Gluten-Free Granola", "Clearfield", "gl", 11, "oz", 5.49, null, "gf ngmo"],

    ["bananas", "Bananas", "Fresh produce", "pp", 1, "lb", 0.49, null, "gf vegan df"],
    ["bananas", "Bananas", "Fresh produce", "vc", 1, "lb", 0.52, null, "gf vegan df"],
    ["bananas", "Bananas", "Fresh produce", "bw", 1, "lb", 0.59, null, "gf vegan df"],
    ["bananas", "Bananas", "Fresh produce", "hf", 1, "lb", 0.65, null, "gf vegan df"],
    ["bananas", "Organic Bananas", "Fresh produce", "gl", 1, "lb", 0.79, null, "gf vegan df organic"],
    ["bananas", "Organic Bananas", "Fresh produce", "bw", 1, "lb", 0.75, null, "gf vegan df organic"],

    ["chicken", "Boneless Skinless Chicken Breast", "ValuCart Basics", "vc", 1, "lb", 2.99, null, "gf df"],
    ["chicken", "Boneless Skinless Chicken Breast", "Penny Pantry", "pp", 1, "lb", 2.79, null, "gf df"],
    ["chicken", "Boneless Skinless Chicken Breast", "Brightway", "bw", 1, "lb", 3.49, 3.99, "gf df"],
    ["chicken", "Boneless Skinless Chicken Breast", "Harbor Foods", "hf", 1, "lb", 3.99, null, "gf df"],
    ["chicken", "Organic Air-Chilled Chicken Breast", "Meadowcrest", "gl", 1, "lb", 8.99, null, "gf df organic ngmo"],
    ["chicken", "Organic Chicken Breast", "Meadowcrest", "bw", 1, "lb", 7.99, null, "gf df organic"],

    ["yogurt", "Plain Greek Yogurt", "ValuCart Basics", "vc", 32, "oz", 3.99, null, "gf"],
    ["yogurt", "Plain Greek Yogurt", "Penny Pantry", "pp", 32, "oz", 3.79, null, "gf"],
    ["yogurt", "Plain Greek Yogurt", "Olympus Farms", "bw", 32, "oz", 5.99, null, "gf"],
    ["yogurt", "Plain Greek Yogurt", "Olympus Farms", "hf", 32, "oz", 5.49, 6.49, "gf"],
    ["yogurt", "Organic Plain Greek Yogurt", "Meadowcrest", "gl", 32, "oz", 6.99, null, "gf organic"],
    ["yogurt", "Plain Coconut Yogurt", "Island Grove", "gl", 16, "oz", 5.49, null, "gf vegan df"],

    ["coffee", "Medium Roast Ground Coffee", "Penny Pantry", "pp", 12, "oz", 4.99, null, "gf vegan df"],
    ["coffee", "Medium Roast Ground Coffee", "ValuCart Basics", "vc", 12, "oz", 5.49, null, "gf vegan df"],
    ["coffee", "Medium Roast Ground Coffee", "ValuCart Basics", "vc", 30.5, "oz", 10.99, null, "gf vegan df"],
    ["coffee", "Colombian Ground Coffee", "Ridgeline Roasters", "bw", 12, "oz", 8.99, 10.49, "gf vegan df"],
    ["coffee", "French Roast Ground Coffee", "Ridgeline Roasters", "hf", 12, "oz", 9.49, null, "gf vegan df"],
    ["coffee", "Organic Fair Trade Ground Coffee", "Hillside Organics", "gl", 12, "oz", 10.99, null, "gf vegan df organic ngmo"],

    ["rice", "Long Grain White Rice", "Penny Pantry", "pp", 32, "oz", 1.69, null, "gf vegan df"],
    ["rice", "Jasmine Rice", "ValuCart Basics", "vc", 80, "oz", 5.99, null, "gf vegan df"],
    ["rice", "Basmati Rice", "Spice Route", "bw", 32, "oz", 4.49, null, "gf vegan df ngmo"],
    ["rice", "Jasmine Rice", "Spice Route", "hf", 32, "oz", 3.99, 4.79, "gf vegan df"],
    ["rice", "Organic Brown Rice", "Terra Verde", "gl", 32, "oz", 4.29, null, "gf vegan df organic"],

    ["spinach", "Baby Spinach", "ValuCart Basics", "vc", 5, "oz", 1.99, null, "gf vegan df"],
    ["spinach", "Baby Spinach", "Fresh produce", "bw", 5, "oz", 2.49, null, "gf vegan df"],
    ["spinach", "Baby Spinach", "Penny Pantry", "pp", 10, "oz", 2.99, null, "gf vegan df"],
    ["spinach", "Organic Baby Spinach", "Greenleaf", "gl", 5, "oz", 3.29, null, "gf vegan df organic"],
    ["spinach", "Organic Baby Spinach", "Harbor Foods", "hf", 10, "oz", 4.99, null, "gf vegan df organic"],
  ];

  const offers = rows.map((r, i) => ({
    id: "s" + i,
    cat: r[0],
    name: r[1],
    brand: r[2],
    store: r[3],
    size: r[4],
    unit: r[5],
    price: r[6],
    wasPrice: r[7],
    tags: r[8] ? r[8].split(" ") : [],
  }));

  // Allergens for the sample products (made up, like the rest of this file).
  // Keys: peanuts treenuts milk eggs soy gluten fish shellfish sesame
  const byCategory = {
    milk: "milk", bread: "gluten soy", pasta: "gluten", pb: "peanuts", eggs: "eggs",
    cereal: "gluten", bananas: "", chicken: "", yogurt: "milk", coffee: "", rice: "", spinach: "",
  };
  const byName = [
    [/almond/i, "treenuts", ""],
    [/oat milk/i, "", "gluten"],
    [/gluten-free (multigrain|white) bread/i, "eggs", "sesame"],
    [/gluten-free sandwich bread/i, "eggs soy", ""],
    [/chickpea|lentil|brown rice|corn & rice/i, "", ""],
    [/honey oat/i, "gluten milk", ""],
    [/toasted oat/i, "gluten", "soy"],
    [/crispy rice/i, "", "peanuts treenuts"],
    [/granola/i, "treenuts", "peanuts"],
    [/coconut yogurt/i, "", "treenuts"],
    [/peanut butter/i, "peanuts", "treenuts"],
  ];
  offers.forEach((o) => {
    const rule = byName.find(([re]) => re.test(o.name));
    const contains = rule ? rule[1] : byCategory[o.cat];
    const may = rule ? rule[2] : "";
    o.contains = contains ? contains.split(" ") : [];
    o.mayContain = may ? may.split(" ") : [];
  });

  window.SHELF_DATA = { stores, categories, offers };
})();
