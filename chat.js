/* ARENSIL · burbuja de atención con el asistente del sitio.
   Autocontenido: inyecta sus estilos y su marcado, no depende de nada más.
   Habla con la función chat-soporte de Supabase; el visitante nunca toca la base. */
(function () {
  "use strict";
  if (window.__arensilChat) return;
  window.__arensilChat = true;

  var API = "https://pfsbltkdlnrkodvetfnu.supabase.co/functions/v1/chat-soporte";
  var KEY = "sb_publishable_D-anC38mBEtdn9mEoxLtiA_3wjan8v2";
  var WA = "https://wa.me/523223102049";
  var LS = "arensil_chat_token";
  var SS = "arensil_chat_abierto";
  var TOPE = 1200;

  function token() {
    var t = null;
    try { t = localStorage.getItem(LS); } catch (e) {}
    if (!t) {
      t = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem(LS, t); } catch (e) {}
    }
    return t;
  }
  var TOK = token();

  var css = ""
    + "#ar-chat-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:9px;"
    + "padding:13px 17px 13px 14px;border:0;border-radius:999px;cursor:pointer;font:600 15px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
    + "background:#8C4A22;color:#FFF;box-shadow:0 10px 30px rgba(28,26,23,.28);transition:transform .16s ease,background .16s ease}"
    + "#ar-chat-btn:hover{background:#7a3f1c;transform:translateY(-1px)}"
    + "#ar-chat-btn:focus-visible{outline:3px solid #C98A3C;outline-offset:3px}"
    + "#ar-chat-btn svg{width:20px;height:20px;flex:0 0 auto}"
    + "#ar-chat[hidden],#ar-chat-btn[hidden]{display:none!important}"
    + "#ar-chat{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:380px;max-width:calc(100vw - 24px);"
    + "height:min(620px,calc(100vh - 36px));display:flex;flex-direction:column;background:#FFF;color:#1C1A17;"
    + "border:1px solid #E3DED6;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(28,26,23,.30);"
    + "font:15px/1.6 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}"
    + "#ar-chat header{display:flex;align-items:center;gap:11px;padding:14px 14px 13px;background:#1C1A17;color:#F7F5F1}"
    + "#ar-chat header .ar-marca{width:34px;height:34px;border-radius:9px;background:#8C4A22;display:flex;align-items:center;justify-content:center;flex:0 0 auto}"
    + "#ar-chat header .ar-marca svg{width:19px;height:19px}"
    + "#ar-chat header b{display:block;font-size:.95rem;font-weight:650;letter-spacing:-.01em}"
    + "#ar-chat header span{display:block;font-size:.76rem;color:#B9B2A7}"
    + "#ar-chat header .ar-x{margin-left:auto;background:transparent;border:0;color:#EDE9E1;font-size:24px;line-height:1;"
    + "cursor:pointer;padding:4px 8px;border-radius:8px}"
    + "#ar-chat header .ar-x:hover{background:rgba(255,255,255,.12)}"
    + "#ar-log{flex:1;overflow-y:auto;padding:16px 14px 6px;background:#F7F5F1;scroll-behavior:smooth}"
    + ".ar-msg{max-width:86%;margin-bottom:12px;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;font-size:.92rem;line-height:1.58}"
    + ".ar-msg.ar-bot{background:#FFF;border:1px solid #E3DED6;border-bottom-left-radius:5px}"
    + ".ar-msg.ar-yo{background:#8C4A22;color:#FFF;margin-left:auto;border-bottom-right-radius:5px}"
    + ".ar-msg a{color:inherit;text-decoration:underline}"
    + ".ar-msg.ar-bot a{color:#8C4A22}"
    + ".ar-sug{display:flex;flex-wrap:wrap;gap:7px;padding:0 14px 12px;background:#F7F5F1}"
    + ".ar-sug button{background:#FFF;border:1px solid #E3DED6;border-radius:999px;padding:7px 12px;font-size:.82rem;"
    + "color:#3A352E;cursor:pointer;font-family:inherit}"
    + ".ar-sug button:hover{border-color:#C98A3C;color:#8C4A22}"
    + "#ar-pie{border-top:1px solid #E3DED6;background:#FFF;padding:10px 12px 11px}"
    + "#ar-form{display:flex;gap:8px;align-items:flex-end}"
    + "#ar-txt{flex:1;resize:none;border:1px solid #E3DED6;border-radius:12px;padding:10px 12px;font:inherit;font-size:.92rem;"
    + "max-height:110px;min-height:42px;color:#1C1A17;background:#FFF}"
    + "#ar-txt:focus{outline:2px solid #C98A3C;outline-offset:0;border-color:#C98A3C}"
    + "#ar-env{flex:0 0 auto;width:42px;height:42px;border:0;border-radius:12px;background:#8C4A22;color:#FFF;cursor:pointer;"
    + "display:flex;align-items:center;justify-content:center}"
    + "#ar-env:disabled{opacity:.45;cursor:default}"
    + "#ar-env svg{width:18px;height:18px}"
    + "#ar-pie small{display:block;margin-top:8px;font-size:.72rem;color:#6F6A62;text-align:center}"
    + "#ar-pie small a{color:#8C4A22}"
    + ".ar-esc{display:flex;gap:4px;padding:4px 2px}"
    + ".ar-esc i{width:6px;height:6px;border-radius:50%;background:#B9B2A7;display:block;animation:ar-lat 1.1s infinite}"
    + ".ar-esc i:nth-child(2){animation-delay:.16s}.ar-esc i:nth-child(3){animation-delay:.32s}"
    + "@keyframes ar-lat{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}"
    + "@media (max-width:520px){#ar-chat{right:0;bottom:0;width:100%;max-width:100%;height:100dvh;border-radius:0;border:0}"
    + "#ar-chat-btn{right:14px;bottom:14px;padding:12px 15px 12px 13px}#ar-chat-btn .ar-eti{display:none}}"
    + "@media (prefers-reduced-motion:reduce){#ar-chat-btn,.ar-esc i{transition:none;animation:none}}";

  var CRISTAL = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.2 21 8v8l-9 5.8L3 16V8l9-5.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 2.2v19.6M3 8l9 4.6L21 8" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" opacity=".75"/></svg>';
  var GLOBO = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3.5 20.5l1.4-5.9A8 8 0 1 1 21 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  var AVION = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.4 11.4 20 4l-7.4 16.6-2.2-6.9-7-2.3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  var SUGERENCIAS = ["¿Qué malla necesito?", "Precio y flete a mi zona", "Arena para filtro de alberca", "Quiero una cotización"];
  var SALUDO = "Buen día. Soy el asistente de ARENSIL. Le puedo decir qué malla necesita su proceso, el precio de lista y el flete a su zona, y cómo comprar en línea. ¿En qué le ayudo?";

  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.id = "ar-chat-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir el chat de atención de ARENSIL");
  btn.innerHTML = GLOBO + '<span class="ar-eti">Atención</span>';

  var caja = document.createElement("div");
  caja.id = "ar-chat";
  caja.hidden = true;
  caja.setAttribute("role", "dialog");
  caja.setAttribute("aria-label", "Chat de atención de ARENSIL");
  caja.innerHTML = ""
    + '<header><span class="ar-marca">' + CRISTAL + "</span>"
    + "<span><b>Atención ARENSIL</b><span>Arena sílica · Lagos de Moreno, Jal.</span></span>"
    + '<button class="ar-x" type="button" aria-label="Cerrar el chat">&times;</button></header>'
    + '<div id="ar-log" role="log" aria-live="polite"></div>'
    + '<div class="ar-sug" id="ar-sug"></div>'
    + '<div id="ar-pie"><form id="ar-form" autocomplete="off">'
    + '<label for="ar-txt" style="position:absolute;left:-9999px">Escriba su mensaje</label>'
    + '<textarea id="ar-txt" rows="1" maxlength="' + TOPE + '" placeholder="Escriba su pregunta…"></textarea>'
    + '<button id="ar-env" type="submit" aria-label="Enviar">' + AVION + "</button></form>"
    + '<small>Le responde un asistente automático. Para algo urgente, <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp 322 310 2049</a>.</small></div>';

  document.body.appendChild(btn);
  document.body.appendChild(caja);

  var log = caja.querySelector("#ar-log");
  var sug = caja.querySelector("#ar-sug");
  var form = caja.querySelector("#ar-form");
  var txt = caja.querySelector("#ar-txt");
  var env = caja.querySelector("#ar-env");
  var cerrado = false;

  function escapa(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function enlaza(s) {
    return escapa(s)
      .replace(/\b(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\b(arensil\.com[\w\/#.-]*)/g, '<a href="https://$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\b322 310 2049\b/g, '<a href="' + WA + '" target="_blank" rel="noopener">322 310 2049</a>');
  }
  function pinta(rol, texto) {
    var d = document.createElement("div");
    d.className = "ar-msg " + (rol === "yo" ? "ar-yo" : "ar-bot");
    d.innerHTML = rol === "yo" ? escapa(texto) : enlaza(texto);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function esperando() {
    var d = document.createElement("div");
    d.className = "ar-msg ar-bot";
    d.innerHTML = '<span class="ar-esc"><i></i><i></i><i></i></span>';
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function pintaSugerencias(lista) {
    sug.innerHTML = "";
    if (!lista || !lista.length || cerrado) return;
    lista.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = s;
      b.addEventListener("click", function () { manda(s); });
      sug.appendChild(b);
    });
  }

  var ocupado = false;
  function manda(texto) {
    texto = String(texto || "").trim().slice(0, TOPE);
    if (!texto || ocupado || cerrado) return;
    ocupado = true;
    env.disabled = true;
    txt.value = "";
    txt.style.height = "";
    pinta("yo", texto);
    pintaSugerencias(null);
    var esp = esperando();

    var ctrl = null, corta = null;
    try { ctrl = new AbortController(); corta = setTimeout(function () { ctrl.abort(); }, 45000); } catch (e) {}

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify({ token: TOK, mensaje: texto, origen: location.pathname }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (corta) clearTimeout(corta);
      esp.remove();
      pinta("bot", d.respuesta || "No pude responderle en este momento. Escríbanos por WhatsApp al 322 310 2049.");
      if (d.cerrado) { cerrado = true; txt.disabled = true; txt.placeholder = "Conversación cerrada"; }
    }).catch(function () {
      if (corta) clearTimeout(corta);
      esp.remove();
      pinta("bot", "Se me cayó la conexión. Vuelva a intentar o escríbanos por WhatsApp al 322 310 2049.");
    }).then(function () {
      ocupado = false;
      env.disabled = false;
      if (!cerrado) txt.focus();
    });
  }

  var arrancado = false;
  function abre() {
    caja.hidden = false;
    btn.hidden = true;
    try { sessionStorage.setItem(SS, "1"); } catch (e) {}
    if (!arrancado) { arrancado = true; pinta("bot", SALUDO); pintaSugerencias(SUGERENCIAS); }
    setTimeout(function () { if (!cerrado) txt.focus(); }, 60);
  }
  function cierra() {
    caja.hidden = true;
    btn.hidden = false;
    try { sessionStorage.removeItem(SS); } catch (e) {}
    btn.focus();
  }

  btn.addEventListener("click", abre);
  caja.querySelector(".ar-x").addEventListener("click", cierra);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !caja.hidden) cierra(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); manda(txt.value); });
  txt.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); manda(txt.value); }
  });
  txt.addEventListener("input", function () {
    txt.style.height = "auto";
    txt.style.height = Math.min(txt.scrollHeight, 110) + "px";
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-arensil-chat]") : null;
    if (t) { e.preventDefault(); abre(); }
  });

  try { if (sessionStorage.getItem(SS) === "1") abre(); } catch (e) {}
})();
