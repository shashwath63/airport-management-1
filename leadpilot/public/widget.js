/* LeadPilot AI chat widget — embed with:
   <script src="https://YOUR-DOMAIN/widget.js" data-bot="BOT_ID" defer></script> */
(function () {
  var script = document.currentScript || document.querySelector('script[data-bot]');
  if (!script) return;
  var botId = script.getAttribute('data-bot');
  var base = new URL(script.src).origin;
  var storeKey = 'leadpilot:' + botId;
  if (!botId || window['__leadpilot_' + botId]) return;
  window['__leadpilot_' + botId] = true;

  function load() { try { return JSON.parse(sessionStorage.getItem(storeKey)) || []; } catch (e) { return []; } }
  function save(m) { try { sessionStorage.setItem(storeKey, JSON.stringify(m.slice(-30))); } catch (e) {} }

  fetch(base + '/api/widget/' + encodeURIComponent(botId))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) { if (cfg) mount(cfg); })
    .catch(function () {});

  function mount(cfg) {
    var left = script.getAttribute('data-position') === 'left';
    var side = left ? 'left' : 'right';
    var chipAttr = script.getAttribute('data-chips');
    var chips = chipAttr ? chipAttr.split('|').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6)
      : ['💰 Prices', '🕒 Opening hours', '📅 Book an appointment'];
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;' + side + ':0;';
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    var c = cfg.color || '#4f46e5';
    root.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:normal;text-transform:none}' +
      'button,input{font-size:14px;line-height:normal;margin:0}' +
      'button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #2563eb;outline-offset:2px}' +
      '.bubble{position:fixed;bottom:20px;' + side + ':20px;width:60px;height:60px;border-radius:50%;background:' + c + ';border:0;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s;padding:0}' +
      '.bubble:hover{transform:scale(1.07)}.bubble svg{width:28px;height:28px;fill:#fff}' +
      '.badge{position:absolute;top:2px;' + side + ':2px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff}' +
      '.badge[hidden]{display:none}' +
      '.nudge{position:fixed;bottom:92px;' + side + ':20px;background:#fff;color:#111;padding:10px 14px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.18);font-size:14px;line-height:1.4;max-width:240px;cursor:pointer;border:0;text-align:left}' +
      '.nudge[hidden]{display:none}' +
      '.panel{position:fixed;bottom:92px;' + side + ':20px;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);background:#fff;color:#111;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}' +
      '.panel.open{display:flex;animation:pop .18s ease-out}' +
      '@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.head{background:' + c + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}' +
      '.head b{font-size:15px}.head small{display:block;opacity:.9;font-size:12px}' +
      '.x{background:none;border:0;color:#fff;font-size:24px;cursor:pointer;line-height:1;padding:2px 6px;border-radius:6px}' +
      '.x:focus-visible{outline-color:#fff}' +
      '.msgs{flex:1;overflow-y:auto;padding:14px;background:#f7f7f9;color:#111;display:flex;flex-direction:column;gap:8px}' +
      '.m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;color:#111}' +
      '.m.assistant{background:#fff;border:1px solid #e6e6ea;align-self:flex-start;border-bottom-left-radius:4px}' +
      '.m.user{background:' + c + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
      '.m a{color:inherit;text-decoration:underline}' +
      '.note{align-self:center;font-size:12px;color:#166534;background:#dcfce7;border-radius:999px;padding:4px 12px}' +
      '.chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start}' +
      '.chip{background:#fff;color:#111;border:1px solid ' + c + ';border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer}' +
      '.chip:hover{background:' + c + ';color:#fff}' +
      '.typing{align-self:flex-start;background:#fff;border:1px solid #e6e6ea;border-radius:14px;border-bottom-left-radius:4px;padding:11px 14px;display:flex;gap:4px}' +
      '.typing i{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:blink 1.2s infinite ease-in-out}' +
      '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}' +
      '@keyframes blink{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}' +
      'form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff;margin:0}' +
      'input{flex:1;min-width:0;border:1px solid #bbb;border-radius:10px;padding:10px 12px;color:#111;background:#fff}' +
      'input::placeholder{color:#6b7280}' +
      'button.send{background:' + c + ';color:#fff;border:0;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:600}' +
      'button.send:disabled{opacity:.5}' +
      '.brand{text-align:center;font-size:11px;color:#6b7280;padding:0 0 8px;background:#fff}.brand a{color:#6b7280}' +
      '@media (max-width:480px){.panel{' + side + ':8px;bottom:84px;width:calc(100vw - 16px);height:calc(100vh - 100px);height:calc(100dvh - 100px)}}' +
      '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.typing i{opacity:.7}}' +
      '</style>' +
      '<button class="nudge" hidden></button>' +
      '<div class="panel" role="dialog" aria-label="Chat with ' + esc(cfg.name) + '">' +
      '<div class="head"><div><b>' + esc(cfg.name) + '</b><small>● Online — replies instantly</small></div><button class="x" aria-label="Close chat">×</button></div>' +
      '<div class="msgs" role="log" aria-live="polite"></div>' +
      '<form><input placeholder="Type your message…" maxlength="1000" aria-label="Message"><button class="send">Send</button></form>' +
      (cfg.branding ? '<div class="brand">Powered by <a href="' + base + '" target="_blank" rel="noopener">LeadPilot AI</a></div>' : '') +
      '</div>' +
      '<button class="bubble" aria-label="Open chat" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.4 1.1 4.6 3 6.2L4 22l4.6-2.3c1.1.3 2.2.5 3.4.5 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg><span class="badge" hidden></span></button>';

    var panel = root.querySelector('.panel'), msgs = root.querySelector('.msgs'),
        form = root.querySelector('form'), input = root.querySelector('input'),
        send = root.querySelector('.send'), nudge = root.querySelector('.nudge'),
        bubble = root.querySelector('.bubble'), badge = root.querySelector('.badge');
    var history = load();
    var chipBox = null;

    function render() {
      msgs.innerHTML = '';
      add('assistant', cfg.greeting, true);
      history.forEach(function (m) { add(m.role, m.content, true); });
      if (!history.length && chips.length) {
        chipBox = document.createElement('div');
        chipBox.className = 'chips';
        chips.forEach(function (label) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'chip'; b.textContent = label;
          b.onclick = function () { submit(label); };
          chipBox.appendChild(b);
        });
        msgs.appendChild(chipBox);
      }
    }
    function add(role, text, silent) {
      var d = document.createElement('div');
      d.className = 'm ' + role;
      d.innerHTML = linkify(esc(text));
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      return d;
    }
    function isOpen() { return panel.classList.contains('open'); }
    function toggle(open, fromKey) {
      panel.classList.toggle('open', open);
      bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
      bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      nudge.hidden = true; badge.hidden = true;
      if (open) { input.focus(); msgs.scrollTop = msgs.scrollHeight; }
      else if (fromKey) { bubble.focus(); }
    }
    bubble.onclick = function () { toggle(!isOpen()); };
    root.querySelector('.x').onclick = function () { toggle(false, true); };
    nudge.onclick = function () { toggle(true); };
    root.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) { e.stopPropagation(); toggle(false, true); }
    });

    function submit(text) {
      text = (text || '').trim();
      if (!text || send.disabled) return;
      if (chipBox) { chipBox.remove(); chipBox = null; }
      history.push({ role: 'user', content: text });
      save(history);
      add('user', text);
      send.disabled = true;
      var t = document.createElement('div'); t.className = 'typing'; t.setAttribute('aria-label', 'Typing');
      t.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
      fetch(base + '/api/widget/' + encodeURIComponent(botId) + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, page_url: location.href })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var reply = d.reply || d.error || 'Sorry, something went wrong.';
          history.push({ role: 'assistant', content: reply });
          save(history);
          t.remove();
          add('assistant', reply);
          if (d.lead_captured) {
            var n = document.createElement('div'); n.className = 'note'; n.setAttribute('role', 'status');
            n.textContent = '✓ Details sent to the team'; msgs.appendChild(n);
            msgs.scrollTop = msgs.scrollHeight;
          }
        })
        .catch(function () { t.remove(); add('assistant', 'Connection problem — please try again.'); history.pop(); save(history); })
        .then(function () { t.remove(); send.disabled = false; if (isOpen()) input.focus(); });
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var text = input.value;
      if (!text.trim() || send.disabled) return;
      input.value = '';
      submit(text);
    };

    render();
    if (script.getAttribute('data-open') === 'true') toggle(true);
    else if (!history.length) {
      setTimeout(function () {
        if (!isOpen()) { nudge.textContent = cfg.greeting; nudge.hidden = false; badge.hidden = false; }
      }, 6000);
    }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function linkify(s) { return s.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
})();
