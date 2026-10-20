// POST /api/admin/importar → recibe una tanda de perfumes leídos del Excel y los fusiona con la base.
// Regla: el Excel manda en precios y agrega lo nuevo; lo que se editó a mano en el panel no se pisa
// salvo que se pida explícitamente (opciones.pisarTextos).
import { manejar, json, leerJSON, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';
import { limpiarPerfume, sentenciaGuardar, filaAPerfume } from '../../../lib/perfumes.js';

function vacio(v) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function fusionar(actual, nuevo, op) {
  const r = { ...actual };
  const textos = ['marca', 'nombre', 'concentracion', 'tipo', 'genero', 'familia', 'perfil', 'descripcion', 'acordes', 'estaciones', 'ocasiones'];
  for (const c of textos) if (op.pisarTextos || vacio(r[c])) r[c] = nuevo[c];
  if (op.pisarTextos || vacio(r.notas?.destacadas)) r.notas = { ...r.notas, destacadas: nuevo.notas.destacadas };

  const pres = r.presentaciones.map((x) => ({ ...x }));
  for (const n of nuevo.presentaciones) {
    const igual = pres.find((x) => x.ml === n.ml);
    if (!igual) {
      pres.push(n);
    } else if (igual.precioAnterior && igual.precioAnterior > igual.precio) {
      // Hay un descuento activo: se mantiene el mismo % sobre el nuevo precio de lista.
      const porcentaje = 1 - igual.precio / igual.precioAnterior;
      igual.precioAnterior = n.precio;
      igual.precio = Math.max(1, Math.round(n.precio * (1 - porcentaje)));
    } else {
      igual.precio = n.precio;
    }
  }
  r.presentaciones = pres;
  if (nuevo.imagen && (op.reemplazarFotos || !r.imagen)) {
    r.imagen = nuevo.imagen;
    r.imagen_fondo = nuevo.imagen_fondo;
  }
  r.fuente = nuevo.fuente || r.fuente;
  r.pagina_catalogo = nuevo.pagina_catalogo || r.pagina_catalogo;
  if (nuevo.revisar) r.revisar = nuevo.revisar;
  return r;
}

export const onRequestPost = manejar(async ({ request, env }) => {
  const { perfumes = [], opciones = {} } = await leerJSON(request, 3_000_000);
  if (!Array.isArray(perfumes) || perfumes.length > 60) throw new ErrorCliente(400, 'Mandá los perfumes en tandas de hasta 60.');

  const limpios = perfumes.map(limpiarPerfume);
  const { results } = await env.DB.prepare('SELECT * FROM perfumes WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(limpios.map((p) => p.id))).all();
  const existentes = new Map(results.map((f) => [f.id, filaAPerfume(f)]));

  let nuevos = 0;
  let actualizados = 0;
  const sentencias = [];
  for (const p of limpios) {
    const actual = existentes.get(p.id);
    if (actual) {
      sentencias.push(sentenciaGuardar(env, limpiarPerfume(fusionar(actual, p, opciones))));
      actualizados++;
    } else {
      sentencias.push(sentenciaGuardar(env, p));
      nuevos++;
    }
  }
  if (sentencias.length) await env.DB.batch([...sentencias, sentenciaVersion(env)]);
  return json({ ok: true, nuevos, actualizados });
});

// PUT /api/admin/importar {presentes: [ids]} → oculta los perfumes que ya no están en el Excel.
export const onRequestPut = manejar(async ({ request, env }) => {
  const { presentes } = await leerJSON(request, 500_000);
  if (!Array.isArray(presentes) || !presentes.length) throw new ErrorCliente(400, 'Falta la lista de perfumes del Excel.');
  const r = await env.DB.prepare(
    `UPDATE perfumes SET visible = 0, revisar = 'No está en el último Excel', actualizado = datetime('now')
     WHERE visible = 1 AND id NOT IN (SELECT value FROM json_each(?))`,
  ).bind(JSON.stringify(presentes)).run();
  await sentenciaVersion(env).run();
  return json({ ok: true, ocultados: r.meta?.changes ?? 0 });
});
