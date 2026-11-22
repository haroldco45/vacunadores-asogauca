// API compartida: App de Vacunadores + App Admin (Yorjan)
// Ciclo II de vacunación 2026 — Bajo Cauca (Asogauca / Fedegán)
// Vibras Positivas HM — Derechos reservados
import crypto from "node:crypto";

const TZ = "America/Bogota";

// ---------- almacenamiento ----------
let _store;
async function store() {
  if (_store) return _store;
  if (process.env.LOCAL_BLOBS) {
    // modo pruebas: guarda en una carpeta local
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = process.env.LOCAL_BLOBS;
    await fs.mkdir(dir, { recursive: true });
    const f = (k) => path.join(dir, encodeURIComponent(k));
    _store = {
      async get(k) { try { return JSON.parse(await fs.readFile(f(k), "utf8")); } catch { return null; } },
      async setJSON(k, v) { await fs.writeFile(f(k), JSON.stringify(v)); },
      async delete(k) { try { await fs.unlink(f(k)); } catch {} },
      async list({ prefix }) {
        const names = (await fs.readdir(dir)).map(decodeURIComponent).filter((n) => n.startsWith(prefix));
        return { blobs: names.map((key) => ({ key })) };
      },
    };
  } else {
    const { getStore } = await import("@netlify/blobs");
    const s = getStore({ name: "vacunacion-bajo-cauca", consistency: "strong" });
    _store = {
      get: (k) => s.get(k, { type: "json" }),
      setJSON: (k, v) => s.setJSON(k, v),
      delete: (k) => s.delete(k),
      list: (o) => s.list(o),
    };
  }
  return _store;
}

const now = () => new Date().toISOString();
const id = (p) => p + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const hash = (pin, salt) => crypto.createHash("sha256").update(salt + ":" + pin).digest("hex");
const clean = (s, n = 120) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };

class Fallo extends Error { constructor(m, c = 400) { super(m); this.code = c; } }

// ---------- datos base ----------
const CATALOGO_INICIAL = [
  ["Jeringa automática (inyector) 50 ml", "Inyectores", "unidad", true, "jeringa"],
  ["Jeringa automática (inyector) 5 ml – brucelosis", "Inyectores", "unidad", true, "jeringa"],
  ["Pistola dosificadora con tubo para frasco", "Inyectores", "unidad", true, "jeringa"],
  ["Kit de empaques (O-rings) para inyector", "Repuestos", "kit", false, "repuesto"],
  ["Émbolo de repuesto", "Repuestos", "unidad", false, "repuesto"],
  ["Cilindro / barril de repuesto", "Repuestos", "unidad", false, "repuesto"],
  ["Resorte de repuesto", "Repuestos", "unidad", false, "repuesto"],
  ["Válvulas de entrada y salida", "Repuestos", "par", false, "repuesto"],
  ["Manguera de alimentación", "Repuestos", "unidad", false, "repuesto"],
  ["Tuerca reguladora de dosis", "Repuestos", "unidad", false, "repuesto"],
  ["Agujas 16G x 1/2\" (caja x 100)", "Agujas", "caja", false, "agujas"],
  ["Agujas 18G x 1\" (caja x 100)", "Agujas", "caja", false, "agujas"],
  ["Vacuna fiebre aftosa (frasco)", "Biológicos", "frasco", false, "frascos"],
  ["Vacuna bivalente aftosa-rabia (frasco)", "Biológicos", "frasco", false, "frascos"],
  ["Vacuna brucelosis (frasco)", "Biológicos", "frasco", false, "frascos"],
  ["Vacuna carbón (frasco)", "Biológicos", "frasco", false, "frascos"],
  ["Nevera de icopor / termo para vacunas", "Cadena de frío", "unidad", true, "frio"],
  ["Pilas de gel refrigerante", "Cadena de frío", "unidad", false, "frio"],
  ["Termómetro para nevera", "Cadena de frío", "unidad", true, "frio"],
  ["Guantes de nitrilo (caja)", "Bioseguridad", "caja", false, "bio"],
  ["Algodón (rollo)", "Bioseguridad", "rollo", false, "bio"],
  ["Alcohol antiséptico", "Bioseguridad", "frasco", false, "bio"],
  ["Guardián para cortopunzantes", "Bioseguridad", "unidad", false, "bio"],
  ["Crayón marcador de ganado", "Papelería y marcación", "unidad", false, "marca"],
  ["Formatos de registro de vacunación (RUV)", "Papelería y marcación", "talonario", false, "marca"],
];

async function getInv(s) {
  let inv = await s.get("inv");
  if (!inv) {
    inv = CATALOGO_INICIAL.map(([nombre, categoria, unidad, retornable, foto], i) => ({
      id: "p" + (i + 1), nombre, categoria, unidad, retornable, foto, stock: 0, minimo: 0, activo: true,
    }));
    await s.setJSON("inv", inv);
  }
  return inv;
}
async function getCfg(s) {
  let c = await s.get("config");
  if (!c) {
    c = { secreto: crypto.randomBytes(24).toString("hex"), whatsapp: "", coordinador: "Yorjan", aprobacionAutomatica: false, avisos: [] };
    await s.setJSON("config", c);
  }
  return c;
}
async function listar(s, prefix) {
  const { blobs } = await s.list({ prefix });
  const out = await Promise.all(blobs.map((b) => s.get(b.key)));
  return out.filter(Boolean);
}
async function movimiento(s, m) {
  const k = "mov/" + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
  await s.setJSON(k, { ...m, fecha: now() });
}

const disponibilidad = (p) => (p.stock <= 0 ? "agotado" : p.stock <= Math.max(p.minimo, 0) ? "poco" : "disponible");
const publicoVac = (v) => ({ id: v.id, nombre: v.nombre, cedula: v.cedula, celular: v.celular, municipio: v.municipio, vereda: v.vereda, certificado: v.certificado, estado: v.estado, creado: v.creado, equipos: v.equipos || {} });

// ---------- autenticación ----------
function tokenAdmin(cfg) {
  const ts = Date.now();
  const firma = crypto.createHmac("sha256", cfg.secreto).update("admin:" + ts).digest("hex");
  return ts + "." + firma;
}
function verAdmin(cfg, tok) {
  const [ts, firma] = String(tok || "").split(".");
  if (!ts || !firma) throw new Fallo("Sesión de administrador no válida", 401);
  const ok = crypto.createHmac("sha256", cfg.secreto).update("admin:" + ts).digest("hex");
  if (ok.length !== firma.length || !crypto.timingSafeEqual(Buffer.from(ok), Buffer.from(firma))) throw new Fallo("Sesión de administrador no válida", 401);
  if (Date.now() - Number(ts) > 1000 * 60 * 60 * 24 * 30) throw new Fallo("La sesión venció, ingrese de nuevo", 401);
}
async function verVac(s, b) {
  const ced = clean(b.cedula, 20).replace(/\D/g, "");
  const v = await s.get("vac/" + ced);
  if (!v || !b.token || v.token !== b.token) throw new Fallo("Sesión no válida, ingrese de nuevo", 401);
  return v;
}

// ---------- acciones ----------
const acciones = {
  // ===== públicas =====
  async inicio(s) {
    const [inv, cfg] = await Promise.all([getInv(s), getCfg(s)]);
    return {
      catalogo: inv.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, foto: p.foto, retornable: p.retornable, disponibilidad: disponibilidad(p) })),
      avisos: (cfg.avisos || []).slice(0, 12),
      coordinador: cfg.coordinador,
      whatsapp: cfg.whatsapp,
      hora: now(),
    };
  },

  async registrar(s, b) {
    const cedula = clean(b.cedula, 20).replace(/\D/g, "");
    const nombre = clean(b.nombre, 80);
    const celular = clean(b.celular, 20).replace(/\D/g, "");
    const pin = String(b.pin || "");
    if (cedula.length < 5) throw new Fallo("Escriba una cédula válida");
    if (nombre.length < 5) throw new Fallo("Escriba su nombre completo");
    if (celular.length < 10) throw new Fallo("Escriba un celular de 10 dígitos");
    if (!/^\d{4,6}$/.test(pin)) throw new Fallo("La clave debe tener de 4 a 6 números");
    if (await s.get("vac/" + cedula)) throw new Fallo("Esa cédula ya está registrada. Use Ingresar.");
    const cfg = await getCfg(s);
    const salt = crypto.randomBytes(8).toString("hex");
    const v = {
      id: cedula, cedula, nombre, celular,
      municipio: clean(b.municipio, 40), vereda: clean(b.vereda, 80), certificado: clean(b.certificado, 40),
      salt, pinHash: hash(pin, salt), token: crypto.randomBytes(18).toString("hex"),
      estado: cfg.aprobacionAutomatica ? "activo" : "pendiente", creado: now(), equipos: {},
    };
    await s.setJSON("vac/" + cedula, v);
    return { token: v.token, vacunador: publicoVac(v) };
  },

  async ingresar(s, b) {
    const cedula = clean(b.cedula, 20).replace(/\D/g, "");
    const v = await s.get("vac/" + cedula);
    if (!v || v.pinHash !== hash(String(b.pin || ""), v.salt)) throw new Fallo("Cédula o clave incorrecta", 401);
    v.token = crypto.randomBytes(18).toString("hex");
    await s.setJSON("vac/" + cedula, v);
    return { token: v.token, vacunador: publicoVac(v) };
  },

  // ===== vacunador =====
  async yo(s, b) {
    const v = await verVac(s, b);
    const peds = (await listar(s, "ped/")).filter((p) => p.vacunadorId === v.id).sort((a, z) => z.creado.localeCompare(a.creado));
    return { vacunador: publicoVac(v), pedidos: peds };
  },

  async pedir(s, b) {
    const v = await verVac(s, b);
    if (v.estado !== "activo") throw new Fallo("Su registro todavía no está aprobado por la coordinación");
    const inv = await getInv(s);
    const items = (Array.isArray(b.items) ? b.items : []).map((it) => {
      const p = inv.find((x) => x.id === it.id && x.activo);
      const cantidad = num(it.cantidad);
      if (!p || cantidad <= 0 || cantidad > 999) return null;
      return { id: p.id, nombre: p.nombre, unidad: p.unidad, cantidad, entregado: 0 };
    }).filter(Boolean);
    if (!items.length) throw new Fallo("Agregue al menos un producto al pedido");
    const p = {
      id: id("PED"), vacunadorId: v.id, vacunador: v.nombre, celular: v.celular, municipio: v.municipio, vereda: v.vereda,
      items, urgencia: b.urgencia === "urgente" ? "urgente" : "normal", entrega: clean(b.entrega, 120), nota: clean(b.nota, 400),
      estado: "pendiente", creado: now(), historial: [{ estado: "pendiente", fecha: now(), por: v.nombre }],
    };
    await s.setJSON("ped/" + p.id, p);
    return { pedido: p };
  },

  async cancelar(s, b) {
    const v = await verVac(s, b);
    const p = await s.get("ped/" + clean(b.pedidoId, 60));
    if (!p || p.vacunadorId !== v.id) throw new Fallo("Pedido no encontrado", 404);
    if (p.estado !== "pendiente") throw new Fallo("Solo se puede cancelar un pedido pendiente");
    p.estado = "cancelado"; p.historial.push({ estado: "cancelado", fecha: now(), por: v.nombre });
    await s.setJSON("ped/" + p.id, p);
    return { pedido: p };
  },

  // ===== admin =====
  async admin_estado(s) {
    const cfg = await getCfg(s);
    return { configurado: !!(process.env.ADMIN_PIN || cfg.adminHash) };
  },

  async admin_login(s, b) {
    const cfg = await getCfg(s);
    const pin = String(b.pin || "");
    if (process.env.ADMIN_PIN) {
      if (pin !== process.env.ADMIN_PIN) throw new Fallo("Clave incorrecta", 401);
    } else if (cfg.adminHash) {
      if (hash(pin, cfg.secreto) !== cfg.adminHash) throw new Fallo("Clave incorrecta", 401);
    } else {
      if (!/^\d{6,10}$/.test(pin)) throw new Fallo("Cree una clave de 6 a 10 números");
      cfg.adminHash = hash(pin, cfg.secreto);
      await s.setJSON("config", cfg);
    }
    return { token: tokenAdmin(cfg) };
  },

  async admin_todo(s) {
    const [inv, cfg, vacs, peds, movs] = await Promise.all([getInv(s), getCfg(s), listar(s, "vac/"), listar(s, "ped/"), listar(s, "mov/")]);
    return {
      inventario: inv,
      vacunadores: vacs.map(publicoVac).sort((a, z) => z.creado.localeCompare(a.creado)),
      pedidos: peds.sort((a, z) => z.creado.localeCompare(a.creado)),
      movimientos: movs.sort((a, z) => z.fecha.localeCompare(a.fecha)).slice(0, 300),
      config: { whatsapp: cfg.whatsapp, coordinador: cfg.coordinador, aprobacionAutomatica: cfg.aprobacionAutomatica, avisos: cfg.avisos || [] },
      hora: now(),
    };
  },

  async admin_vac_estado(s, b) {
    const v = await s.get("vac/" + clean(b.id, 20));
    if (!v) throw new Fallo("Vacunador no encontrado", 404);
    if (!["activo", "pendiente", "inactivo"].includes(b.estado)) throw new Fallo("Estado no válido");
    v.estado = b.estado;
    await s.setJSON("vac/" + v.id, v);
    return { vacunador: publicoVac(v) };
  },

  async admin_vac_clave(s, b) {
    const v = await s.get("vac/" + clean(b.id, 20));
    if (!v) throw new Fallo("Vacunador no encontrado", 404);
    if (!/^\d{4,6}$/.test(String(b.pin || ""))) throw new Fallo("La clave debe tener de 4 a 6 números");
    v.salt = crypto.randomBytes(8).toString("hex"); v.pinHash = hash(String(b.pin), v.salt); v.token = "";
    await s.setJSON("vac/" + v.id, v);
    return { ok: true };
  },

  async admin_prod_guardar(s, b) {
    const inv = await getInv(s);
    const d = b.producto || {};
    const nombre = clean(d.nombre, 90);
    if (nombre.length < 3) throw new Fallo("Escriba el nombre del producto");
    let p = inv.find((x) => x.id === d.id);
    if (!p) {
      p = { id: "p" + Date.now().toString(36), stock: 0, activo: true };
      inv.push(p);
      if (num(d.stock) > 0) { p.stock = num(d.stock); await movimiento(s, { producto: nombre, tipo: "entrada", cantidad: p.stock, nota: "Stock inicial" }); }
    }
    Object.assign(p, { nombre, categoria: clean(d.categoria, 40) || "Otros", unidad: clean(d.unidad, 20) || "unidad", minimo: Math.max(0, num(d.minimo)), retornable: !!d.retornable, foto: clean(d.foto, 20) || "repuesto", activo: d.activo !== false });
    await s.setJSON("inv", inv);
    return { inventario: inv };
  },

  async admin_prod_borrar(s, b) {
    const inv = (await getInv(s)).filter((x) => x.id !== b.id);
    await s.setJSON("inv", inv);
    return { inventario: inv };
  },

  async admin_stock(s, b) {
    const inv = await getInv(s);
    const p = inv.find((x) => x.id === b.id);
    if (!p) throw new Fallo("Producto no encontrado", 404);
    const c = num(b.cantidad);
    if (b.tipo === "entrada") p.stock += Math.abs(c);
    else if (b.tipo === "salida") p.stock = Math.max(0, p.stock - Math.abs(c));
    else if (b.tipo === "ajuste") p.stock = Math.max(0, c);
    else throw new Fallo("Tipo de movimiento no válido");
    await s.setJSON("inv", inv);
    await movimiento(s, { producto: p.nombre, tipo: b.tipo, cantidad: c, stock: p.stock, nota: clean(b.nota, 200) });
    return { inventario: inv };
  },

  async admin_pedido(s, b) {
    const p = await s.get("ped/" + clean(b.id, 60));
    if (!p) throw new Fallo("Pedido no encontrado", 404);
    const nuevo = b.estado;
    const flujo = { pendiente: ["aprobado", "despachado", "rechazado"], aprobado: ["despachado", "rechazado"], despachado: ["entregado"], entregado: [], rechazado: [], cancelado: [] };
    if (!(flujo[p.estado] || []).includes(nuevo)) throw new Fallo(`No se puede pasar de ${p.estado} a ${nuevo}`);
    let inv;
    if (nuevo === "despachado") {
      inv = await getInv(s);
      const ent = b.entregas || {};
      const faltan = [];
      for (const it of p.items) {
        const cant = Math.max(0, Math.min(it.cantidad, ent[it.id] !== undefined ? num(ent[it.id]) : it.cantidad));
        const prod = inv.find((x) => x.id === it.id);
        if (prod && prod.stock < cant) faltan.push(`${prod.nombre} (hay ${prod.stock})`);
        // si se despacha "con lo que hay", nunca se entrega más de lo que existe
        it.entregado = prod ? Math.min(cant, prod.stock) : 0;
      }
      if (faltan.length && !b.forzar) throw new Fallo("No alcanza el inventario: " + faltan.join(", "));
      const v = await s.get("vac/" + p.vacunadorId);
      for (const it of p.items) {
        const prod = inv.find((x) => x.id === it.id);
        if (!prod || !it.entregado) continue;
        prod.stock = Math.max(0, prod.stock - it.entregado);
        await movimiento(s, { producto: prod.nombre, tipo: "salida", cantidad: it.entregado, stock: prod.stock, nota: `Pedido ${p.id} – ${p.vacunador}` });
        if (prod.retornable && v) { v.equipos = v.equipos || {}; v.equipos[prod.id] = (v.equipos[prod.id] || 0) + it.entregado; }
      }
      await s.setJSON("inv", inv);
      if (v) await s.setJSON("vac/" + v.id, v);
    }
    p.estado = nuevo;
    if (b.nota) p.respuesta = clean(b.nota, 300);
    p.historial.push({ estado: nuevo, fecha: now(), por: "Coordinación", nota: clean(b.nota, 300) });
    await s.setJSON("ped/" + p.id, p);
    return { pedido: p, inventario: inv };
  },

  async admin_devolucion(s, b) {
    const v = await s.get("vac/" + clean(b.vacId, 20));
    const inv = await getInv(s);
    const prod = inv.find((x) => x.id === b.prodId);
    if (!v || !prod) throw new Fallo("Datos no encontrados", 404);
    const tiene = (v.equipos || {})[prod.id] || 0;
    const c = Math.min(tiene, Math.abs(num(b.cantidad)));
    if (c <= 0) throw new Fallo("Ese vacunador no tiene ese equipo");
    v.equipos[prod.id] = tiene - c;
    if (b.danado) { await movimiento(s, { producto: prod.nombre, tipo: "baja", cantidad: c, stock: prod.stock, nota: `Devuelto dañado por ${v.nombre}` }); }
    else { prod.stock += c; await movimiento(s, { producto: prod.nombre, tipo: "devolución", cantidad: c, stock: prod.stock, nota: `Devuelto por ${v.nombre}` }); }
    await s.setJSON("inv", inv); await s.setJSON("vac/" + v.id, v);
    return { inventario: inv, vacunador: publicoVac(v) };
  },

  async admin_config(s, b) {
    const cfg = await getCfg(s);
    const c = b.config || {};
    if (c.whatsapp !== undefined) cfg.whatsapp = clean(c.whatsapp, 15).replace(/\D/g, "");
    if (c.coordinador !== undefined) cfg.coordinador = clean(c.coordinador, 60);
    if (c.aprobacionAutomatica !== undefined) cfg.aprobacionAutomatica = !!c.aprobacionAutomatica;
    if (Array.isArray(c.avisos)) cfg.avisos = c.avisos.slice(0, 30).map((a) => ({ id: a.id || id("AV"), titulo: clean(a.titulo, 100), texto: clean(a.texto, 600), fecha: a.fecha || now() }));
    await s.setJSON("config", cfg);
    return { config: { whatsapp: cfg.whatsapp, coordinador: cfg.coordinador, aprobacionAutomatica: cfg.aprobacionAutomatica, avisos: cfg.avisos } };
  },
};

export async function manejar(body) {
  const s = await store();
  const fn = acciones[body?.accion];
  if (!fn) throw new Fallo("Acción no válida", 404);
  if (body.accion.startsWith("admin_") && !["admin_login", "admin_estado"].includes(body.accion)) verAdmin(await getCfg(s), body.adminToken);
  return fn(s, body);
}

export default async (req) => {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true, servicio: "vacunadores-bajo-cauca", hora: new Date().toLocaleString("es-CO", { timeZone: TZ }) }), { headers: h });
  try {
    const body = await req.json();
    const data = await manejar(body);
    return new Response(JSON.stringify({ ok: true, ...data }), { headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || "Error" }), { status: e.code || 500, headers: h });
  }
};

export const config = { path: "/api" };
