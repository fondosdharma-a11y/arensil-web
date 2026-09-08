// ARENSIL · Portal — catálogo, carrito, creación del pedido y pago.

function pintarProductos() {
  $("#prods").innerHTML = D.productos.map(p => `
    <div class="prod">
      <div class="malla">${esc(p.malla || PRES[p.presentacion])}</div>
      <h3>${esc(p.nombre)}</h3>
      <p class="ficha">${esc((p.ficha_tecnica || "").slice(0, 150))}</p>
      <div class="precio">${mx(p.precio_lista)} <small>por ${esc(p.unidad)}</small></div>
      ${p.requiere_certificado ? '<span class="tag warn">se entrega con análisis de lote</span>' : ""}
      <div class="addrow">
        <input type="number" min="0.5" step="0.5" value="${p.presentacion === "granel_ton" ? 10 : 20}" data-qty="${p.id}">
        <span class="muted" style="font-size:12.5px">${esc(p.unidad)}</span>
        <button class="btn sm" data-add="${p.id}" style="margin-left:auto">Agregar</button>
      </div>
    </div>`).join("");

  $$("#prods [data-add]").forEach(b => b.onclick = () => {
    const id = Number(b.dataset.add);
    const cant = Number($(`[data-qty="${id}"]`).value);
    if (!(cant > 0)) return;
    const ya = CARRITO.find(l => l.producto_id === id);
    if (ya) ya.cantidad = Number(ya.cantidad) + cant; else CARRITO.push({ producto_id: id, cantidad: cant });
    recalcular();
  });
}

function fleteTonActual() {
  if ($("#c-inco").value === "lab_mina") return 0;
  const z = zonaDe($("#c-dir").value);
  return z ? Number(z.precio_cliente_ton) : 0;
}

function totales() {
  const zf = fleteTonActual();
  let sub = 0, fle = 0;
  CARRITO.forEach(l => {
    const p = D.productos.find(p => p.id === l.producto_id); if (!p) return;
    sub += l.cantidad * Number(p.precio_lista);
    fle += l.cantidad * zf * (Number(p.kg_por_unidad) / 1000);
  });
  return { sub, fle, iva: (sub + fle) * 0.16, tot: (sub + fle) * 1.16, zf };
}

function recalcular() {
  const hayDir = !!D.direcciones.length;
  const entregado = $("#c-inco").value === "entregado";
  $("#lbl-dir").classList.toggle("hide", !entregado);

  const { sub, fle, iva, tot, zf } = totales();

  $("#car-vacio").classList.toggle("hide", CARRITO.length > 0);
  $("#lineas").innerHTML = CARRITO.map((l, i) => {
    const p = D.productos.find(p => p.id === l.producto_id); if (!p) return "";
    const f = zf * (Number(p.kg_por_unidad) / 1000);
    return `<div class="linea">
      <div><b>${esc(p.nombre)}</b>
        <small>${num(l.cantidad)} ${esc(p.unidad)} × ${mx(p.precio_lista)}${f > 0 ? " + " + mx(f) + " flete" : ""}</small></div>
      <span class="mono">${mx(l.cantidad * (Number(p.precio_lista) + f))}</span>
      <button class="btn ghost sm" data-del="${i}">×</button>
    </div>`;
  }).join("");
  $$("#lineas [data-del]").forEach(b => b.onclick = () => { CARRITO.splice(Number(b.dataset.del), 1); recalcular(); });

  $("#t-sub").textContent = mx(sub);
  $("#t-fle").textContent = mx(fle);
  $("#t-iva").textContent = mx(iva);
  $("#t-tot").textContent = mx(tot);

  const listo = CARRITO.length > 0 && (!entregado || (hayDir && $("#c-dir").value));
  $("#c-pagar").disabled = !listo;
  $("#c-prog").disabled = !listo;

  if (CARRITO.length && entregado && !hayDir) {
    aviso("#car-msg", "Agrega una dirección de entrega en Mi cuenta para calcular el flete.", "err");
  } else aviso("#car-msg", "");
}

$("#c-inco").onchange = recalcular;
$("#c-dir").onchange = recalcular;

// ---------------------------------------------------------------- pedido
async function crearPedido(estatus = "borrador") {
  const entregado = $("#c-inco").value === "entregado";
  const dirId = entregado ? ($("#c-dir").value || null) : null;
  const zona = entregado ? (zonaDe(dirId)?.id ?? null) : null;
  const zf = fleteTonActual();

  const { data: pedido, error } = await sb.from("pedidos").insert({
    cuenta_id: D.perfil.cuenta_id,
    usuario_id: D.perfil.id,
    direccion_id: dirId,
    incoterm: $("#c-inco").value,
    zona_flete_id: zona,
    entrega_deseada: $("#c-fecha").value || null,
    estatus
  }).select().single();
  if (error) throw new Error(error.message);

  const partidas = CARRITO.map((l, i) => {
    const p = D.productos.find(p => p.id === l.producto_id);
    return {
      pedido_id: pedido.id, producto_id: p.id,
      descripcion: `${p.nombre}${p.malla ? " · " + p.malla : ""} · ${PRES[p.presentacion]}`,
      cantidad: l.cantidad, unidad: p.unidad,
      precio_unitario: Number(p.precio_lista),
      flete_unitario: zf * (Number(p.kg_por_unidad) / 1000),
      orden: i + 1
    };
  });
  const { error: e2 } = await sb.from("pedido_partidas").insert(partidas);
  if (e2) throw new Error(e2.message);
  return pedido;
}

$("#c-pagar").onclick = async () => {
  const btn = $("#c-pagar");
  btn.disabled = true; btn.textContent = "Preparando el pago…";
  aviso("#car-msg", "");
  try {
    const pedido = await crearPedido("borrador");
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(FN + "/crear-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ pedido_id: pedido.id })
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || "No se pudo generar la liga de pago.");
    CARRITO = [];
    location.href = j.url;
  } catch (e) {
    aviso("#car-msg", e.message);
    btn.disabled = false; btn.textContent = "Pagar y confirmar pedido";
    recalcular();
  }
};

// ---------------------------------------------------------------- recurrencia
$("#c-prog").onclick = async () => {
  if (!CARRITO.length) return;
  const nombre = prompt("Ponle nombre a este pedido recurrente:", "Surtido mensual de obra");
  if (!nombre) return;
  const opciones = Object.entries(FREC);
  const lista = opciones.map(([k, v], i) => `${i + 1}. ${v}`).join("\n");
  const el = parseInt(prompt("¿Cada cuánto lo quieres?\n\n" + lista), 10);
  if (!(el >= 1 && el <= opciones.length)) return;
  const frecuencia = opciones[el - 1][0];
  const proxima = prompt("¿Cuándo lo quieres la primera vez? (AAAA-MM-DD)", hoyMas(7));
  if (!proxima || !/^\d{4}-\d{2}-\d{2}$/.test(proxima)) return alert("Fecha no válida.");

  const entregado = $("#c-inco").value === "entregado";
  const dirId = entregado ? ($("#c-dir").value || null) : null;

  const { data: prog, error } = await sb.from("programaciones").insert({
    cuenta_id: D.perfil.cuenta_id, usuario_id: D.perfil.id, nombre, frecuencia,
    proxima_fecha: proxima, direccion_id: dirId,
    incoterm: $("#c-inco").value,
    zona_flete_id: entregado ? (zonaDe(dirId)?.id ?? null) : null
  }).select().single();
  if (error) return aviso("#car-msg", error.message);

  const { error: e2 } = await sb.from("programacion_partidas").insert(
    CARRITO.map((l, i) => ({ programacion_id: prog.id, producto_id: l.producto_id, cantidad: l.cantidad, orden: i + 1 }))
  );
  if (e2) return aviso("#car-msg", e2.message);

  await cargarProgramaciones();
  aviso("#car-msg", "Listo. Tu pedido recurrente quedó programado.", "ok");
  irA("programados");
};
