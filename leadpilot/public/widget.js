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
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;right:0;';
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    var c = cfg.color || '#4f46e5';
    root.innerHTML =
      '<style>' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '.bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:' + c + ';border:0;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
      '.bubble:hover{transform:scale(1.07)}.bubble svg{width:28px;height:28px;fill:#fff}' +
      '.nudge{position:fixed;bottom:92px;right:20px;background:#fff;color:#111;padding:10px 14px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.18);font-size:14px;max-width:240px;cursor:pointer}' +
      '.panel{position:fixed;bottom:92px;right:20px;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}' +
      '.panel.open{display:flex}' +
      '.head{background:' + c + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}' +
      '.head b{font-size:15px}.head small{display:block;opacity:.85;font-size:12px}' +
      '.x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}' +
      '.msgs{flex:1;overflow-y:auto;padding:14px;background:#f7f7f9;display:flex;flex-direction:column;gap:8px}' +
      '.m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;color:#111}' +
      '.m.assistant{background:#fff;border:1px solid #e6e6ea;align-self:flex-start;border-bottom-left-radius:4px}' +
      '.m.user{background:' + c + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
      '.m a{color:inherit}' +
      '.typing{align-self:flex-start;color:#888;font-size:13px;padding:4px 8px}' +
      'form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}' +
      'input{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;color:#111;background:#fff}' +
      'input:focus{border-color:' + c + '}' +
      'button.send{background:' + c + ';color:#fff;border:0;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:600}' +
      'button.send:disabled{opacity:.5}' +
      '.brand{text-align:center;font-size:11px;color:#999;padding:0 0 8px;background:#fff}.brand a{color:#999}' +
      '@media (max-width:480px){.panel{right:8px;bottom:84px;width:calc(100vw - 16px);height:calc(100vh - 100px)}}' +
      '</style>' +
      '<div class="nudge" hidden></div>' +
      '<div class="panel" role="dialog" aria-label="Chat with ' + esc(cfg.name) + '">' +
      '<div class="head"><div><b>' + esc(cfg.name) + '</b><small>● Online — replies instantly</small></div><button class="x" aria-label="Close">×</button></div>' +
      '<div class="msgs" aria-live="polite"></div>' +
      '<form><input placeholder="Type your message…" maxlength="1000" aria-label="Message"><button class="send">Send</button></form>' +
      (cfg.branding ? '<div class="brand">Powered by <a href="' + base + '" target="_blank" rel="noopener">LeadPilot AI</a></div>' : '') +
      '</div>' +
      '<button class="bubble" aria-label="Open chat"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.4 1.1 4.6 3 6.2L4 22l4.6-2.3c1.1.3 2.2.5 3.4.5 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg></button>';

    var panel = root.querySelector('.panel'), msgs = root.querySelector('.msgs'),
        form = root.querySelector('form'), input = root.querySelector('input'),
        send = root.querySelector('.send'), nudge = root.querySelector('.nudge');
    var history = load();

    function render() {
      msgs.innerHTML = '';
      add('assistant', cfg.greeting, true);
      history.forEach(function (m) { add(m.role, m.content, true); });
    }
    function add(role, text, silent) {
      var d = document.createElement('div');
      d.className = 'm ' + role;
      d.innerHTML = linkify(esc(text));
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      return d;
    }
    function toggle(open) {
      panel.classList.toggle('open', open);
      nudge.hidden = true;
      if (open) { input.focus(); msgs.scrollTop = msgs.scrollHeight; }
    }
    root.querySelector('.bubble').onclick = function () { toggle(!panel.classList.contains('open')); };
    root.querySelector('.x').onclick = function () { toggle(false); };
    nudge.onclick = function () { toggle(true); };

    form.onsubmit = function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || send.disabled) return;
      input.value = '';
      history.push({ role: 'user', content: text });
      save(history);
      add('user', text);
      send.disabled = true;
      var t = document.createElement('div'); t.className = 'typing'; t.textContent = 'typing…'; msgs.appendChild(t);
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
          add('assistant', reply);
        })
        .catch(function () { add('assistant', 'Connection problem — please try again.'); history.pop(); save(history); })
        .then(function () { t.remove(); send.disabled = false; input.focus(); });
    };

    render();
    if (!history.length) {
      setTimeout(function () {
        if (!panel.classList.contains('open')) { nudge.textContent = cfg.greeting; nudge.hidden = false; }
      }, 6000);
    }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function linkify(s) { return s.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
})();
