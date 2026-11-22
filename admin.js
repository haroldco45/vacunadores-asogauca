// App Admin (Yorjan) — Vacunación Bajo Cauca · Vibras Positivas HM
const A = { tok: (() => { try { return localStorage.getItem("adminToken"); } catch { return null; } })(), d: null, tab: "resumen" };
const FOTOS_PROD = ["jeringa", "repuesto", "agujas", "frascos", "frio", "bio", "marca", "hero1"];
const ESTADOS_PED = ["pendiente", "aprobado", "despachado", "entregado", "rechazado", "cancelado"];

async function adm(accion, datos = {}) {
  try { return await api(accion, { adminToken: A.tok, ...datos }); }
  catch (e) { if (e.code === 401 && accion !== "admin_login") salir(); throw e; }
}
function salir() { A.tok = null; try { localStorage.removeItem("adminToken"); } catch {} $("#app").classList.add("oculto"); $("#login").classList.remove("oculto"); }

// ---------- login ----------
$("#login-foto").src = fotoURL("hero2");
$("#login-foto").onerror = function () { if (!this.dataset.r) { this.dataset.r = 1; this.src = remota("hero2"); } };
api("admin_estado").then((r) => { if (!r.configurado) $("#login-sub").textContent = t("admPrimera"); }).catch(() => {});
$("#f-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("admin_login", { pin: e.target.pin.value });
    A.tok = r.token; try { localStorage.setItem("adminToken", r.token); } catch {}
    e.target.reset(); entrar();
  } catch (x) { aviso(x.message, "error"); }
});
function entrar() { $("#login").classList.add("oculto"); $("#app").classList.remove("oculto"); cargar(true); }

// ---------- carga ----------
async function cargar(silencio) {
  const b = $("#actualizar"); b.classList.add("girando");
  try { A.d = await adm("admin_todo"); pintar(); if (!silencio) aviso(t("actualizado")); }
  catch (e) { if (e.code !== 401) aviso(e.message, "error"); }
  finally { b.classList.remove("girando"); }
}
function pintar() {
  if (!A.d) return;
  pintarResumen(); pintarPedidos(); pintarInventario(); pintarVacs(); pintarAvisos(); pintarAjustes();
  const pend = A.d.pedidos.filter((p) => p.estado === "pendiente").length;
  const vp = A.d.vacunadores.filter((v) => v.estado === "pendiente").length;
  $("#cnt-ped").textContent = pend; $("#cnt-ped").classList.toggle("oculto", !pend);
  $("#cnt-vac").textContent = vp; $("#cnt-vac").classList.toggle("oculto", !vp);
  $("#adm-hora").textContent = horaColombia();
}
const prod = (id) => A.d.inventario.find((p) => p.id === id);
const vacDe = (id) => A.d.vacunadores.find((v) => v.id === id);

// ---------- resumen ----------
function barras(pares) {
  const max = Math.max(1, ...pares.map((p) => p[1]));
  return pares.length ? pares.map(([n, v]) => `<div><span><em style="font-style:normal">${esc(n)}</em><b>${v}</b></span><i style="width:${Math.round((v / max) * 100)}%"></i></div>`).join("") : `<p class="vacio">${t("sinDatos")}</p>`;
}
function pintarResumen() {
  const d = A.d, c = estadoCiclo();
  $("#res-ciclo").textContent = t("resCiclo", { d: c.transcurridos, t: c.total, f: c.faltan });
  const eqFuera = d.vacunadores.reduce((a, v) => a + Object.values(v.equipos || {}).reduce((x, y) => x + y, 0), 0);
  const bajo = d.inventario.filter((p) => p.activo && p.stock <= p.minimo);
  const k = [
    [d.vacunadores.filter((v) => v.estado === "activo").length, "kVacAct"],
    [d.vacunadores.filter((v) => v.estado === "pendiente").length, "kVacPend", true],
    [d.pedidos.filter((p) => p.estado === "pendiente").length, "kPedPend", true],
    [d.pedidos.filter((p) => p.estado === "aprobado").length, "kPedApr"],
    [d.pedidos.filter((p) => p.estado === "entregado" || p.estado === "despachado").length, "kPedDesp"],
    [bajo.length, "kBajo", true],
    [eqFuera, "kEqFuera"],
    [c.faltan, "kFaltan"],
  ];
  $("#kpis").innerHTML = k.map(([n, l, al]) => `<div class="kpi ${al && n ? "alerta" : ""}"><span class="num" data-n="${n}">0</span><small>${t(l)}</small></div>`).join("");
  $$("#kpis .num").forEach((el) => { const fin = +el.dataset.n, ini = performance.now(); const f = (ts) => { const p = Math.min(1, (ts - ini) / 900); el.textContent = Math.round(fin * p); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  $("#res-bajo").innerHTML = bajo.length ? bajo.map((p) => `<div class="lin"><span>${esc(p.nombre)}</span><b>${p.stock} / ${t("min")} ${p.minimo}</b></div>`).join("") : `<p class="vacio">${t("todoBien")}</p>`;
  const urg = d.pedidos.filter((p) => p.urgencia === "urgente" && ["pendiente", "aprobado"].includes(p.estado));
  $("#res-urg").innerHTML = urg.length ? urg.map((p) => `<div class="lin"><span>${esc(p.vacunador)} · ${esc(p.municipio || "")}</span><button class="btn chico rojo" data-verped="${p.id}">${t("atender")}</button></div>`).join("") : `<p class="vacio">${t("sinUrgentes")}</p>`;
  const tot = {};
  d.pedidos.filter((p) => ["despachado", "entregado"].includes(p.estado)).forEach((p) => p.items.forEach((i) => (tot[i.nombre] = (tot[i.nombre] || 0) + i.entregado)));
  $("#res-top").innerHTML = barras(Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 7));
  const mun = {};
  d.pedidos.filter((p) => p.estado !== "cancelado").forEach((p) => (mun[p.municipio || "—"] = (mun[p.municipio || "—"] || 0) + 1));
  $("#res-mun").innerHTML = barras(Object.entries(mun).sort((a, b) => b[1] - a[1]));
}

// ---------- pedidos ----------
function pintarPedidos() {
  const f = $("#fil-est").value || "activos", q = $("#fil-txt").value.toLowerCase();
  const lista = A.d.pedidos.filter((p) => (f === "todos" || (f === "activos" ? ["pendiente", "aprobado", "despachado"].includes(p.estado) : p.estado === f)))
    .filter((p) => !q || [p.vacunador, p.municipio, p.vereda, p.id, ...p.items.map((i) => i.nombre)].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.urgencia === "urgente") - (a.urgencia === "urgente") || b.creado.localeCompare(a.creado));
  $("#adm-pedidos").innerHTML = lista.length ? lista.map(tarjetaPedido).join("") : `<div class="tarjeta vacio">${t("sinPedidosAdm")}</div>`;
}
function tarjetaPedido(p) {
  const puedeDesp = ["pendiente", "aprobado"].includes(p.estado);
  return `<div class="pedido" id="ped-${p.id}">
    <div class="cab"><div><h3>${esc(p.vacunador)}</h3><small class="sub">${esc([p.municipio, p.vereda].filter(Boolean).join(" · "))} · ${fecha(p.creado)}</small></div>
      <div class="mini">${p.urgencia === "urgente" ? `<span class="pill p-urgente">${t("urgente")}</span>` : ""}<span class="pill p-${p.estado}">${est(p.estado)}</span></div></div>
    <div class="items">${p.items.map((i) => { const pr = prod(i.id); return `<div><span>${esc(i.nombre)} <small class="sub">(${t("hay")} ${pr ? pr.stock : 0})</small></span>
      ${puedeDesp ? `<span class="ent"><input type="number" min="0" max="${i.cantidad}" value="${Math.min(i.cantidad, pr ? pr.stock : 0)}" data-ent="${p.id}|${i.id}"> / ${i.cantidad}</span>` : `<b>${["despachado", "entregado"].includes(p.estado) ? i.entregado + " / " : ""}${i.cantidad} ${esc(i.unidad)}</b>`}</div>`; }).join("")}</div>
    ${p.entrega ? `<div class="sub" style="margin:0">${t("entregaEn")}: <b>${esc(p.entrega)}</b></div>` : ""}
    ${p.nota ? `<div class="aviso-card"><small>${t("notaVac")}</small><p>${esc(p.nota)}</p></div>` : ""}
    ${p.respuesta ? `<div class="sub" style="margin:0">${t("respuesta")}: ${esc(p.respuesta)}</div>` : ""}
    <div class="mini">
      ${p.estado === "pendiente" ? `<button class="btn chico" data-est="${p.id}|aprobado">${t("aprobar")}</button>` : ""}
      ${puedeDesp ? `<button class="btn chico sol" data-est="${p.id}|despachado">${t("despachar")}</button>` : ""}
      ${p.estado === "despachado" ? `<button class="btn chico" data-est="${p.id}|entregado">${t("marcarEntregado")}</button>` : ""}
      ${puedeDesp ? `<button class="btn chico linea" data-est="${p.id}|rechazado">${t("rechazar")}</button>` : ""}
      <a class="btn chico wa" target="_blank" rel="noopener" href="${wa(p.celular, t("waVac", { n: p.vacunador.split(" ")[0], id: p.id.slice(-6).toUpperCase(), e: est(p.estado) }))}">WhatsApp</a>
    </div></div>`;
}
async function cambiarEstado(id, estado) {
  const p = A.d.pedidos.find((x) => x.id === id);
  let nota = "";
  if (estado === "rechazado") { nota = prompt(t("motivo")) || ""; if (!nota) return; }
  else if (estado === "despachado") nota = prompt(t("notaDesp")) || "";
  const datos = { id, estado, nota };
  if (estado === "despachado") {
    datos.entregas = {};
    $$(`[data-ent^="${id}|"]`).forEach((i) => (datos.entregas[i.dataset.ent.split("|")[1]] = +i.value));
  }
  try { await adm("admin_pedido", datos); }
  catch (e) {
    if (estado === "despachado" && /alcanza/.test(e.message) && confirm(e.message + "\n\n" + t("forzar"))) { await adm("admin_pedido", { ...datos, forzar: true }); }
    else return aviso(e.message, "error");
  }
  aviso(t("estadoOk", { e: est(estado).toLowerCase() }));
  await cargar(true);
  if (p && confirm(t("avisarVac"))) window.open(wa(p.celular, t("waVac", { n: p.vacunador.split(" ")[0], id: p.id.slice(-6).toUpperCase(), e: est(estado) }) + (nota ? "\n" + nota : "")), "_blank");
}

// ---------- inventario ----------
function pintarInventario() {
  const q = $("#inv-txt").value.toLowerCase();
  const lista = A.d.inventario.filter((p) => !q || (p.nombre + " " + p.categoria).toLowerCase().includes(q));
  $("#tabla-inv").innerHTML = `<tr><th>${t("producto")}</th><th>${t("categoria")}</th><th>${t("existencia")}</th><th>${t("minimo")}</th><th>${t("acciones")}</th></tr>` +
    lista.map((p) => `<tr class="${p.stock <= p.minimo ? "bajo" : ""}" style="${p.activo ? "" : "opacity:.5"}">
      <td><b>${esc(p.nombre)}</b><br><small class="sub">${esc(p.unidad)}${p.retornable ? " · " + t("retornable") : ""}${p.activo ? "" : " · " + t("oculto")}</small></td>
      <td>${esc(p.categoria)}</td><td><b style="font-size:1.25rem">${p.stock}</b></td><td>${p.minimo}</td>
      <td><div class="mini"><button class="btn chico lima" data-mov="${p.id}|entrada">${t("entrada")}</button><button class="btn chico linea" data-mov="${p.id}|salida">${t("salida")}</button><button class="btn chico linea" data-mov="${p.id}|ajuste">${t("ajustar")}</button><button class="btn chico" data-editar="${p.id}">${t("editar")}</button></div></td></tr>`).join("");
  $("#tabla-mov").innerHTML = `<tr><th>${t("fecha")}</th><th>${t("producto")}</th><th>${t("tipo")}</th><th>${t("cantidad")}</th><th>${t("queda")}</th><th>${t("nota")}</th></tr>` +
    (A.d.movimientos.slice(0, 80).map((m) => `<tr><td>${fecha(m.fecha)}</td><td>${esc(m.producto)}</td><td>${esc(m.tipo)}</td><td>${m.cantidad}</td><td>${m.stock ?? ""}</td><td>${esc(m.nota || "")}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio">${t("sinDatos")}</td></tr>`);
}
async function moverStock(id, tipo) {
  const p = prod(id);
  const c = prompt(t("cuanto_" + tipo, { n: p.nombre, s: p.stock }));
  if (c === null || c === "" || isNaN(+c)) return;
  const nota = tipo === "ajuste" ? t("ajusteNota") : prompt(t("notaMov")) || "";
  try { await adm("admin_stock", { id, tipo, cantidad: +c, nota }); aviso(t("guardado")); cargar(true); } catch (e) { aviso(e.message, "error"); }
}
function formProducto(id) {
  const p = id ? prod(id) : { nombre: "", categoria: "", unidad: "unidad", minimo: 0, retornable: false, foto: "repuesto", activo: true };
  const cats = [...new Set(A.d.inventario.map((x) => x.categoria))];
  $("#hoja").innerHTML = `<button class="cerrar" data-cerrar>${t("cerrar")}</button><h2>${id ? t("editar") : t("nuevoProd")}</h2>
    <form id="f-prod">
      <label>${t("producto")}</label><input name="nombre" value="${esc(p.nombre)}" required>
      <div class="fila"><div><label>${t("categoria")}</label><input name="categoria" list="l-cats" value="${esc(p.categoria)}"><datalist id="l-cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
      <div><label>${t("unidad")}</label><input name="unidad" value="${esc(p.unidad)}"></div></div>
      <div class="fila"><div><label>${t("minimo")}</label><input name="minimo" type="number" min="0" value="${p.minimo}"></div>
      ${id ? "" : `<div><label>${t("stockInicial")}</label><input name="stock" type="number" min="0" value="0"></div>`}</div>
      <label>${t("foto")}</label><div class="grid g4" id="sel-foto">${FOTOS_PROD.map((f) => `<label style="margin:0;cursor:pointer"><input type="radio" name="foto" value="${f}" ${p.foto === f ? "checked" : ""} style="width:auto"> ${img(f, f, "")}</label>`).join("")}</div>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="retornable" ${p.retornable ? "checked" : ""} style="width:auto"> ${t("esRetornable")}</label>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="activo" ${p.activo ? "checked" : ""} style="width:auto"> ${t("visible")}</label>
      <button class="btn ancho" style="margin-top:14px">${t("guardar")}</button>
      ${id ? `<button type="button" class="btn ancho rojo" style="margin-top:10px" data-borrar="${id}">${t("borrarProd")}</button>` : ""}
    </form>`;
  $$("#sel-foto img").forEach((i) => Object.assign(i.style, { width: "100%", height: "70px", objectFit: "cover", borderRadius: "10px", display: "block" }));
  $("#velo").classList.add("on");
  $("#f-prod").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const producto = { id, nombre: f.nombre.value, categoria: f.categoria.value, unidad: f.unidad.value, minimo: +f.minimo.value, stock: f.stock ? +f.stock.value : undefined, foto: (f.querySelector("input[name=foto]:checked") || {}).value, retornable: f.retornable.checked, activo: f.activo.checked };
    try { await adm("admin_prod_guardar", { producto }); $("#velo").classList.remove("on"); aviso(t("guardado")); cargar(true); } catch (x) { aviso(x.message, "error"); }
  });
}

// ---------- vacunadores ----------
function pintarVacs() {
  const f = $("#vac-est").value || "todos", q = $("#vac-txt").value.toLowerCase();
  const lista = A.d.vacunadores.filter((v) => f === "todos" || v.estado === f).filter((v) => !q || [v.nombre, v.cedula, v.municipio, v.vereda, v.celular].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.estado === "pendiente") - (a.estado === "pendiente"));
  $("#adm-vacs").innerHTML = lista.length ? lista.map((v) => {
    const peds = A.d.pedidos.filter((p) => p.vacunadorId === v.id && p.estado !== "cancelado").length;
    const eq = Object.entries(v.equipos || {}).filter(([, n]) => n > 0);
    return `<div class="pedido">
      <div class="cab"><div style="display:flex;gap:12px;align-items:center"><div class="avatar" style="width:46px;height:46px;font-size:1.2rem">${esc(v.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase())}</div>
        <div><h3>${esc(v.nombre)}</h3><small class="sub">C.C. ${esc(v.cedula)} · ${esc(v.celular)}</small></div></div><span class="pill p-${v.estado}">${est(v.estado)}</span></div>
      <div class="sub" style="margin:0">${esc([v.municipio, v.vereda].filter(Boolean).join(" · "))}${v.certificado ? " · " + t("cert") + " " + esc(v.certificado) : ""} · ${t("registrado_el")} ${fecha(v.creado, false)} · ${peds} ${t("pedidosN")}</div>
      ${eq.length ? `<div><b>${t("equiposCargo")}</b>${eq.map(([pid, n]) => { const pr = prod(pid); return `<div class="equipo"><span>${n} × ${esc(pr ? pr.nombre : pid)}</span><span class="mini"><button class="btn chico lima" data-dev="${v.id}|${pid}|0">${t("devolvio")}</button><button class="btn chico linea" data-dev="${v.id}|${pid}|1">${t("danado")}</button></span></div>`; }).join("")}</div>` : ""}
      <div class="mini">
        ${v.estado !== "activo" ? `<button class="btn chico" data-vac="${v.id}|activo">${t("aprobarVac")}</button>` : `<button class="btn chico linea" data-vac="${v.id}|inactivo">${t("desactivar")}</button>`}
        <button class="btn chico linea" data-clave="${v.id}">${t("cambiarClave")}</button>
        <a class="btn chico wa" target="_blank" rel="noopener" href="${wa(v.celular, t("waHola", { n: v.nombre.split(" ")[0] }))}">WhatsApp</a>
      </div></div>`;
  }).join("") : `<div class="tarjeta vacio">${t("sinVacs")}</div>`;
}

// ---------- avisos y ajustes ----------
function pintarAvisos() {
  const av = A.d.config.avisos || [];
  $("#adm-avisos").innerHTML = av.length ? av.map((a) => `<div class="aviso-card"><small>${fecha(a.fecha)}</small><h3>${esc(a.titulo)}</h3><p>${esc(a.texto).replace(/\n/g, "<br>")}</p><button class="btn chico linea" style="margin-top:8px" data-delav="${a.id}">${t("borrar")}</button></div>`).join("") : `<div class="tarjeta vacio">${t("sinAvisos")}</div>`;
}
function pintarAjustes() {
  const f = $("#f-ajustes"), c = A.d.config;
  if (document.activeElement && f.contains(document.activeElement)) return;
  f.coordinador.value = c.coordinador || ""; f.whatsapp.value = c.whatsapp || ""; f.aprobacionAutomatica.checked = !!c.aprobacionAutomatica;
  $("#link-vac").value = location.origin + "/";
}
async function guardarAvisos(avisos) {
  try { await adm("admin_config", { config: { avisos } }); aviso(t("guardado")); cargar(true); } catch (e) { aviso(e.message, "error"); }
}
$("#f-aviso").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = { titulo: e.target.titulo.value, texto: e.target.texto.value, fecha: new Date().toISOString() };
  e.target.reset(); guardarAvisos([n, ...(A.d.config.avisos || [])]);
});
$("#f-ajustes").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try { await adm("admin_config", { config: { coordinador: f.coordinador.value, whatsapp: f.whatsapp.value, aprobacionAutomatica: f.aprobacionAutomatica.checked } }); aviso(t("guardado")); f.querySelector("button").focus(); cargar(true); }
  catch (x) { aviso(x.message, "error"); }
});

// ---------- CSV ----------
function csv(nombre, filas) {
  const txt = "﻿" + filas.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  a.download = nombre + "-" + new Date().toLocaleDateString("es-CO", { timeZone: TZ }).replace(/\//g, "-") + ".csv";
  a.click();
}

// ---------- eventos ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,[data-cerrar]"); if (!el) return;
  const ds = el.dataset;
  if (ds.l) return ponerIdioma(ds.l);
  if (ds.tab) {
    A.tab = ds.tab;
    $$(".adm-nav button").forEach((b) => b.classList.toggle("on", b === el));
    $$("main section.vista").forEach((s) => s.classList.toggle("on", s.id === "t-" + ds.tab));
    return window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (ds.verped) { $(`.adm-nav [data-tab=pedidos]`).click(); $("#fil-est").value = "activos"; pintarPedidos(); setTimeout(() => $("#ped-" + ds.verped)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250); return; }
  if (ds.est) { const [id, es] = ds.est.split("|"); return cambiarEstado(id, es); }
  if (ds.mov) { const [id, tp] = ds.mov.split("|"); return moverStock(id, tp); }
  if (ds.editar) return formProducto(ds.editar);
  if (ds.borrar) { if (confirm(t("seguroBorrar"))) { await adm("admin_prod_borrar", { id: ds.borrar }); $("#velo").classList.remove("on"); cargar(true); } return; }
  if (ds.cerrar !== undefined) return $("#velo").classList.remove("on");
  if (ds.vac) { const [id, es] = ds.vac.split("|"); try { await adm("admin_vac_estado", { id, estado: es }); aviso(t("guardado")); cargar(true); } catch (x) { aviso(x.message, "error"); } return; }
  if (ds.clave) { const pin = prompt(t("nuevaClave")); if (!pin) return; try { await adm("admin_vac_clave", { id: ds.clave, pin }); const v = vacDe(ds.clave); aviso(t("guardado")); if (v && confirm(t("enviarClave"))) window.open(wa(v.celular, t("waClave", { n: v.nombre.split(" ")[0], c: pin })), "_blank"); } catch (x) { aviso(x.message, "error"); } return; }
  if (ds.dev) { const [vacId, prodId, dan] = ds.dev.split("|"); const c = prompt(t("cuantosDev"), "1"); if (!c) return; try { await adm("admin_devolucion", { vacId, prodId, cantidad: +c, danado: dan === "1" }); aviso(t("guardado")); cargar(true); } catch (x) { aviso(x.message, "error"); } return; }
  if (ds.delav) return guardarAvisos((A.d.config.avisos || []).filter((a) => a.id !== ds.delav));
  switch (el.id) {
    case "actualizar": return cargar();
    case "nuevo-prod": return formProducto(null);
    case "salir": return salir();
    case "compartir": return window.open(wa("", t("waInvita", { u: location.origin + "/" })), "_blank");
    case "csv-ped": return csv("pedidos", [["Pedido", "Fecha", "Vacunador", "Cédula", "Celular", "Municipio", "Vereda", "Producto", "Pedido", "Entregado", "Unidad", "Urgencia", "Estado", "Entrega", "Nota"],
      ...A.d.pedidos.flatMap((p) => p.items.map((i) => [p.id, fecha(p.creado), p.vacunador, p.vacunadorId, p.celular, p.municipio, p.vereda, i.nombre, i.cantidad, i.entregado, i.unidad, p.urgencia, est(p.estado), p.entrega, p.nota]))]);
    case "csv-inv": return csv("inventario", [["Producto", "Categoría", "Unidad", "Existencia", "Mínimo", "Retornable"], ...A.d.inventario.map((p) => [p.nombre, p.categoria, p.unidad, p.stock, p.minimo, p.retornable ? "Sí" : "No"])]);
    case "csv-vac": return csv("vacunadores", [["Nombre", "Cédula", "Celular", "Municipio", "Vereda", "Certificado", "Estado", "Registro", "Equipos a cargo"],
      ...A.d.vacunadores.map((v) => [v.nombre, v.cedula, v.celular, v.municipio, v.vereda, v.certificado, est(v.estado), fecha(v.creado), Object.entries(v.equipos || {}).filter(([, n]) => n).map(([id, n]) => n + " " + (prod(id)?.nombre || id)).join(", ")])]);
  }
});
$("#velo").addEventListener("click", (e) => { if (e.target.id === "velo") $("#velo").classList.remove("on"); });
["fil-est", "fil-txt"].forEach((i) => $("#" + i).addEventListener("input", pintarPedidos));
["vac-est", "vac-txt"].forEach((i) => $("#" + i).addEventListener("input", pintarVacs));
$("#inv-txt").addEventListener("input", pintarInventario);

function selects() {
  const fe = $("#fil-est").value || "activos", ve = $("#vac-est").value || "todos";
  $("#fil-est").innerHTML = [["activos", t("activos")], ["todos", t("todos")], ...ESTADOS_PED.map((e) => [e, est(e)])].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  $("#vac-est").innerHTML = [["todos", t("todos")], ["pendiente", est("pendiente")], ["activo", est("activo")], ["inactivo", est("inactivo")]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  $("#fil-est").value = fe; $("#vac-est").value = ve;
}
window.alCambiarIdioma = () => { selects(); pintar(); };

traducir();
if (A.tok) entrar();
setInterval(() => { if (A.tok && !document.hidden && !$("#velo").classList.contains("on")) cargar(true); }, 60000);
registrarSW("sw.js");
