// GET /api/admin/eventos/:id → el evento con su configuración y las marcas para elegir
// PUT → guarda nombre, fechas, modo y reglas (no se puede mientras está activo)
// POST {accion: 'vista', config} → precios del evento sin guardar nada · {accion: 'activar' | 'terminar'}
//   · {accion: 'tienda', mostrarPorcentaje} → mostrar o no el % en la tienda (también con el evento activo)
// DELETE → borra el evento (si estaba activo, primero devuelve los precios)
import { manejar, json, error, leerJSON, sentenciaCambio, sentenciaVersion } from '../../../../lib/util.js';
import { limpiarEvento, limpiarConfig, vistaPrevia, activar, terminar, ahoraArgentina } from '../../../../lib/eventos.js';

async function buscar(env, id) {
  return env.DB.prepare('SELECT * FROM eventos WHERE id = ?').bind(String(id)).first();
}

const enCurso = (estado) => ['activo', 'aplicando', 'terminando'].includes(estado);

export const onRequestGet = manejar(async ({ params, env }) => {
  const ev = await buscar(env, params.id);
  if (!ev) return error(404, 'No existe ese evento.');
  const { results } = await env.DB.prepare('SELECT DISTINCT marca FROM perfumes WHERE visible = 1 ORDER BY marca').all();
  return json({
    evento: { ...ev, config: limpiarConfig(JSON.parse(ev.config || '{}')), aplicado: undefined, precios: JSON.parse(ev.aplicado || '[]').length },
    marcas: results.map((r) => r.marca),
    ahora: ahoraArgentina(),
  });
});

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const ev = await buscar(env, params.id);
  if (!ev) return error(404, 'No existe ese evento.');
  if (enCurso(ev.estado)) return error(409, 'El evento está activo: terminalo para cambiar la configuración.');
  const d = limpiarEvento(await leerJSON(request, 300_000));
  if (d.nombre.length < 2) return error(400, 'Ponele un nombre al evento.');
  if (d.modo === 'auto' && (!d.desde || !d.hasta)) return error(400, 'Para que sea automático, elegí cuándo empieza y cuándo termina.');
  if (d.desde && d.hasta && d.hasta <= d.desde) return error(400, 'La fecha de fin tiene que ser después de la de inicio.');
  // Automático: queda programado (empieza solo). Manual: queda listo para activarlo con el botón.
  const estado = d.modo === 'auto' ? 'programado' : 'borrador';
  await env.DB.batch([
    env.DB.prepare('UPDATE eventos SET nombre = ?, desde = ?, hasta = ?, modo = ?, config = ?, estado = ? WHERE id = ?')
      .bind(d.nombre, d.desde, d.hasta, d.modo, JSON.stringify(d.config), estado, ev.id),
    sentenciaCambio(env),
  ]);
  return json({ ok: true, estado });
});

export const onRequestPost = manejar(async ({ params, request, env }) => {
  const ev = await buscar(env, params.id);
  if (!ev) return error(404, 'No existe ese evento.');
  const d = await leerJSON(request, 300_000);
  if (d.accion === 'vista') return json({ filas: await vistaPrevia(env, limpiarConfig(d.config)) });
  // Cómo se ve en la tienda (con o sin el %): se puede cambiar aunque el evento esté activo, no toca precios.
  if (d.accion === 'tienda') {
    const config = { ...limpiarConfig(JSON.parse(ev.config || '{}')), mostrarPorcentaje: d.mostrarPorcentaje !== false };
    await env.DB.batch([
      env.DB.prepare('UPDATE eventos SET config = ? WHERE id = ?').bind(JSON.stringify(config), ev.id),
      sentenciaVersion(env),
    ]);
    return json({ ok: true });
  }
  if (d.accion === 'activar') {
    if (enCurso(ev.estado)) return error(409, 'El evento ya está activo.');
    try {
      return json({ ok: true, precios: await activar(env, ev) });
    } catch (e) {
      return error(409, e.message);
    }
  }
  if (d.accion === 'terminar') {
    if (ev.estado !== 'activo') return error(409, 'El evento no está activo.');
    await terminar(env, ev);
    return json({ ok: true });
  }
  return error(400, 'Acción desconocida.');
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  const ev = await buscar(env, params.id);
  if (!ev) return error(404, 'No existe ese evento.');
  if (ev.estado === 'activo') await terminar(env, ev);
  await env.DB.batch([env.DB.prepare('DELETE FROM eventos WHERE id = ?').bind(ev.id), sentenciaCambio(env)]);
  return json({ ok: true });
});
