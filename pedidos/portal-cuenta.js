// ARENSIL · Portal — pedidos, pedidos programados y panel de vendedor.

async function cargarPedidos() {
  if (!D.perfil?.cuenta_id) return;
  const { data } = await sb.from("pedidos")
    .select("*, direcciones(alias,municipio), pedido_partidas(descripcion,cantidad,unidad,lote_id)")
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
    const items = (p.pedido_partidas || []).map(x => `<div>${num(x.cantidad)} ${x.unidad} de ${esc(x.descripcion)}${x.lote_id ? ` <button class="lnk" data-cert="${x.lote_id}">Certificado de lote</button>` : ""}</div>`).join("");
    const porTransferencia = p.estatus === "pendiente_pago" && p.metodo_pago === "transferencia" && !p.stripe_url;
    const accion = p.estatus === "borrador" || (p.estatus === "pendiente_pago" && !porTransferencia)
      ? `<button class="btn sm" data-pagar="${p.id}">Pagar</button>`
      : porTransferencia
        ? datosTransferencia(p)
        : "";
    return `<tr>
      <td class="mono"><strong>${esc(p.folio)}</strong>
        <div class="partidas">${items}</div></td>
      <td class="mono">${new Date(p.fecha).toLocaleDateString("es-MX")}</td>
      <td>${dir}<div class="muted" style="font-size:11.5px">${p.entrega_deseada ? "para el " + p.entrega_deseada : ""}</div></td>
      <td class="right mono"><strong>${mx(p.total)}</strong>
        <div class="muted" style="font-size:11.5px">${p.metodo_pago ? esc(p.metodo_pago) : ""}</div></td>
      <td><span class="tag ${cls}">${txt}</span></td>
      <td>${accion}</td>
    </tr>`;
  }).join("");

  $$("#ped-body [data-pagar]").forEach(b => b.onclick = () => pagarPedido(b.dataset.pagar, b));
  $$("#ped-body [data-cert]").forEach(b => b.onclick = () => verCertificado(b.dataset.cert));
}

// Instrucciones de pago por transferencia: con los datos bancarios si JP ya los capturó en el CRM.
function datosTransferencia(p) {
  const c = D.config || {};
  const wa = (c.whatsapp || "523324934360").replace(/\D/g, "");
  const msg = encodeURIComponent(`Hola, soy ${D.cuenta?.nombre || D.perfil?.nombre || ""}. Te mando el comprobante del pedido ${p.folio} (${mx(p.total)}).`);
  const waLink = `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener">enviar comprobante por WhatsApp</a>`;
  if (!c.pago_clabe) {
    return `<span class="muted" style="font-size:11.5px">Pago por transferencia SPEI. Te enviamos los datos bancarios por WhatsApp o correo; si ya pagaste, ${waLink}.</span>`;
  }
  return `<div style="font-size:11.5px;line-height:1.45">
    <strong>Transferencia SPEI</strong><br>
    ${c.pago_beneficiario ? esc(c.pago_beneficiario) + "<br>" : ""}${c.pago_banco ? esc(c.pago_banco) + " · " : ""}CLABE <span class="mono">${esc(c.pago_clabe)}</span><br>
    Referencia: <span class="mono">${esc(p.folio)}</span> · Importe: <span class="mono">${mx(p.total)}</span><br>
    <span class="muted">${esc(c.pago_instrucciones || "")}</span> ${waLink}.
  </div>`;
}

// Certificado de análisis del lote con el que se surtió la partida.
async function verCertificado(loteId) {
  const { data: c, error } = await sb.from("certificados_v").select("*").eq("id", loteId).single();
  if (error || !c) return alert("No encontramos el certificado de ese lote.");
  const pct = v => v == null ? "—" : Number(v).toFixed(v < 1 ? 3 : 2) + " %";
  const fila = (k, v) => `<tr><td>${k}</td><td class="mono"><strong>${v}</strong></td></tr>`;
  abrirModal(`<div class="cert">
    <div class="enc">
      <div><div class="logo" style="margin-bottom:4px"><svg class="marca-h" role="img" aria-label="ARENSIL" viewBox="0 0 1779.5 203.0"><defs><linearGradient id="arg" gradientUnits="userSpaceOnUse" x1="6.0" y1="0" x2="462.2" y2="0"><stop offset="0" stop-color="#A47E36"/><stop offset="1" stop-color="#C3A356"/></linearGradient></defs><g transform="translate(-276.8 -175.2)"><path fill="url(#arg)" fill-rule="evenodd" d="M601.5 278.8 L600.8 280.8 L637.2 324.0 L639.8 324.5 L653.2 312.2 L657.0 310.5 L708.8 371.2 L737.2 371.8 L738.8 371.0 L738.2 368.5 L635.2 246.5 L632.8 246.8ZM659.2 369.5 L510.2 184.5 L506.2 181.2 L480.5 208.5 L463.5 229.0 L432.5 262.8 L357.8 349.2 L347.2 350.5 L343.8 349.8 L343.5 348.5 L352.2 337.5 L355.2 335.2 L414.0 269.2 L412.0 265.8 L390.5 249.2 L386.8 251.8 L321.5 325.0 L313.5 335.2 L310.5 337.5 L283.2 368.5 L282.8 371.0 L286.0 371.8 L407.2 371.5 L520.5 249.2 L522.2 249.2 L629.0 371.0 L633.2 372.0 L659.2 371.2Z"/></g><g transform="translate(324.3 -675.5) scale(1.5885)"><path fill="#1A1A1A" fill-rule="evenodd" d="M835.8 428.0 L835.2 428.8 L835.2 549.2 L836.0 550.0 L911.5 550.0 L912.0 549.2 L912.0 528.5 L911.5 527.8 L862.2 527.8 L861.8 527.2 L861.5 428.5 L860.5 427.8ZM775.0 427.8 L773.8 428.5 L773.8 549.5 L774.2 550.0 L799.5 550.0 L800.0 549.5 L800.0 428.2 L799.2 427.8ZM620.2 428.0 L595.2 427.8 L594.5 428.8 L594.8 501.8 L594.2 502.2 L540.2 428.2 L516.2 428.2 L516.2 549.8 L541.8 550.0 L542.2 549.5 L542.2 474.8 L543.0 474.0 L597.5 549.2 L598.5 550.0 L620.5 549.8 L620.8 428.8ZM481.8 428.2 L479.8 427.8 L398.2 428.0 L397.8 428.5 L397.5 549.0 L398.5 550.2 L482.5 550.0 L483.0 549.5 L483.0 528.2 L482.2 527.8 L425.0 528.0 L424.0 527.2 L424.0 499.2 L424.8 498.5 L473.8 498.5 L474.2 498.0 L474.2 477.5 L473.2 476.8 L424.2 476.8 L423.8 475.5 L424.0 450.8 L424.5 450.2 L481.2 450.2 L482.0 449.5ZM266.8 427.8 L266.0 428.5 L266.0 549.2 L266.8 550.0 L292.0 550.0 L292.5 549.5 L292.8 509.8 L293.5 509.2 L314.2 509.2 L334.8 544.0 L339.0 550.0 L367.2 550.0 L367.5 548.8 L353.2 527.0 L340.8 506.2 L341.0 505.0 L351.2 499.2 L356.8 493.8 L361.0 487.5 L364.0 479.5 L365.0 474.0 L365.0 462.2 L362.5 452.5 L360.8 448.5 L357.2 443.2 L351.5 437.5 L345.0 433.2 L335.5 429.8 L330.8 428.8 L323.0 428.0ZM292.5 451.0 L293.5 450.2 L320.8 450.2 L327.5 451.5 L331.2 453.5 L335.8 458.2 L338.2 464.2 L338.5 471.5 L335.8 479.0 L330.2 484.2 L325.0 486.5 L319.8 487.5 L293.2 487.5 L292.5 486.2ZM162.0 428.0 L112.0 549.8 L139.0 550.0 L141.0 546.8 L149.2 524.2 L150.2 523.2 L200.8 523.2 L202.8 526.5 L208.8 543.2 L212.0 550.0 L239.5 550.0 L239.8 548.8 L233.2 535.0 L231.8 530.0 L210.2 479.2 L207.8 472.0 L203.5 463.2 L189.8 428.8 L188.5 427.8ZM175.0 457.2 L176.0 457.5 L187.5 486.8 L192.5 500.5 L192.0 501.8 L159.2 501.8 L158.8 501.2 L158.8 499.8ZM693.0 426.0 L682.5 427.8 L672.5 431.5 L666.8 435.0 L661.0 440.5 L657.0 446.8 L654.8 452.8 L653.5 460.8 L654.5 471.8 L656.0 476.2 L659.2 482.0 L663.5 486.5 L668.2 490.0 L680.5 495.8 L700.5 501.5 L711.5 506.5 L715.8 511.8 L716.5 514.5 L716.5 519.2 L713.5 524.2 L708.8 527.5 L701.5 529.0 L694.5 529.0 L688.5 528.2 L680.5 525.5 L670.5 519.8 L664.8 514.8 L663.0 514.2 L650.5 532.2 L650.2 533.8 L653.8 537.2 L661.5 542.5 L672.0 547.5 L685.2 551.0 L693.8 552.0 L703.5 552.0 L711.2 551.0 L721.2 548.0 L727.5 545.0 L735.5 538.2 L740.8 529.8 L742.8 523.2 L743.5 517.5 L742.8 506.5 L741.5 502.2 L738.2 495.8 L734.0 490.8 L727.2 485.8 L719.8 482.0 L688.2 472.2 L685.2 470.5 L681.5 466.5 L680.5 464.2 L680.2 459.5 L681.0 456.5 L684.5 452.2 L687.8 450.2 L694.0 448.8 L703.5 449.0 L713.2 451.8 L727.5 460.0 L738.8 441.5 L739.0 440.0 L730.0 433.8 L719.2 429.2 L703.2 426.0Z"/></g></svg></div>
        <div class="muted" style="font-size:12px">Arena sílica · Lagos de Moreno, Jalisco · 33 2493 4360</div></div>
      <div style="text-align:right"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700">Certificado de análisis</div>
        <div style="font-size:1.2rem;font-weight:660" class="mono">Lote ${esc(c.codigo)}</div></div>
    </div>
    <table>
      ${fila("Producto", esc(c.producto) + (c.malla ? " · " + esc(c.malla) : ""))}
      ${fila("Fecha de producción", c.fecha_produccion || "—")}
      ${fila("Toneladas del lote", c.toneladas != null ? num(c.toneladas) + " t" : "—")}
      ${fila("SiO₂", pct(c.sio2_pct))}
      ${fila("Fe₂O₃", pct(c.fe2o3_pct))}
      ${fila("Al₂O₃", pct(c.al2o3_pct))}
      ${fila("Humedad", pct(c.humedad_pct))}
      ${fila("Granulometría", esc(c.granulometria || "—"))}
      ${fila("Índice AFS", c.afs != null ? num(c.afs) : "—")}
      ${fila("Laboratorio", esc(c.laboratorio || "—"))}
      ${fila("Fecha de análisis", c.fecha_analisis || "—")}
    </table>
    ${c.certificado_url ? `<p style="margin-top:12px;font-size:13px"><a href="${esc(c.certificado_url)}" target="_blank" rel="noopener">Ver reporte original del laboratorio →</a></p>` : ""}
    <p class="muted" style="font-size:11.5px;margin-top:14px">Los valores corresponden a la muestra representativa del lote indicado. Emitido desde la plataforma de ARENSIL el ${new Date().toLocaleDateString("es-MX")}.</p>
    <div class="acciones"><button class="btn ghost" onclick="cerrarModal()">Cerrar</button><button class="btn" onclick="window.print()">Imprimir / guardar PDF</button></div>
  </div>`);
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
    if (!r.ok || (!j.url && !j.sin_stripe)) throw new Error(j.error || "No se pudo generar la liga de pago.");
    if (j.sin_stripe) {
      await cargarPedidos();
      aviso("#ped-msg", j.mensaje || "Tu pedido quedó registrado para pago por transferencia.", "ok");
      return;
    }
    location.href = j.url;
  } catch (e) {
    alert(e.message);
    btn.disabled = false; btn.textContent = t;
  }
}

// ---------------------------------------------------------------- cotizaciones
const EST_COT = { enviada: ["Por aceptar", "warn"], aceptada: ["Aceptada", "ok"], rechazada: ["Rechazada", "bad"], vencida: ["Vencida", "bad"] };
async function cargarCotizaciones() {
  if (!D.perfil?.cuenta_id) return;
  const [{ data: cots }, { data: parts }] = await Promise.all([
    sb.from("mis_cotizaciones_v").select("*").order("fecha", { ascending: false }).limit(50),
    sb.from("mis_cotizacion_partidas_v").select("*").order("orden")
  ]);
  D.cotizaciones = (cots || []).map(c => ({ ...c, partidas: (parts || []).filter(p => p.cotizacion_id === c.id) }));
  const tab = $('#tabs button[data-v="cotizaciones"]');
  const abiertas = D.cotizaciones.filter(c => c.estatus === "enviada").length;
  tab.classList.toggle("hide", D.cotizaciones.length === 0);
  tab.textContent = abiertas ? `Cotizaciones (${abiertas})` : "Cotizaciones";
  pintarCotizaciones();
}

function pintarCotizaciones() {
  const body = $("#cot-body");
  if (!D.cotizaciones?.length) { body.innerHTML = '<tr><td colspan="7" class="muted">No tienes cotizaciones todavía. Pídenos una por WhatsApp o desde el cotizador.</td></tr>'; return; }
  body.innerHTML = D.cotizaciones.map(c => {
    const [txt, cls] = EST_COT[c.estatus] || [c.estatus, ""];
    const items = c.partidas.map(x => `<div>${num(x.cantidad)} ${esc(x.unidad)} de ${esc(x.descripcion)} <span class="muted">· ${mx(x.precio_unitario)}${Number(x.flete_unitario) > 0 ? " + " + mx(x.flete_unitario) + " flete" : ""}</span></div>`).join("");
    const entrega = c.incoterm === "lab_mina" ? "Recojo en el banco" : `Entregado${c.zona ? " · " + esc(c.zona) : ""}`;
    const cond = [c.condiciones_pago, c.tiempo_entrega].filter(Boolean).map(esc).join(" · ");
    const accion = c.estatus === "enviada" ? `<button class="btn sm" data-aceptar="${c.id}">Aceptar y pedir</button>` : "";
    return `<tr>
      <td class="mono"><strong>${esc(c.folio)}</strong><div class="partidas">${items}</div>${cond ? `<div class="muted" style="font-size:11.5px;margin-top:4px">${cond}</div>` : ""}</td>
      <td class="mono">${new Date(c.fecha + "T12:00:00").toLocaleDateString("es-MX")}</td>
      <td class="mono">${new Date(c.vigente_hasta + "T12:00:00").toLocaleDateString("es-MX")}</td>
      <td>${entrega}</td>
      <td class="right mono"><strong>${mx(c.total)}</strong><div class="muted" style="font-size:11.5px">IVA incluido</div></td>
      <td><span class="tag ${cls}">${txt}</span></td>
      <td>${accion}</td>
    </tr>`;
  }).join("");
  $$("#cot-body [data-aceptar]").forEach(b => b.onclick = () => aceptarCotizacion(b.dataset.aceptar));
}

function aceptarCotizacion(id) {
  const c = D.cotizaciones.find(x => x.id === id); if (!c) return;
  const entregado = c.incoterm === "entregado";
  if (entregado && !D.direcciones.length) {
    aviso("#cot-msg", "Para aceptar una cotización con entrega, primero agrega una dirección en Mi cuenta.");
    return;
  }
  const dirs = D.direcciones.filter(d => !c.zona_flete_id || d.zona_flete_id === c.zona_flete_id);
  const lista = dirs.length ? dirs : D.direcciones;
  abrirModal(`
    <h2>Aceptar cotización ${esc(c.folio)}</h2>
    <p class="sub">Se crea tu pedido con los precios cotizados (${mx(c.total)} con IVA) y pasas al pago.</p>
    <div class="grid">
      ${entregado ? `<label class="f">Dirección de entrega <select id="ac-dir">${lista.map(d => `<option value="${d.id}">${esc(d.alias)} — ${esc(d.municipio)}</option>`).join("")}</select></label>` : `<p class="muted" style="font-size:13px">Recoges en el banco, en Lagos de Moreno.</p>`}
      ${entregado && dirs.length !== D.direcciones.length ? `<p class="muted" style="font-size:12px">Solo se muestran direcciones de la zona cotizada (${esc(c.zona || "")}). Si necesitas otra zona, pídenos una cotización nueva.</p>` : ""}
      <label class="f">¿Para cuándo lo necesitas? <input id="ac-fecha" type="date" min="${hoyMas(1)}" value="${hoyMas(3)}"></label>
    </div>
    <div id="ac-msg"></div>
    <div class="acciones"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button><button class="btn" id="ac-ok">Aceptar y pagar</button></div>`);
  $("#ac-ok").onclick = async () => {
    const btn = $("#ac-ok"); btn.disabled = true; btn.textContent = "Creando tu pedido…";
    const { data: pedidoId, error } = await sb.rpc("aceptar_cotizacion", {
      p_cotizacion: c.id, p_direccion: entregado ? $("#ac-dir").value : null, p_entrega: $("#ac-fecha").value || null
    });
    if (error) { btn.disabled = false; btn.textContent = "Aceptar y pagar"; return aviso("#ac-msg", error.message); }
    cerrarModal();
    await Promise.all([cargarCotizaciones(), cargarPedidos()]);
    irA("pedidos");
    const b = $(`#ped-body [data-pagar="${pedidoId}"]`);
    if (b) pagarPedido(pedidoId, b);
  };
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
