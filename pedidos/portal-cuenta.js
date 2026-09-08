// ARENSIL · Portal — pedidos, pedidos programados y panel de vendedor.

async function cargarPedidos() {
  if (!D.perfil?.cuenta_id) return;
  const { data } = await sb.from("pedidos")
    .select("*, direcciones(alias,municipio), pedido_partidas(descripcion,cantidad,unidad)")
    .eq("cuenta_id", D.perfil.cuenta_id)
    .order("fecha", { ascending: false }).limit(100);
  D.pedidos = data || [];
  pintarPedidos();
}

function pintarPedidos() {
  const body = $("#ped-body");
  if (!D.pedidos.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">Todavía no has hecho pedidos.</td></tr>';
    return;
  }
  body.innerHTML = D.pedidos.map(p => {
    const [txt, cls] = EST_PED[p.estatus] || [p.estatus, ""];
    const dir = p.incoterm === "lab_mina"
      ? "Recojo en el banco"
      : (p.direcciones ? `${esc(p.direcciones.alias)} · ${esc(p.direcciones.municipio)}` : "—");
    const items = (p.pedido_partidas || []).map(x => `${num(x.cantidad)} ${x.unidad} de ${esc(x.descripcion)}`).join("<br>");
    const accion = (p.estatus === "borrador" || p.estatus === "pendiente_pago")
      ? `<button class="btn sm" data-pagar="${p.id}">Pagar</button>`
      : "";
    return `<tr>
      <td class="mono"><strong>${esc(p.folio)}</strong>
        <div class="muted" style="font-size:11.5px">${items}</div></td>
      <td class="mono">${new Date(p.fecha).toLocaleDateString("es-MX")}</td>
      <td>${dir}<div class="muted" style="font-size:11.5px">${p.entrega_deseada ? "para el " + p.entrega_deseada : ""}</div></td>
      <td class="right mono"><strong>${mx(p.total)}</strong>
        <div class="muted" style="font-size:11.5px">${p.metodo_pago ? esc(p.metodo_pago) : ""}</div></td>
      <td><span class="tag ${cls}">${txt}</span></td>
      <td>${accion}</td>
    </tr>`;
  }).join("");

  $$("#ped-body [data-pagar]").forEach(b => b.onclick = () => pagarPedido(b.dataset.pagar, b));
}

async function pagarPedido(id, btn) {
  const t = btn.textContent;
  btn.disabled = true; btn.textContent = "Un momento…";
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(FN + "/crear-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ pedido_id: id })
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || "No se pudo generar la liga de pago.");
    location.href = j.url;
  } catch (e) {
    alert(e.message);
    btn.disabled = false; btn.textContent = t;
  }
}

// ---------------------------------------------------------------- programados
async function cargarProgramaciones() {
  if (!D.perfil?.cuenta_id) return;
  const { data } = await sb.from("programaciones")
    .select("*, direcciones(alias,municipio), programacion_partidas(cantidad,producto_id)")
    .eq("cuenta_id", D.perfil.cuenta_id)
    .order("proxima_fecha");
  D.programaciones = data || [];
  pintarProgramaciones();
}

function pintarProgramaciones() {
  const body = $("#prog-body");
  if (!D.programaciones.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">Sin pedidos programados. Arma un pedido y usa el botón de recurrente.</td></tr>';
    return;
  }
  body.innerHTML = D.programaciones.map(g => {
    const items = (g.programacion_partidas || []).map(x => {
      const p = D.productos.find(p => p.id === x.producto_id);
      return `${num(x.cantidad)} ${p ? p.unidad : ""} de ${esc(p ? p.nombre : "producto")}`;
    }).join("<br>");
    const dias = Math.ceil((new Date(g.proxima_fecha) - new Date()) / 86400000);
    return `<tr>
      <td><strong>${esc(g.nombre)}</strong>
        <div class="muted" style="font-size:11.5px">${g.direcciones ? esc(g.direcciones.alias) + " · " + esc(g.direcciones.municipio) : "Recojo en el banco"}</div></td>
      <td>${FREC[g.frecuencia] || g.frecuencia}</td>
      <td class="mono">${g.proxima_fecha}
        <div class="muted" style="font-size:11.5px">${dias >= 0 ? "en " + dias + " días" : "vencido"}</div></td>
      <td style="font-size:12.5px">${items}</td>
      <td><span class="tag ${g.activa ? "ok" : ""}">${g.activa ? "Activo" : "Pausado"}</span></td>
      <td>
        <button class="btn ghost sm" data-toggle="${g.id}">${g.activa ? "Pausar" : "Reanudar"}</button>
        <button class="btn sm" data-surtir="${g.id}">Pedir ahora</button>
      </td>
    </tr>`;
  }).join("");

  $$("#prog-body [data-toggle]").forEach(b => b.onclick = async () => {
    const g = D.programaciones.find(x => x.id === b.dataset.toggle);
    await sb.from("programaciones").update({ activa: !g.activa }).eq("id", g.id);
    await cargarProgramaciones();
  });
  $$("#prog-body [data-surtir]").forEach(b => b.onclick = () => surtirAhora(b.dataset.surtir, b));
}

// Convierte una programación en un pedido real y manda a pagar.
async function surtirAhora(id, btn) {
  const g = D.programaciones.find(x => x.id === id);
  if (!g) return;
  btn.disabled = true; btn.textContent = "Generando…";
  try {
    const zf = g.incoterm === "lab_mina" ? 0
      : (D.zonas.find(z => z.id === g.zona_flete_id)?.precio_cliente_ton ?? 0);

    const { data: pedido, error } = await sb.from("pedidos").insert({
      cuenta_id: D.perfil.cuenta_id, usuario_id: D.perfil.id,
      direccion_id: g.direccion_id, incoterm: g.incoterm, zona_flete_id: g.zona_flete_id,
      entrega_deseada: g.proxima_fecha, programacion_id: g.id, estatus: "borrador",
      notas: "Generado desde el pedido programado: " + g.nombre
    }).select().single();
    if (error) throw new Error(error.message);

    const partidas = (g.programacion_partidas || []).map((x, i) => {
      const p = D.productos.find(p => p.id === x.producto_id);
      return {
        pedido_id: pedido.id, producto_id: p.id,
        descripcion: `${p.nombre}${p.malla ? " · " + p.malla : ""} · ${PRES[p.presentacion]}`,
        cantidad: x.cantidad, unidad: p.unidad,
        precio_unitario: Number(p.precio_lista),
        flete_unitario: Number(zf) * (Number(p.kg_por_unidad) / 1000),
        orden: i + 1
      };
    });
    const { error: e2 } = await sb.from("pedido_partidas").insert(partidas);
    if (e2) throw new Error(e2.message);

    await cargarPedidos();
    irA("pedidos");
    aviso("#prog-msg", "");
    const fila = $(`#ped-body [data-pagar="${pedido.id}"]`);
    if (fila) fila.click();
  } catch (e) {
    aviso("#prog-msg", e.message);
    btn.disabled = false; btn.textContent = "Pedir ahora";
  }
}

// ---------------------------------------------------------------- vendedor
async function cargarVendedor() {
  const { data: ven } = await sb.from("vendedores").select("*").eq("id", D.perfil.vendedor_id).single();
  D.vendedor = ven;
  if (!ven) return;

  const base = location.origin + location.pathname.replace(/index\.html$/, "");
  $("#ven-link").value = base + "?ref=" + ven.codigo;

  const [com, refs] = await Promise.all([
    sb.from("comisiones").select("*, pedidos(folio,fecha)").eq("vendedor_id", ven.id).order("generado_en", { ascending: false }),
    sb.from("cuentas").select("id,nombre,municipio,estatus")
  ]);
  D.comisiones = com.data || [];

  const pend = D.comisiones.filter(c => c.estatus === "pendiente").reduce((s, c) => s + Number(c.monto_mxn), 0);
  const pag = D.comisiones.filter(c => c.estatus === "pagada").reduce((s, c) => s + Number(c.monto_mxn), 0);
  const vendido = D.comisiones.reduce((s, c) => s + Number(c.base_mxn), 0);

  $("#ven-kpis").innerHTML = [
    ["Clientes referidos", (refs.data || []).length],
    ["Pedidos con comisión", D.comisiones.length],
    ["Vendido (producto)", mx(vendido)],
    ["Comisión por pagar", mx(pend)],
    ["Comisión pagada", mx(pag)],
    ["Tu porcentaje", Number(ven.comision_pct).toFixed(2) + " %"]
  ].map(([l, v]) => `<div class="card pad">
      <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">${l}</div>
      <div style="font-size:1.5rem;font-weight:660;letter-spacing:-.02em;margin-top:3px" class="mono">${v}</div>
    </div>`).join("");

  $("#ven-body").innerHTML = D.comisiones.length ? D.comisiones.map(c => {
    const cls = c.estatus === "pagada" ? "ok" : c.estatus === "cancelada" ? "bad" : "warn";
    return `<tr>
      <td class="mono">${new Date(c.generado_en).toLocaleDateString("es-MX")}</td>
      <td class="mono">${esc(c.pedidos?.folio || "")}</td>
      <td class="right mono">${mx(c.base_mxn)}</td>
      <td class="right mono">${Number(c.pct).toFixed(2)} %</td>
      <td class="right mono"><strong>${mx(c.monto_mxn)}</strong></td>
      <td><span class="tag ${cls}">${c.estatus}</span></td>
    </tr>`;
  }).join("") : '<tr><td colspan="6" class="muted">Todavía no hay comisiones. Comparte tu enlace.</td></tr>';
}

$("#ven-copiar").onclick = async () => {
  const el = $("#ven-link");
  try { await navigator.clipboard.writeText(el.value); }
  catch { el.select(); document.execCommand("copy"); }
  const b = $("#ven-copiar"); const t = b.textContent;
  b.textContent = "Copiado"; setTimeout(() => b.textContent = t, 1400);
};
