// App de Vacunadores — Bajo Cauca · Vibras Positivas HM
const S = {
  catalogo: [], avisos: [], coordinador: "", whatsapp: "",
  sesion: leer("sesion"), vac: null, pedidos: [], carrito: leer("carrito") || {}, cat: "Todos",
};
function leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// ---------- héroe y ciclo ----------
const HERO = ["hero1", "hero2", "hero3", "brahman", "bufalo"];
function pintarHeroe() {
  $("#fotos").innerHTML = HERO.map((k, i) => img(k, "", i === 0 ? "on" : "").replace('loading="lazy"', i ? 'loading="lazy"' : "")).join("");
  let i = 0;
  setInterval(() => {
    const f = $$("#fotos img"); if (!f.length) return;
    f[i].classList.remove("on"); i = (i + 1) % f.length; f[i].classList.add("on");
  }, 5500);
}
function animarNumero(el, fin, sufijo = "") {
  const ini = performance.now(), dur = 1300;
  const paso = (ts) => { const p = Math.min(1, (ts - ini) / dur); el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3))) + sufijo; if (p < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
function pintarCiclo() {
  const c = estadoCiclo();
  animarNumero($("#c-faltan"), c.faltan);
  animarNumero($("#c-dia"), c.transcurridos);
  animarNumero($("#c-avance"), c.avance, "%");
  setTimeout(() => ($("#c-barra").style.width = c.avance + "%"), 200);
  $("#fase").textContent = t("fase_" + c.fase);
  $("#hora").textContent = horaColombia() + " · " + t("horaCol");
  $("#ciclo-res").textContent = CICLO.resolucion + " · 27 oct – 16 dic 2026";
  $("#municipios").innerHTML = CICLO.municipios.map((m) => `<span>${m}</span>`).join("");
  const hoy = new Date();
  const hitos = [
    ["2026-10-07T12:00:00-05:00", t("h_res")],
    ["2026-10-27T08:00:00-05:00", t("h_ini")],
    [hoy.toISOString(), t("h_hoy", { n: c.faltan }), "hoy"],
    ["2026-12-09T12:00:00-05:00", t("h_ult")],
    ["2026-12-16T18:00:00-05:00", t("h_fin")],
  ].sort((a, b) => a[0].localeCompare(b[0]));
  $("#linea").innerHTML = hitos.map(([f, txt, cl]) => `<div class="${cl || ""}"><b>${fecha(f, false)}</b><br>${esc(txt)}</div>`).join("");
  $("#biologicos").innerHTML = [
    ["hero1", "b_aftosa", "b_aftosaT"], ["ternera", "b_bruce", "b_bruceT"],
    ["bufalo", "b_rabia", "b_rabiaT"], ["brahman", "b_carbon", "b_carbonT"],
  ].map(([f, a, b]) => `<div class="biolo">${img(f, t(a))}<div><h3>${t(a)}</h3><p>${t(b)}</p></div></div>`).join("");
  const cinta = [t("ci1", { n: c.faltan }), t("ci2"), t("ci3"), t("ci4"), t("ci5")];
  $("#cinta").innerHTML = [...cinta, ...cinta].map((x) => `<span>${esc(x)}</span>`).join("");
}

// ---------- datos ----------
async function cargar(silencio) {
  const b = $("#actualizar"); b.classList.add("girando");
  try {
    const d = await api("inicio");
    Object.assign(S, { catalogo: d.catalogo, avisos: d.avisos, coordinador: d.coordinador, whatsapp: d.whatsapp });
    if (S.sesion) {
      try {
        const y = await api("yo", S.sesion);
        S.vac = y.vacunador; S.pedidos = y.pedidos;
      } catch (e) { if (e.code === 401) { S.sesion = null; S.vac = null; guardar("sesion", null); } else throw e; }
    }
    pintarTodo();
    if (!silencio) aviso(t("actualizado"));
  } catch (e) { aviso(e.message || t("errRed"), "error"); }
  finally { b.classList.remove("girando"); }
}

function pintarTodo() { pintarAcceso(); pintarAvisos(); pintarCats(); pintarCatalogo(); pintarPedidos(); pintarCarrito(); }

function pintarAcceso() {
  const v = S.vac;
  $("#zona-acceso").classList.toggle("oculto", !!v);
  $("#zona-vac").classList.toggle("oculto", !v);
  if (!v) return;
  $("#vac-ini").textContent = v.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  $("#vac-nombre").textContent = v.nombre;
  $("#vac-datos").textContent = [v.municipio, v.vereda, "C.C. " + v.cedula].filter(Boolean).join(" · ");
  const e = $("#vac-estado"); e.className = "pill p-" + v.estado; e.textContent = est(v.estado);
  $("#vac-espera").classList.toggle("oculto", v.estado === "activo");
  const enTramite = S.pedidos.filter((p) => ["pendiente", "aprobado", "despachado"].includes(p.estado)).length;
  animarNumero($("#k-pend"), enTramite);
  animarNumero($("#k-ent"), S.pedidos.filter((p) => p.estado === "entregado").length);
  animarNumero($("#k-eq"), Object.values(v.equipos || {}).reduce((a, b) => a + b, 0));
  const n = $("#nav-cnt"); n.textContent = enTramite; n.classList.toggle("oculto", !enTramite);
}

function pintarAvisos() {
  $("#avisos").innerHTML = S.avisos.length
    ? S.avisos.map((a) => `<div class="aviso-card"><small>${fecha(a.fecha)}</small><h3>${esc(a.titulo)}</h3><p>${esc(a.texto).replace(/\n/g, "<br>")}</p></div>`).join("")
    : `<div class="tarjeta vacio">${t("sinAvisos")}</div>`;
}

function categorias() { return ["Todos", ...new Set(S.catalogo.map((p) => p.categoria))]; }
function pintarCats() {
  $("#cats").innerHTML = categorias().map((c) => `<button class="${c === S.cat ? "on" : ""}" data-cat="${esc(c)}">${c === "Todos" ? t("todos") : esc(c)}</button>`).join("");
}
function pintarCatalogo() {
  const lista = S.catalogo.filter((p) => S.cat === "Todos" || p.categoria === S.cat);
  $("#catalogo").innerHTML = lista.map((p) => {
    const c = S.carrito[p.id] || 0;
    return `<div class="prod ${c ? "elegido" : ""}" data-id="${p.id}">
      <div class="ft">${img(p.foto, p.nombre)}<span class="pill p-${p.disponibilidad}">${est(p.disponibilidad)}</span></div>
      <div class="cuerpo"><h3>${esc(p.nombre)}</h3>
        <div class="meta">${esc(p.categoria)} · ${t("por")} ${esc(p.unidad)}${p.retornable ? " · " + t("retornable") : ""}</div>
        <div class="paso"><button data-menos="${p.id}" aria-label="-">−</button><input data-cant="${p.id}" inputmode="numeric" value="${c}"><button class="mas" data-mas="${p.id}" aria-label="+">+</button></div>
      </div></div>`;
  }).join("") || `<div class="tarjeta vacio">${t("sinProductos")}</div>`;
}
function ponerCant(id, n) {
  n = Math.max(0, Math.min(999, Math.round(Number(n) || 0)));
  if (n) S.carrito[id] = n; else delete S.carrito[id];
  guardar("carrito", S.carrito);
  const card = $(`.prod[data-id="${id}"]`);
  if (card) { card.classList.toggle("elegido", !!n); $("input", card).value = n; }
  pintarCarrito();
}
function pintarCarrito() {
  const ids = Object.keys(S.carrito).filter((id) => S.catalogo.some((p) => p.id === id));
  const total = ids.reduce((a, id) => a + S.carrito[id], 0);
  $("#car-n").textContent = total;
  $("#carrito").classList.toggle("on", total > 0 && $("#v-pedir").classList.contains("on"));
}

function pasos(e) { return { pendiente: 1, aprobado: 2, despachado: 3, entregado: 4 }[e] || 0; }
function pintarPedidos() {
  const L = $("#lista-pedidos");
  if (!S.vac) { L.innerHTML = `<div class="tarjeta vacio">${t("ingreseVer")}</div>`; $("#equipos").innerHTML = ""; return; }
  L.innerHTML = S.pedidos.length ? S.pedidos.map((p) => `<div class="pedido">
    <div class="cab"><div><h3>${t("pedido")} ${esc(p.id.slice(-6).toUpperCase())}</h3><small class="sub">${fecha(p.creado)}</small></div>
      <div class="mini">${p.urgencia === "urgente" ? `<span class="pill p-urgente">${t("urgente")}</span>` : ""}<span class="pill p-${p.estado}">${est(p.estado)}</span></div></div>
    <div class="ruta">${[1, 2, 3, 4].map((n) => `<i class="${pasos(p.estado) >= n ? "on" : ""}"></i>`).join("")}</div>
    <div class="items">${p.items.map((i) => `<div><span>${esc(i.nombre)}</span><b>${p.estado === "despachado" || p.estado === "entregado" ? i.entregado + " / " : ""}${i.cantidad} ${esc(i.unidad)}</b></div>`).join("")}</div>
    ${p.respuesta ? `<div class="aviso-card"><small>${esc(S.coordinador || t("coordinacion"))}</small><p>${esc(p.respuesta)}</p></div>` : ""}
    ${p.estado === "pendiente" ? `<button class="btn linea chico" data-cancelar="${p.id}">${t("cancelarPedido")}</button>` : ""}
  </div>`).join("") : `<div class="tarjeta vacio">${t("sinPedidos")}</div>`;
  const eq = Object.entries(S.vac.equipos || {}).filter(([, n]) => n > 0);
  $("#equipos").innerHTML = eq.length
    ? eq.map(([id, n]) => { const p = S.catalogo.find((x) => x.id === id); return `<div class="lin"><span>${esc(p ? p.nombre : id)}</span><b>${n}</b></div>`; }).join("")
    : `<p class="vacio">${t("sinEquipos")}</p>`;
}

// ---------- navegación ----------
function ir(v) {
  $$("section.vista").forEach((s) => s.classList.toggle("on", s.id === "v-" + v));
  $$(".nav button").forEach((b) => b.classList.toggle("on", b.dataset.ir === v));
  pintarCarrito();
  window.scrollTo({ top: 0, behavior: "smooth" });
  history.replaceState(null, "", "#" + v);
}

// ---------- eventos ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.dataset.l) return ponerIdioma(el.dataset.l);
  if (el.dataset.ir) return ir(el.dataset.ir);
  if (el.dataset.acc) {
    $$(".pestanas button").forEach((b) => b.classList.toggle("on", b === el));
    $("#f-registro").classList.toggle("oculto", el.dataset.acc !== "registro");
    $("#f-ingreso").classList.toggle("oculto", el.dataset.acc !== "ingreso");
    return;
  }
  if (el.dataset.cat) { S.cat = el.dataset.cat; pintarCats(); pintarCatalogo(); return; }
  if (el.dataset.mas) return ponerCant(el.dataset.mas, (S.carrito[el.dataset.mas] || 0) + 1);
  if (el.dataset.menos) return ponerCant(el.dataset.menos, (S.carrito[el.dataset.menos] || 0) - 1);
  if (el.dataset.cancelar) {
    if (!confirm(t("seguroCancelar"))) return;
    try { await api("cancelar", { ...S.sesion, pedidoId: el.dataset.cancelar }); aviso(t("cancelado")); cargar(true); } catch (x) { aviso(x.message, "error"); }
    return;
  }
  if (el.id === "actualizar") return cargar();
  if (el.id === "salir") { S.sesion = null; S.vac = null; S.pedidos = []; guardar("sesion", null); pintarTodo(); return; }
  if (el.id === "car-ver") return abrirHoja();
  if (el.id === "cerrar-hoja") return $("#velo").classList.remove("on");
  if (el.id === "enviar") return enviar();
});
document.addEventListener("change", (e) => { if (e.target.dataset.cant) ponerCant(e.target.dataset.cant, e.target.value); });
$("#velo").addEventListener("click", (e) => { if (e.target.id === "velo") $("#velo").classList.remove("on"); });

async function enviarForm(form, accion) {
  const datos = Object.fromEntries(new FormData(form));
  form.classList.add("cargando");
  try {
    const r = await api(accion, datos);
    S.sesion = { cedula: r.vacunador.cedula, token: r.token }; guardar("sesion", S.sesion);
    S.vac = r.vacunador; form.reset();
    aviso(accion === "registrar" ? t("registrado") : t("bienvenido", { n: r.vacunador.nombre.split(" ")[0] }));
    await cargar(true);
  } catch (x) { aviso(x.message, "error"); }
  finally { form.classList.remove("cargando"); }
}
$("#f-registro").addEventListener("submit", (e) => { e.preventDefault(); enviarForm(e.target, "registrar"); });
$("#f-ingreso").addEventListener("submit", (e) => { e.preventDefault(); enviarForm(e.target, "ingresar"); });

function abrirHoja() {
  if (!S.vac) { aviso(t("primeroIngrese"), "error"); ir("inicio"); setTimeout(() => $("#zona-acceso").scrollIntoView({ behavior: "smooth" }), 300); return; }
  const items = Object.entries(S.carrito).map(([id, n]) => [S.catalogo.find((p) => p.id === id), n]).filter(([p]) => p);
  $("#resumen").innerHTML = items.map(([p, n]) => `<div class="lin"><span>${esc(p.nombre)}</span><b>${n} ${esc(p.unidad)}</b></div>`).join("");
  if (!$("#entrega").value && S.vac.vereda) $("#entrega").value = S.vac.vereda + (S.vac.municipio ? ", " + S.vac.municipio : "");
  $("#velo").classList.add("on");
}
async function enviar() {
  const b = $("#enviar"); b.disabled = true;
  try {
    const items = Object.entries(S.carrito).map(([id, cantidad]) => ({ id, cantidad }));
    const r = await api("pedir", { ...S.sesion, items, urgencia: $("input[name=urg]:checked").value, entrega: $("#entrega").value, nota: $("#nota").value });
    S.carrito = {}; guardar("carrito", {}); $("#nota").value = "";
    $("#velo").classList.remove("on");
    aviso(t("pedidoEnviado"));
    if (S.whatsapp) {
      const p = r.pedido;
      const txt = `${t("waPedido")} ${p.id.slice(-6).toUpperCase()}\n${S.vac.nombre} · ${S.vac.municipio || ""} ${S.vac.vereda || ""}\n` +
        p.items.map((i) => `- ${i.cantidad} ${i.unidad} · ${i.nombre}`).join("\n") + (p.urgencia === "urgente" ? `\n${t("urgente").toUpperCase()}` : "") + (p.nota ? `\n${p.nota}` : "");
      if (confirm(t("avisarWa"))) window.open(wa(S.whatsapp, txt), "_blank");
    }
    await cargar(true); pintarCatalogo(); ir("pedidos");
  } catch (x) { aviso(x.message, "error"); }
  finally { b.disabled = false; }
}

window.alCambiarIdioma = () => { pintarCiclo(); if (S.catalogo.length) pintarTodo(); };

// ---------- arranque ----------
$("#sel-mun").innerHTML = CICLO.municipios.map((m) => `<option>${m}</option>`).join("") + `<option value="Otro">${t("otro")}</option>`;
$("#creditos").innerHTML = creditosFotos();
pintarHeroe();
traducir();
const inicial = location.hash.slice(1);
if (["pedir", "pedidos", "ciclo"].includes(inicial)) ir(inicial);
cargar(true);
setInterval(() => { $("#hora").textContent = horaColombia() + " · " + t("horaCol"); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(true); });
registrarSW();
