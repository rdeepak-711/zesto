# Task 25 — Embed Widget JS (`/public/widget.js`)

**Phase:** 5 — Analytics + Widget  
**Goal:** A self-contained JavaScript snippet that any bakery website can include with a single `<script>` tag. It renders a floating WhatsApp button that opens the bakery's WhatsApp number.

**Files created:**
- `public/widget.js`

---

- [ ] **Step 1: Write `public/widget.js`**

This file is served statically by Next.js from `/widget.js`.

```javascript
(function () {
  'use strict';

  // Read config from the script tag itself
  var scripts = document.getElementsByTagName('script');
  var thisScript = scripts[scripts.length - 1];
  var phone = thisScript.getAttribute('data-phone') ||
    (typeof ZESTO_PHONE !== 'undefined' ? ZESTO_PHONE : null);
  var message = thisScript.getAttribute('data-message') || 'Hi! I\'d like to place an order.';
  var position = thisScript.getAttribute('data-position') || 'bottom-right';

  if (!phone) {
    console.warn('[Zesto Widget] No WhatsApp number configured. Add data-phone="+91..." to the script tag.');
    return;
  }

  // Clean phone number
  var cleanPhone = phone.replace(/\D/g, '');

  // Build WhatsApp URL
  var waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message);

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '.zesto-widget-btn {',
    '  position: fixed;',
    '  z-index: 9999;',
    '  width: 56px;',
    '  height: 56px;',
    '  border-radius: 50%;',
    '  background: #25D366;',
    '  box-shadow: 0 4px 12px rgba(0,0,0,0.18);',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  cursor: pointer;',
    '  transition: transform 0.2s, box-shadow 0.2s;',
    '  text-decoration: none;',
    '}',
    '.zesto-widget-btn:hover {',
    '  transform: scale(1.08);',
    '  box-shadow: 0 6px 18px rgba(0,0,0,0.22);',
    '}',
    '.zesto-widget-btn svg { width: 32px; height: 32px; fill: #fff; }',
  ].join('');

  // Position
  var posMap = {
    'bottom-right': 'bottom:20px;right:20px;',
    'bottom-left':  'bottom:20px;left:20px;',
    'top-right':    'top:20px;right:20px;',
    'top-left':     'top:20px;left:20px;',
  };
  style.textContent += '.zesto-widget-btn{' + (posMap[position] || posMap['bottom-right']) + '}';

  document.head.appendChild(style);

  // WhatsApp SVG icon
  var svgIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
    '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475' +
    '-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52' +
    '.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207' +
    '-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372' +
    '-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2' +
    ' 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719' +
    ' 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
    '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.123 1.532 5.856L0 24l6.293-1.51' +
    'A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818' +
    'a9.818 9.818 0 01-5.006-1.372l-.36-.214-3.732.895.934-3.62-.234-.372' +
    'A9.77 9.77 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12' +
    ' 17.43 21.818 12 21.818z"/>' +
    '</svg>';

  // Create button
  var btn = document.createElement('a');
  btn.className = 'zesto-widget-btn';
  btn.href = waUrl;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.setAttribute('aria-label', 'Chat on WhatsApp');
  btn.innerHTML = svgIcon;

  document.body.appendChild(btn);
})();
```

- [ ] **Step 2: Verify the widget serves correctly**

```bash
npm run dev
```

```bash
curl http://localhost:3000/widget.js
```

Expected: Returns the JavaScript content with status 200.

- [ ] **Step 3: Test the widget on a sample HTML page**

Create a temporary test file (delete after verification):

```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
  <h1>My Bakery Website</h1>
  <p>Welcome to Sweet Crumbs!</p>

  <!-- Zesto embed widget -->
  <script src="http://localhost:3000/widget.js" data-phone="+919876543210"></script>
</body>
</html>
```

Open this HTML file directly in a browser (`File → Open File`). Expected: Green WhatsApp button appears in the bottom-right corner. Clicking it opens `https://wa.me/919876543210?text=Hi%21+I%27d+like+to+place+an+order.`

- [ ] **Step 4: Write the embed instructions snippet for clients**

This is the one-liner that bakery clients add to their website. Document it in a comment at the top of `widget.js`:

```javascript
// Zesto WhatsApp Order Widget
// Add this to your website's <body> tag:
//
//   <script src="https://YOUR-DEPLOYMENT.vercel.app/widget.js"
//           data-phone="+91XXXXXXXXXX"
//           data-message="Hi! I'd like to order."
//           data-position="bottom-right">
//   </script>
//
// data-phone     : Your WhatsApp Business number in E.164 format (required)
// data-message   : Pre-filled message when customer opens WhatsApp (optional)
// data-position  : Button position: bottom-right (default), bottom-left, top-right, top-left
```

- [ ] **Step 5: Commit**

```bash
git add public/widget.js
git commit -m "feat: add self-contained WhatsApp embed widget script"
```
