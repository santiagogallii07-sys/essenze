// POST /api/admin/restaurar → vuelve el catálogo (la tabla de perfumes) a como estaba en una copia de seguridad.
// Recibe { creado, perfumes } sacado del archivo que se descarga en Ajustes → Copia de seguridad.
// Solo toca los perfumes: pedidos, caja, deudas, stock fuera del catálogo y ajustes quedan como están.
// Todo va en un solo batch: si algo falla, el catálogo queda como estaba antes de intentar.
import { manejar, json, leerJSON, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';
import { asegurarEsquema } from '../../../lib/esquema.js';

// Los perfumes se insertan en tandas de este tamaño (texto JSON), leyéndolos con json_each.
const TANDA = 250_000;

export const onRequestPost = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const d = await leerJSON(request, 40_000_000);
  const lista = Array.isArray(d?.perfumes) ? d.perfumes : null;
  if (!lista || !lista.length) throw new ErrorCliente(400, 'El archivo no tiene perfumes. Elegí una copia descargada desde Ajustes.');
  const ids = new Set();
  for (const p of lista) {
    if (!p || typeof p.id !== 'string' || !p.id || typeof p.nombre !== 'string' || typeof p.presentaciones !== 'string') {
      throw new ErrorCliente(400, 'El archivo no parece una copia de seguridad de Essenze.');
    }
    if (ids.has(p.id)) throw new ErrorCliente(400, `El perfume ${p.id} aparece dos veces en la copia.`);
    ids.add(p.id);
  }

  // Columnas que están en la copia y en la tabla de hoy (las nuevas toman su valor por defecto).
  const { results: info } = await env.DB.prepare('PRAGMA table_info(perfumes)').all();
  const enCopia = new Set(lista.flatMap((p) => Object.keys(p)));
  const columnas = info.map((c) => c.name).filter((c) => enCopia.has(c));
  if (!columnas.includes('id')) throw new ErrorCliente(400, 'El archivo no parece una copia de seguridad de Essenze.');
  const nombres = columnas.map((c) => `"${c}"`).join(', ');
  const valores = columnas.map((c) => `json_extract(value, '$."${c}"')`).join(', ');
  const insertar = `INSERT INTO perfumes (${nombres}) SELECT ${valores} FROM json_each(?)`;

  const sentencias = [env.DB.prepare('DELETE FROM perfumes')];
  let tanda = [];
  let largo = 0;
  const cerrarTanda = () => {
    if (!tanda.length) return;
    sentencias.push(env.DB.prepare(insertar).bind(JSON.stringify(tanda)));
    tanda = [];
    largo = 0;
  };
  for (const p of lista) {
    const fila = Object.fromEntries(columnas.map((c) => [c, p[c] ?? null]));
    largo += JSON.stringify(fila).length;
    tanda.push(fila);
    if (largo >= TANDA) cerrarTanda();
  }
  cerrarTanda();
  await env.DB.batch([...sentencias, sentenciaVersion(env)]);

  // Fotos que la copia nombra pero ya no están guardadas (la copia no incluye las fotos).
  const sinFoto = await env.DB.prepare(
    `SELECT count(*) AS n FROM perfumes WHERE imagen IS NOT NULL AND imagen != '' AND imagen NOT IN (SELECT id FROM imagenes)`,
  ).first('n');
  const visibles = await env.DB.prepare('SELECT count(*) AS n FROM perfumes WHERE visible = 1').first('n');
  return json({ ok: true, perfumes: lista.length, visibles, sinFoto: Number(sinFoto) || 0, creado: d.creado || null });
});
