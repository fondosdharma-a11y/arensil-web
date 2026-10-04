// Sirve el sitio desde Cloudflare igual que lo servía GitHub Pages (los archivos se leen de GitHub) (mismas URLs, mismos 301 y la misma
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

// Tipos por extensión (raw.githubusercontent.com todo lo entrega como text/plain).
const TIPOS = {
  html: "text/html", css: "text/css", js: "application/javascript", mjs: "application/javascript",
  json: "application/json", xml: "application/xml", txt: "text/plain", md: "text/markdown",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm",
  mp3: "audio/mpeg", vtt: "text/vtt", pdf: "application/pdf", woff: "font/woff", woff2: "font/woff2",
  ttf: "font/ttf", otf: "font/otf", webmanifest: "application/manifest+json", csv: "text/csv",
};
const tipoDe = (ruta) => TIPOS[(ruta.split("/").pop().split(".").pop() || "").toLowerCase()] || "application/octet-stream";

// Lo que GitHub Pages nunca publicó: archivos ocultos o con guion bajo (Jekyll) y la configuración de Cloudflare.
const PRIVADO = /(^|\/)[._]|^\/(cloudflare\/|wrangler\.jsonc$|README\.md$|CNAME$)/;

// Busca un archivo. Fuente: GitHub (main), con caché de 5 min en Cloudflare, así lo que se sube aparece
// solo, sin desplegar. Si GitHub no responde, se usa la copia empaquetada en el Worker (ASSETS).
async function buscar(env, req, url, ruta) {
  if (PRIVADO.test(ruta)) return null;
  let r;
  try {
    r = await fetch(env.FUENTE + ruta, { cf: { cacheTtlByStatus: { "200-299": 300, "404": 60, "500-599": 0 }, cacheEverything: true } });
  } catch { r = null; }
  if (r && r.status === 404) return null;
  if (!r || !r.ok) {
    const copia = await env.ASSETS.fetch(new Request(url.origin + ruta, { method: req.method, headers: req.headers }));
    return copia.status === 404 ? null : copia;
  }
  const etiqueta = r.headers.get("ETag");
  const h = new Headers({ "Content-Type": tipoDe(ruta), "Cache-Control": "public, max-age=600", "Accept-Ranges": "bytes" });
  if (etiqueta) h.set("ETag", etiqueta);
  if (etiqueta && req.headers.get("If-None-Match") === etiqueta) return new Response(null, { status: 304, headers: h });
  if (req.method === "HEAD") { const largo = r.headers.get("Content-Length"); if (largo) h.set("Content-Length", largo); return new Response(null, { status: 200, headers: h }); }
  return new Response(r.body, { status: 200, headers: h });
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
    // Redirecciones fijas del sitio (var REDIRECCIONES = JSON {"/vieja.html": "/nueva.html"}).
    let mapa = {};
    try { mapa = JSON.parse(env.REDIRECCIONES || "{}"); } catch { mapa = {}; }
    if (mapa[p]) return conSeguridad(Response.redirect(url.origin + mapa[p] + url.search, 301), propio);
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
    const pagina = (await buscar(env, new Request(req.url), url, "/404.html")) || (await env.ASSETS.fetch(new Request(url.origin + "/404.html")));
    return conSeguridad(new Response(req.method === "HEAD" ? null : pagina.body, {
      status: 404, headers: { "Content-Type": "text/html; charset=utf-8" },
    }), propio);
  },
};
