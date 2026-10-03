// Sirve el sitio desde Cloudflare igual que lo servía GitHub Pages (mismas URLs, mismos 301 y la misma
// página 404) y agrega las cabeceras de seguridad que GitHub Pages no permite (auditoría 2026-10-03).
//
// Cómo resuelve una ruta, igual que GitHub Pages:
//   /carpeta/      → /carpeta/index.html
//   /pagina        → /pagina (si existe) → /pagina.html → 301 a /pagina/ si es carpeta
//   lo que no existe → /404.html con estado 404
// El dominio principal sale de HOST_CANONICO; los HOSTS_ALTERNOS y http:// redirigen a él (301).

const SEGURIDAD = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function conSeguridad(r, propio = true) {
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) h.set(k, v);
  // La dirección de prueba (*.workers.dev) no debe competir con el dominio en Google.
  if (!propio) h.set("X-Robots-Tag", "noindex");
  // Como GitHub Pages: el texto declara utf-8 (si no, algún navegador adivina mal los acentos).
  const tipo = h.get("Content-Type") || "";
  if (/^(text\/|application\/(javascript|json|xml|manifest\+json))/.test(tipo) && !/charset/i.test(tipo)) {
    h.set("Content-Type", tipo + "; charset=utf-8");
  }
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

// Video por partes (Range → 206), como GitHub Pages: Safari de iPhone no reproduce un video sin esto.
async function porPartes(req, r) {
  const m = (req.headers.get("Range") || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!m || r.status !== 200 || req.method !== "GET") return r;
  const datos = await r.arrayBuffer();
  const total = datos.byteLength;
  let ini = m[1] !== "" ? Number(m[1]) : null, fin = m[2] !== "" ? Number(m[2]) : null;
  if (ini === null && fin !== null) { ini = Math.max(0, total - fin); fin = total - 1; }
  if (ini === null) ini = 0;
  if (fin === null || fin >= total) fin = total - 1;
  if (ini > fin || ini >= total) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }
  const h = new Headers(r.headers);
  h.set("Content-Range", `bytes ${ini}-${fin}/${total}`);
  h.set("Content-Length", String(fin - ini + 1));
  h.set("Accept-Ranges", "bytes");
  h.delete("Content-Encoding");
  return new Response(datos.slice(ini, fin + 1), { status: 206, headers: h });
}

async function buscar(env, req, url, ruta) {
  const r = await env.ASSETS.fetch(new Request(url.origin + ruta, { method: req.method, headers: req.headers }));
  return r.status === 404 ? null : r;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const alternos = (env.HOSTS_ALTERNOS || "").split(",").filter(Boolean);
    const propio = url.hostname === env.HOST_CANONICO || alternos.includes(url.hostname);
    if (propio && (url.protocol === "http:" || url.hostname !== env.HOST_CANONICO)) {
      url.protocol = "https:";
      url.hostname = env.HOST_CANONICO;
      url.port = "";
      return conSeguridad(Response.redirect(url.toString(), 301));
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return conSeguridad(new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } }), propio);
    }

    const p = url.pathname;
    if (p.endsWith("/")) {
      const r = await buscar(env, req, url, p + "index.html");
      if (r) return conSeguridad(r, propio);
    } else {
      const r = (await buscar(env, req, url, p)) || (await buscar(env, req, url, p + ".html"));
      if (r) return conSeguridad(req.headers.has("Range") ? await porPartes(req, r) : r, propio);
      if (await buscar(env, req, url, p + "/index.html")) {
        return conSeguridad(Response.redirect(url.origin + p + "/" + url.search, 301), propio);
      }
    }
    const pagina = await env.ASSETS.fetch(new Request(url.origin + "/404.html"));
    return conSeguridad(new Response(req.method === "HEAD" ? null : pagina.body, {
      status: 404, headers: { "Content-Type": "text/html; charset=utf-8" },
    }), propio);
  },
};
