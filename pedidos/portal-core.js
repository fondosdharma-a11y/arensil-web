// ARENSIL · Portal de pedidos — núcleo: sesión, perfil, navegación y datos base.
const SB_URL = "https://pfsbltkdlnrkodvetfnu.supabase.co";
const SB_KEY = "sb_publishable_D-anC38mBEtdn9mEoxLtiA_3wjan8v2";
const FN = SB_URL + "/functions/v1";
const sb = supabase.createClient(SB_URL, SB_KEY);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const mx = n => "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = n => (Number(n) || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoyMas = d => { const f = new Date(); f.setDate(f.getDate() + d); return f.toISOString().slice(0, 10); };

const PRES = { granel_ton: "Granel · tonelada", saco_25kg: "Saco 25 kg", saco_50kg: "Saco 50 kg", supersaco_1t: "Súper saco 1 t" };
const EST_PED = {
  borrador: ["Borrador", ""], pendiente_pago: ["Esperando pago", "warn"], pagado: ["Pagado", "ok"],
  en_preparacion: ["En preparación", "ok"], en_ruta: ["En ruta", "ok"],
  entregado: ["Entregado", "ok"], cancelado: ["Cancelado", "bad"]
};
const FREC = { semanal: "Cada semana", quincenal: "Cada quince días", mensual: "Cada mes", bimestral: "Cada dos meses" };

const D = { perfil: null, cuenta: null, productos: [], zonas: [], direcciones: [], pedidos: [], programaciones: [], vendedor: null, comisiones: [] };
let CARRITO = [];

function aviso(sel, texto, tipo = "err") {
  const el = $(sel);
  if (!texto) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="aviso ${tipo}">${esc(texto)}</div>`;
}

// ---------------------------------------------------------------- modal
function abrirModal(html) {
  $("#modal-body").innerHTML = html;
  $("#modal").classList.remove("hide");
  const f = $("#modal-body input, #modal-body select"); if (f) f.focus();
}
function cerrarModal() { $("#modal").classList.add("hide"); $("#modal-body").innerHTML = ""; }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") cerrarModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });
const opt = (arr, val, txt, sel) => arr.map(x => `<option value="${x[val]}"${sel === x[val] ? " selected" : ""}>${esc(x[txt])}</option>`).join("");

// ---------------------------------------------------------------- acceso
const params = new URLSearchParams(location.search);
// Pedido que viene del cotizador público de la portada (?producto=&cantidad=&zona=)
const PRE_KEY = "arensil_pre";
try {
  if (params.get("producto")) localStorage.setItem(PRE_KEY, JSON.stringify({ producto_id: Number(params.get("producto")), cantidad: Number(params.get("cantidad")) || 0, zona: Number(params.get("zona")) || null }));
} catch {}
const REF_KEY = "arensil_ref";
let REF = (params.get("ref") || "").trim().toUpperCase();
try {
  if (REF) localStorage.setItem(REF_KEY, REF);
  else REF = localStorage.getItem(REF_KEY) || "";
} catch { /* almacenamiento bloqueado: seguimos sin referido */ }

// Acceso con Google, Facebook o X. Supabase regresa a esta misma página con la sesión lista.
// Solo mostramos los botones de los proveedores que ya están activados en Supabase.
(async () => {
  try {
    const r = await fetch(SB_URL + "/auth/v1/settings", { headers: { apikey: SB_KEY } });
    const ext = (await r.json()).external || {};
    let activos = 0;
    $$("#social [data-prov]").forEach(b => { const on = !!ext[b.dataset.prov]; b.classList.toggle("hide", !on); if (on) activos++; });
    if (!activos) { $("#social").classList.add("hide"); $$(".sep").forEach(x => x.classList.add("hide")); }
  } catch { /* si no se puede consultar, dejamos los botones */ }
})();
$$("#social [data-prov]").forEach(b => b.onclick = async () => {
  aviso("#acc-msg", "");
  b.disabled = true;
  const redirectTo = location.origin + location.pathname;
  const { error } = await sb.auth.signInWithOAuth({ provider: b.dataset.prov, options: { redirectTo } });
  if (error) {
    b.disabled = false;
    aviso("#acc-msg", "No pudimos conectar con ese servicio: " + error.message);
  }
});

$("#pest").onclick = e => {
  const b = e.target.closest("button[data-p]"); if (!b) return;
  $$("#pest button").forEach(x => x.setAttribute("aria-current", x === b));
  $("#p-entrar").classList.toggle("hide", b.dataset.p !== "entrar");
  $("#p-registro").classList.toggle("hide", b.dataset.p !== "registro");
  aviso("#acc-msg", "");
};

$("#e-go").onclick = async () => {
  aviso("#acc-msg", "");
  const { error } = await sb.auth.signInWithPassword({
    email: $("#e-mail").value.trim(), password: $("#e-pass").value
  });
  if (error) return aviso("#acc-msg", "No pudimos entrar: " + error.message);
  location.reload();
};

$("#r-go").onclick = async () => {
  aviso("#acc-msg", "");
  const empresa = $("#r-empresa").value.trim();
  const email = $("#r-mail").value.trim();
  const pass = $("#r-pass").value;
  if (!empresa) return aviso("#acc-msg", "Escribe el nombre de tu empresa.");
  if (!email) return aviso("#acc-msg", "Escribe tu correo.");
  if (pass.length < 8) return aviso("#acc-msg", "La contraseña necesita al menos 8 caracteres.");

  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: {
      emailRedirectTo: location.origin + location.pathname,
      data: {
        empresa, nombre: $("#r-nombre").value.trim(), telefono: $("#r-tel").value.trim(),
        municipio: $("#r-muni").value.trim(), estado: $("#r-edo").value.trim() || "Jalisco",
        ref: REF || null
      }
    }
  });
  if (error) return aviso("#acc-msg", "No pudimos crear la cuenta: " + error.message);
  try { localStorage.removeItem(REF_KEY); } catch {}
  if (!data.session) return aviso("#acc-msg", "Cuenta creada. Revisa tu correo para confirmarla y luego entra.", "ok");
  location.reload();
};

$("#salir").onclick = async () => { await sb.auth.signOut(); location.href = location.pathname; };

$("#tabs").onclick = e => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  irA(b.dataset.v);
};
function irA(v) {
  $$("#tabs button").forEach(x => x.setAttribute("aria-current", x.dataset.v === v));
  $$("main > section").forEach(s => s.classList.add("hide"));
  $("#v-" + v).classList.remove("hide");
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------- arranque
async function arrancar() {
  const { data: { session } } = await sb.auth.getSession();
  if (location.hash && /access_token|error/.test(location.hash)) history.replaceState({}, "", location.pathname + location.search);
  if (!session) {
    $("#acceso").classList.remove("hide");
    if (REF) {
      $$("#pest button").forEach(x => x.setAttribute("aria-current", x.dataset.p === "registro"));
      $("#p-entrar").classList.add("hide");
      $("#p-registro").classList.remove("hide");
      const a = $("#ref-aviso");
      a.textContent = "Vienes recomendado por un asesor de ARENSIL. Tu cuenta quedará ligada a él.";
      a.classList.remove("hide");
    }
    return;
  }
  await cargar(session.user);
}

async function cargar(user) {
  const { data: perfil } = await sb.from("perfiles").select("*").eq("id", user.id).single();
  D.perfil = perfil || { id: user.id, rol: "cliente", email: user.email };

  if (D.perfil.rol === "admin") {
    $("#acceso").classList.remove("hide");
    $("#social").classList.add("hide"); $("#pest").classList.add("hide");
    $("#p-entrar").classList.add("hide"); $("#p-registro").classList.add("hide");
    $$(".sep").forEach(x => x.classList.add("hide"));
    aviso("#acc-msg", "Esta cuenta es de administración. Entra al CRM en crm.arensil.com — te llevamos en un momento.", "ok");
    await sb.auth.signOut();
    setTimeout(() => location.href = "https://crm.arensil.com/", 2500);
    return;
  }

  // Referido pendiente (viene de un registro con Google/Facebook/X)
  if (REF && !D.perfil.vendedor_id) {
    await sb.rpc("vincular_referido", { p_codigo: REF });
  }
  try { localStorage.removeItem(REF_KEY); } catch {}

  $("#app").classList.remove("hide");
  $("#acceso").classList.add("hide");

  const [prod, zon, cta, dirs] = await Promise.all([
    sb.from("catalogo").select("*").order("id"),
    sb.from("zonas_publicas").select("*").order("km_desde_lagos"),
    D.perfil.cuenta_id ? sb.from("mi_cuenta_v").select("*").single() : Promise.resolve({ data: null }),
    D.perfil.cuenta_id ? sb.from("direcciones").select("*").eq("cuenta_id", D.perfil.cuenta_id).order("principal", { ascending: false }) : Promise.resolve({ data: [] })
  ]);
  D.productos = prod.data || []; D.zonas = zon.data || [];
  D.cuenta = cta.data || null; D.direcciones = dirs.data || [];

  // Quien entra con Google/Facebook/X llega sin empresa ni municipio: lo pedimos una sola vez.
  if (D.cuenta && !D.cuenta.municipio) { mostrarCompletarEmpresa(); return; }

  const avatar = D.perfil.avatar_url ? `<img src="${esc(D.perfil.avatar_url)}" alt="" referrerpolicy="no-referrer" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px">` : "";
  $("#who").innerHTML = `${avatar}<strong>${esc(D.cuenta?.nombre || D.perfil.email)}</strong><br>${esc(D.perfil.email || "")}`;

  if (D.perfil.es_vendedor && D.perfil.vendedor_id) {
    $('#tabs button[data-v="vendedor"]').classList.remove("hide");
    await cargarVendedor();
  }

  pintarProductos();
  pintarDirecciones();
  llenarSelectDireccion();
  try {
    const pre = JSON.parse(localStorage.getItem(PRE_KEY) || "null");
    if (pre && pre.producto_id && pre.cantidad > 0 && D.productos.some(p => p.id === pre.producto_id)) {
      CARRITO.push({ producto_id: pre.producto_id, cantidad: pre.cantidad });
      recalcular();
      aviso("#car-msg", "Traemos tu cotización de la portada. Elige la dirección de entrega y confirma.", "ok");
    }
    localStorage.removeItem(PRE_KEY);
    if (params.get("producto")) history.replaceState({}, "", location.pathname);
  } catch {}
  pintarEmpresa();
  $("#q-nombre").value = D.perfil.nombre || "";
  $("#q-tel").value = D.perfil.telefono || "";
  $("#c-fecha").min = hoyMas(1);
  $("#c-fecha").value = hoyMas(3);

  await Promise.all([cargarPedidos(), cargarProgramaciones()]);

  // Regreso desde Stripe
  const pago = params.get("pago");
  if (pago === "ok") {
    irA("pedidos");
    aviso("#car-msg", "");
    setTimeout(() => alert("¡Gracias! Recibimos tu pago. Tu pedido ya está en nuestra cola de preparación."), 250);
    history.replaceState({}, "", location.pathname);
  } else if (pago === "cancelado") {
    irA("pedidos");
    history.replaceState({}, "", location.pathname);
  }
}

// ---------------------------------------------------------------- completar empresa
function mostrarCompletarEmpresa() {
  $("#app").classList.add("hide");
  $("#acceso").classList.remove("hide");
  ["#social", "#pest", "#p-entrar", "#p-registro"].forEach(s => $(s).classList.add("hide"));
  $$(".sep").forEach(x => x.classList.add("hide"));
  $("#p-empresa").classList.remove("hide");
  $("#m-nombre").value = D.perfil.nombre || "";
  $("#m-tel").value = D.perfil.telefono || "";
  const n = D.cuenta?.nombre || "";
  $("#m-empresa").value = (n && n !== D.perfil.nombre && !n.includes("@") && n !== (D.perfil.email || "").split("@")[0]) ? n : "";
}

$("#m-go").onclick = async () => {
  aviso("#acc-msg", "");
  const empresa = $("#m-empresa").value.trim(), muni = $("#m-muni").value.trim();
  const nombre = $("#m-nombre").value.trim(), tel = $("#m-tel").value.trim();
  if (!empresa) return aviso("#acc-msg", "Escribe el nombre de tu empresa.");
  if (!muni) return aviso("#acc-msg", "Escribe tu municipio para poder calcular el flete.");
  const btn = $("#m-go"); btn.disabled = true;
  const [{ data: ok, error }, r2] = await Promise.all([
    sb.rpc("actualizar_mi_empresa", { p_nombre: empresa, p_municipio: muni, p_estado: $("#m-edo").value.trim() || "Jalisco", p_telefono: tel }),
    sb.from("perfiles").update({ nombre, telefono: tel }).eq("id", D.perfil.id)
  ]);
  if (error || !ok) { btn.disabled = false; return aviso("#acc-msg", "No pudimos guardar: " + (error?.message || "intenta de nuevo")); }
  location.reload();
};

// ---------------------------------------------------------------- direcciones
function zonaDe(dirId) {
  const d = D.direcciones.find(x => x.id === dirId);
  return d ? D.zonas.find(z => z.id === d.zona_flete_id) : null;
}

function llenarSelectDireccion() {
  const sel = $("#c-dir");
  if (!D.direcciones.length) {
    sel.innerHTML = '<option value="">Todavía no tienes dirección — agrégala en Mi cuenta</option>';
  } else {
    sel.innerHTML = D.direcciones.map(d => {
      const z = D.zonas.find(z => z.id === d.zona_flete_id);
      return `<option value="${d.id}">${esc(d.alias)} — ${esc(d.municipio)}${z ? " · flete " + mx(z.precio_cliente_ton) + "/t" : ""}</option>`;
    }).join("");
  }
  if (typeof recalcular === "function") recalcular();
}

function pintarDirecciones() {
  const cont = $("#dir-lista");
  if (!D.direcciones.length) {
    cont.innerHTML = '<p class="muted" style="font-size:13.5px">Sin direcciones. Agrega una para poder cotizar el flete.</p>';
    return;
  }
  cont.innerHTML = D.direcciones.map(d => {
    const z = D.zonas.find(z => z.id === d.zona_flete_id);
    return `<div style="padding:9px 0;border-bottom:1px solid var(--line)">
      <strong>${esc(d.alias)}</strong> ${d.principal ? '<span class="tag on">principal</span>' : ""}
      <div class="muted" style="font-size:12.5px">${esc([d.calle, d.colonia, d.municipio, d.estado, d.cp].filter(Boolean).join(", "))}</div>
      <div class="muted mono" style="font-size:12px">${z ? esc(z.nombre) + " · flete " + mx(z.precio_cliente_ton) + "/t" : "Sin zona asignada"}</div>
    </div>`;
  }).join("");
}

$("#dir-nueva").onclick = () => {
  if (!D.perfil.cuenta_id) return aviso("#q-msg", "Tu usuario todavía no tiene cuenta asociada.");
  const zonas = D.zonas.filter(z => z.activa);
  abrirModal(`
    <h2>Nueva dirección de entrega</h2>
    <p class="sub">Con la zona calculamos el flete por tonelada. Si no sabes cuál es, elige el municipio más cercano.</p>
    <div class="grid">
      <label class="f">Nombre de la dirección <input id="d-alias" placeholder="Obra principal, planta, bodega"></label>
      <label class="f">Calle y número <input id="d-calle"></label>
      <div class="row">
        <label class="f" style="flex:1;min-width:150px">Colonia <input id="d-col"></label>
        <label class="f" style="flex:1;min-width:110px">C.P. <input id="d-cp" inputmode="numeric"></label>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:150px">Municipio <input id="d-muni" value="${esc(D.cuenta?.municipio || "")}"></label>
        <label class="f" style="flex:1;min-width:110px">Estado <input id="d-edo" value="${esc(D.cuenta?.estado || "Jalisco")}"></label>
      </div>
      <label class="f">Zona de flete <select id="d-zona">${zonas.map(z => `<option value="${z.id}">${esc(z.nombre)} · ${mx(z.precio_cliente_ton)}/t — ${esc((z.cobertura || "").slice(0, 70))}</option>`).join("")}</select></label>
      <label class="f">Referencias para el chofer <input id="d-ref" placeholder="Portón verde, preguntar por…"></label>
      <div class="row">
        <label class="f" style="flex:1;min-width:150px">Contacto en sitio <input id="d-cont" value="${esc(D.perfil.nombre || "")}"></label>
        <label class="f" style="flex:1;min-width:130px">Teléfono <input id="d-tel" value="${esc(D.perfil.telefono || "")}"></label>
      </div>
    </div>
    <div id="d-msg"></div>
    <div class="acciones"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button><button class="btn" id="d-ok">Guardar dirección</button></div>`);

  $("#d-ok").onclick = async () => {
    const alias = $("#d-alias").value.trim(), municipio = $("#d-muni").value.trim();
    if (!alias) return aviso("#d-msg", "Ponle un nombre a la dirección.");
    if (!municipio) return aviso("#d-msg", "Escribe el municipio.");
    $("#d-ok").disabled = true;
    const { error } = await sb.from("direcciones").insert({
      cuenta_id: D.perfil.cuenta_id, alias, calle: $("#d-calle").value.trim() || null, colonia: $("#d-col").value.trim() || null,
      cp: $("#d-cp").value.trim() || null, municipio, estado: $("#d-edo").value.trim() || "Jalisco",
      zona_flete_id: Number($("#d-zona").value), referencias: $("#d-ref").value.trim() || null,
      contacto: $("#d-cont").value.trim() || null, telefono: $("#d-tel").value.trim() || null,
      principal: D.direcciones.length === 0
    });
    if (error) { $("#d-ok").disabled = false; return aviso("#d-msg", error.message); }
    const { data } = await sb.from("direcciones").select("*").eq("cuenta_id", D.perfil.cuenta_id).order("principal", { ascending: false });
    D.direcciones = data || [];
    pintarDirecciones(); llenarSelectDireccion(); cerrarModal();
    if (CARRITO.length) irA("tienda");
  };
};

// Empresa y facturación
function pintarEmpresa() {
  if (!D.cuenta) return;
  $("#f-empresa").value = D.cuenta.nombre || ""; $("#f-muni").value = D.cuenta.municipio || "";
  $("#f-edo").value = D.cuenta.estado || ""; $("#f-razon").value = D.cuenta.razon_social || ""; $("#f-rfc").value = D.cuenta.rfc || "";
}
$("#f-save").onclick = async () => {
  const rfc = $("#f-rfc").value.trim().toUpperCase();
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return aviso("#f-msg", "El RFC no tiene el formato correcto (12 o 13 caracteres).");
  const { data: ok, error } = await sb.rpc("actualizar_mi_empresa", {
    p_nombre: $("#f-empresa").value.trim(), p_municipio: $("#f-muni").value.trim(), p_estado: $("#f-edo").value.trim(),
    p_telefono: D.perfil.telefono || "", p_razon_social: $("#f-razon").value.trim() || null, p_rfc: rfc || null
  });
  if (error || !ok) return aviso("#f-msg", "No se pudo guardar: " + (error?.message || "intenta de nuevo"));
  const { data } = await sb.from("mi_cuenta_v").select("*").single();
  D.cuenta = data || D.cuenta; pintarEmpresa();
  $("#who").querySelector("strong").textContent = D.cuenta.nombre;
  aviso("#f-msg", "Guardado.", "ok");
};

$("#q-save").onclick = async () => {
  const { error } = await sb.from("perfiles")
    .update({ nombre: $("#q-nombre").value.trim(), telefono: $("#q-tel").value.trim() })
    .eq("id", D.perfil.id);
  aviso("#q-msg", error ? error.message : "Guardado.", error ? "err" : "ok");
  if (!error) { D.perfil.nombre = $("#q-nombre").value.trim(); D.perfil.telefono = $("#q-tel").value.trim(); }
};

// Arrancamos hasta que los tres módulos hayan cargado: portal-tienda.js y
// portal-cuenta.js definen funciones que cargar() necesita.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
else arrancar();
