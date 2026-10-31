// GET /api/admin/costos → renglones de proveedores ya confirmados (para reconocerlos solos) y las últimas cargas.
// POST {cambios: [{id, ml, costo}], vinculos: [{clave, id, ml} | {clave, ignorar}], archivos: [nombres]}
//   → guarda los costos (en dólares) de cada tamaño y recuerda los renglones para la próxima lista.
//   Antes guarda cómo estaba todo, para poder deshacer la carga.
// DELETE ?carga=id → deshace la última carga: vuelven los costos y los renglones recordados de antes.
import { manejar, json, error, leerJSON, texto, numero, idAleatorio, sentenciaVersion } from '../../../lib/util.js';

const guardarVinculo = (env, v) => env.DB.prepare(
  `INSERT INTO costos_vinculos (clave, perfume, ml, ignorar, descripcion, actualizado) VALUES (?, ?, ?, ?, ?, datetime('now'))
   ON CONFLICT(clave) DO UPDATE SET perfume = excluded.perfume, ml = excluded.ml, ignorar = excluded.ignorar, descripcion = excluded.descripcion, actualizado = excluded.actualizado`,
).bind(v.clave, v.ignorar ? null : v.perfume, v.ignorar ? null : v.ml, v.ignorar ? 1 : 0, v.descripcion || '');

async function ejecutar(env, sentencias) {
  for (let i = 0; i < sentencias.length; i += 100) await env.DB.batch(sentencias.slice(i, i + 100));
}

export const onRequestGet = manejar(async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT clave, perfume, ml, ignorar FROM costos_vinculos').all();
  const vinculos = Object.fromEntries(results.map((r) => [r.clave, r.ignorar ? { ignorar: true } : { id: r.perfume, ml: r.ml }]));
  const { results: cargas } = await env.DB.prepare('SELECT id, fecha, archivos, tamanos, deshecha FROM costos_cargas ORDER BY fecha DESC, rowid DESC LIMIT 6').all();
  return json({ vinculos, cargas: cargas.map((c) => ({ ...c, archivos: JSON.parse(c.archivos || '[]'), deshecha: !!c.deshecha })) });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 2_000_000);
  const cambios = Array.isArray(d.cambios) ? d.cambios.slice(0, 5000) : [];
  const vinculos = Array.isArray(d.vinculos) ? d.vinculos.slice(0, 10000) : [];
  if (!cambios.length && !vinculos.length) return error(400, 'No hay costos para cargar.');

  // Costos: se agrupan por perfume y se cambia solo el costo de cada tamaño (precio, stock y demás quedan igual).
  const porPerfume = new Map();
  for (const c of cambios) {
    const id = texto(c.id, 100);
    const costo = numero(c.costo, NaN);
    if (!id || !Number.isFinite(costo) || costo < 0) continue;
    if (!porPerfume.has(id)) porPerfume.set(id, new Map());
    porPerfume.get(id).set(Math.round(numero(c.ml, 0)), Math.round(costo * 100) / 100);
  }
  const ids = [...porPerfume.keys()];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const sentencias = [];
  const costosAntes = [];
  for (const r of results) {
    const nuevos = porPerfume.get(r.id);
    const pres = JSON.parse(r.presentaciones || '[]').map((x) => {
      if (!nuevos.has(x.ml)) return x;
      costosAntes.push({ id: r.id, ml: x.ml, antes: x.costo ?? null, nuevo: nuevos.get(x.ml) });
      return { ...x, costo: nuevos.get(x.ml) };
    });
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), r.id));
  }

  // Renglones recordados: se guarda cómo estaba cada uno (o que no existía) para poder deshacer.
  const limpios = vinculos.map((v) => ({
    clave: texto(v.clave, 300),
    perfume: texto(v.id, 100),
    ml: Math.round(numero(v.ml, 0)),
    ignorar: !!v.ignorar,
    descripcion: texto(v.descripcion, 200),
  })).filter((v) => v.clave);
  const { results: previos } = limpios.length
    ? await env.DB.prepare('SELECT clave, perfume, ml, ignorar, descripcion FROM costos_vinculos WHERE clave IN (SELECT value FROM json_each(?))').bind(JSON.stringify(limpios.map((v) => v.clave))).all()
    : { results: [] };
  const porClave = new Map(previos.map((p) => [p.clave, p]));
  const vinculosAntes = limpios.map((v) => ({ clave: v.clave, antes: porClave.get(v.clave) || null }));
  for (const v of limpios) sentencias.push(guardarVinculo(env, v));

  const archivos = Array.isArray(d.archivos) ? d.archivos.map((a) => texto(a, 120)).slice(0, 20) : [];
  sentencias.push(env.DB.prepare('INSERT INTO costos_cargas (id, archivos, tamanos, costos, vinculos) VALUES (?, ?, ?, ?, ?)')
    .bind(idAleatorio(10), JSON.stringify(archivos), costosAntes.length, JSON.stringify(costosAntes), JSON.stringify(vinculosAntes)));
  sentencias.push(sentenciaVersion(env));
  await ejecutar(env, sentencias);
  return json({ ok: true, tamanos: costosAntes.length, vinculos: limpios.length });
});

export const onRequestDelete = manejar(async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get('carga');
  const carga = await env.DB.prepare('SELECT * FROM costos_cargas WHERE id = ?').bind(String(id)).first();
  if (!carga) return error(404, 'No existe esa carga.');
  if (carga.deshecha) return error(409, 'Esa carga ya se deshizo.');
  const ultima = await env.DB.prepare('SELECT id FROM costos_cargas WHERE deshecha = 0 ORDER BY fecha DESC, rowid DESC LIMIT 1').first('id');
  if (ultima !== carga.id) return error(409, 'Solo se puede deshacer la última carga. Deshacé primero las más nuevas.');

  // Costos: vuelve el de antes, salvo que alguien lo haya cambiado a mano después (ese se respeta).
  const costos = JSON.parse(carga.costos || '[]');
  const porPerfume = new Map();
  for (const c of costos) {
    if (!porPerfume.has(c.id)) porPerfume.set(c.id, new Map());
    porPerfume.get(c.id).set(c.ml, c);
  }
  const ids = [...porPerfume.keys()];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const sentencias = [];
  let vueltos = 0;
  for (const r of results) {
    const mapa = porPerfume.get(r.id);
    let cambio = false;
    const pres = JSON.parse(r.presentaciones || '[]').map((x) => {
      const c = mapa.get(x.ml);
      if (!c || Math.abs((x.costo ?? -1) - c.nuevo) > 0.005) return x;
      cambio = true;
      vueltos++;
      return { ...x, costo: c.antes };
    });
    if (cambio) sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), r.id));
  }
  // Renglones recordados: los que eran nuevos se borran y los que ya estaban vuelven a como estaban.
  for (const v of JSON.parse(carga.vinculos || '[]')) {
    if (!v.antes) sentencias.push(env.DB.prepare('DELETE FROM costos_vinculos WHERE clave = ?').bind(v.clave));
    else sentencias.push(guardarVinculo(env, { ...v.antes, ignorar: !!v.antes.ignorar }));
  }
  sentencias.push(env.DB.prepare('UPDATE costos_cargas SET deshecha = 1 WHERE id = ?').bind(carga.id));
  sentencias.push(sentenciaVersion(env));
  await ejecutar(env, sentencias);
  return json({ ok: true, costos: vueltos, saltados: costos.length - vueltos });
});
