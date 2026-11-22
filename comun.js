// Funciones compartidas — Vacunadores Bajo Cauca · Vibras Positivas HM
const TZ = "America/Bogota";

// Ciclo II de vacunación 2026 — Resolución ICA 00019881 del 7 de octubre de 2026
const CICLO = {
  inicio: "2026-10-27T00:00:00-05:00",
  fin: "2026-12-16T23:59:59-05:00",
  resolucion: "Resolución ICA 00019881 del 7 de octubre de 2026",
  municipios: ["Caucasia", "Cáceres", "El Bagre", "Nechí", "Tarazá", "Zaragoza"],
};

function estadoCiclo(ahora = new Date()) {
  const ini = new Date(CICLO.inicio), fin = new Date(CICLO.fin);
  const dia = 864e5;
  const total = Math.round((fin - ini) / dia);
  const transcurridos = Math.min(total, Math.max(0, Math.floor((ahora - ini) / dia) + 1));
  const faltan = Math.max(0, Math.ceil((fin - ahora) / dia));
  const fase = ahora < ini ? "antes" : ahora > fin ? "cerrado" : "activo";
  return { total, transcurridos, faltan, fase, avance: Math.round((transcurridos / total) * 100) };
}

// Fotos reales (Wikimedia Commons). El robot de GitHub las descarga a /img; si no están, se cargan de Commons.
const FOTOS = {
  hero1: ["Brazilian_Gyr_Cattle.jpg", "Wikimedia Commons"],
  hero2: ["Charolais_cattle,_Sierra_Nevada,_Venezuela.jpg", "Wilfredor"],
  hero3: ["Murrah_buffalo.JPG", "Kleomarlo"],
  brahman: ["CSIRO_ScienceImage_2643_A_Brahman_Bull.jpg", "CSIRO"],
  ternera: ["Brahman_cow_&_calf.jpg", "Wikimedia Commons"],
  bufalo: ["Water-buffalo.jpg", "Cornellier"],
  inspeccion: ["Cattle_inspected_for_ticks.jpg", "Wikimedia Commons"],
  jeringa: ["Old_Russian_Veterinary_Hypodermic_Syringe.jpg", "Wikimedia Commons"],
  repuesto: ["Objektfotografie_in_Styrobox-Glaskolbenspritze-12.jpg", "Wikimedia Commons"],
  agujas: ["HypodermicNeedles.jpg", "Wikimedia Commons"],
  frascos: ["Needles_and_bottle_(39936947401).jpg", "Wikimedia Commons"],
  frio: ["BioFarma_vaccine_vials_Bandung.jpg", "Wikimedia Commons"],
  bio: ["Syringe_Needle_IV.jpg", "Wikimedia Commons"],
  marca: ["Cattle_inspected_for_ticks.jpg", "Wikimedia Commons"],
};
const remota = (k) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent((FOTOS[k] || FOTOS.hero1)[0]) + "?width=1200";
function fotoURL(k) { return "img/" + (FOTOS[k] ? k : "hero1") + ".jpg"; }
function img(k, alt = "", cls = "") {
  return `<img class="${cls}" src="${fotoURL(k)}" alt="${esc(alt)}" loading="lazy" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='${remota(k)}'}">`;
}

// ---------- utilidades ----------
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function fecha(iso, conHora = true) {
  if (!iso) return "";
  const o = { timeZone: TZ, day: "numeric", month: "short", year: "numeric" };
  if (conHora) Object.assign(o, { hour: "numeric", minute: "2-digit" });
  return new Date(iso).toLocaleString(idioma() === "en" ? "en-US" : "es-CO", o);
}
function horaColombia() {
  return new Date().toLocaleString(idioma() === "en" ? "en-US" : "es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

async function api(accion, datos = {}) {
  const r = await fetch("/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion, ...datos }) });
  let j;
  try { j = await r.json(); } catch { throw new Error(t("errRed")); }
  if (!j.ok) { const e = new Error(j.error || "Error"); e.code = r.status; throw e; }
  return j;
}

function aviso(msg, tipo = "ok") {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.className = "toast " + tipo + " show";
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3800);
}

function wa(numero, texto) {
  let n = String(numero || "").replace(/\D/g, "");
  if (n.length === 10) n = "57" + n;
  return "https://wa.me/" + n + "?text=" + encodeURIComponent(texto);
}

// ---------- idioma ----------
function idioma() { try { return localStorage.getItem("lang") || "es"; } catch { return "es"; } }
function ponerIdioma(l) { try { localStorage.setItem("lang", l); } catch {} document.documentElement.lang = l; traducir(); }
function t(k, vars) {
  const X = typeof TXT !== "undefined" ? TXT : {};
  const d = X[idioma()] || X.es || {};
  let s = d[k] ?? (X.es && X.es[k]) ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll("{" + a + "}", b);
  return s;
}
function traducir() {
  $$("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  $$("[data-tp]").forEach((el) => (el.placeholder = t(el.dataset.tp)));
  $$(".lang button").forEach((b) => b.classList.toggle("on", b.dataset.l === idioma()));
  if (window.alCambiarIdioma) window.alCambiarIdioma();
}

const ESTADOS = {
  es: { pendiente: "Pendiente", aprobado: "Aprobado", despachado: "Despachado", entregado: "Entregado", rechazado: "Rechazado", cancelado: "Cancelado", activo: "Activo", inactivo: "Inactivo", agotado: "Por confirmar", poco: "Pocas unidades", disponible: "Disponible" },
  en: { pendiente: "Pending", aprobado: "Approved", despachado: "Dispatched", entregado: "Delivered", rechazado: "Rejected", cancelado: "Cancelled", activo: "Active", inactivo: "Inactive", agotado: "To be confirmed", poco: "Low stock", disponible: "Available" },
};
const est = (e) => (ESTADOS[idioma()] || ESTADOS.es)[e] || e;

function registrarSW(archivo = "sw.js") {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(archivo).catch(() => {});
}

function creditosFotos() {
  const vistos = new Set();
  return Object.values(FOTOS).filter(([f]) => !vistos.has(f) && vistos.add(f))
    .map(([f, a]) => `<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}" target="_blank" rel="noopener">${esc(f.replace(/_/g, " ").replace(/\.(jpe?g)$/i, ""))}</a> (${esc(a)})`).join(" · ");
}
