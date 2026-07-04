// A deliberately-inaccessible sample storefront so a visitor can see the scanner
// work in one click without pasting anything. Every failure here is real and
// axe-detectable: missing lang, no title, low-contrast text, an unlabelled
// checkout button, an image with no alt, an unlabelled quantity select, and an
// accessiBe overlay tag (so the overlay warning fires too).
export const SAMPLE_STORE_HTML = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, user-scalable=no">
  <script src="https://acsbapp.com/apps/app/dist/js/app.js"></script>
  <style>
    body { font-family: sans-serif; }
    .price { color: #b9b9b9; background: #ffffff; }   /* ~1.8:1 — fails contrast */
    .muted { color: #cfcfcf; background: #ffffff; }
    .buy { background: #2f6fed; color: #cfe0ff; border: 0; padding: 10px 16px; } /* low-contrast label */
  </style>
</head>
<body>
  <header><span>NOVA Store</span></header>
  <main>
    <img src="/product-hero.jpg">
    <h1>Linen Overshirt</h1>
    <p class="price">129.00 AZN</p>
    <p class="muted">Free delivery on orders over 50 AZN</p>
    <label>Quantity</label>
    <select><option>1</option><option>2</option><option>3</option></select>
    <button class="buy"></button>
    <a href="/cart" style="color:#7aa7ff">cart</a>
  </main>
</body>
</html>`;
