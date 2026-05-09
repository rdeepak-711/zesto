(function () {
  var script = document.currentScript || document.querySelector('script[data-zesto]');
  var phone = (script && script.getAttribute('data-phone')) || '';
  var label = (script && script.getAttribute('data-label')) || 'Order via WhatsApp';
  var color = (script && script.getAttribute('data-color')) || '#25D366';

  if (!phone) return;

  var btn = document.createElement('a');
  btn.href = 'https://wa.me/' + phone.replace(/[^0-9]/g, '');
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.setAttribute('aria-label', label);

  btn.style.cssText = [
    'position:fixed',
    'bottom:20px',
    'right:20px',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'background:' + color,
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:14px',
    'font-weight:600',
    'padding:12px 18px',
    'border-radius:999px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
    'text-decoration:none',
    'transition:transform 0.15s,box-shadow 0.15s',
  ].join(';');

  // WhatsApp SVG icon
  var icon = document.createElement('span');
  icon.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.52 3.658 1.424 5.168L2 22l4.979-1.376A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.03-1.09l-.29-.17-2.955.818.79-2.882-.19-.3A7.97 7.97 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8zm4.406-5.845c-.242-.12-1.432-.706-1.654-.787-.222-.08-.383-.12-.545.12-.16.242-.624.787-.765.948-.14.16-.282.18-.523.06-.242-.12-1.02-.376-1.942-1.198-.717-.64-1.202-1.43-1.342-1.672-.14-.242-.015-.373.105-.493.108-.108.242-.282.363-.423.12-.14.16-.242.242-.403.08-.16.04-.302-.02-.423-.06-.12-.545-1.312-.747-1.796-.196-.47-.397-.406-.545-.414l-.464-.008c-.16 0-.423.06-.645.302-.222.242-.847.827-.847 2.016 0 1.19.868 2.34.988 2.502.12.16 1.707 2.607 4.137 3.555.578.199 1.03.318 1.38.407.58.147 1.108.126 1.526.077.465-.056 1.432-.585 1.634-1.15.2-.565.2-1.049.14-1.15-.06-.1-.222-.16-.464-.282z"/>' +
    '</svg>';

  var text = document.createElement('span');
  text.textContent = label;

  btn.appendChild(icon);
  btn.appendChild(text);

  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 24px rgba(0,0,0,0.22)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
  });

  document.body.appendChild(btn);
})();
