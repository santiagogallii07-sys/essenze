// POST /api/admin/imagenes/limpiar → borra las fotos que ya no usa ningún perfume ni oferta
// (por ejemplo, las viejas que se reemplazaron). Respeta la última hora: una foto recién subida
// puede estar esperando que se guarde el perfume en el editor. La copia chica "<id>-m" vive mientras viva su foto.
import { manejar, json } from '../../../../lib/util.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

export const onRequestPost = manejar(async ({ env }) => {
  await asegurarEsquema(env);
  const r = await env.DB.prepare(
    `DELETE FROM imagenes
     WHERE creado < datetime('now', '-1 hour')
       AND id NOT IN (SELECT imagen FROM perfumes WHERE imagen IS NOT NULL)
       AND id NOT IN (SELECT imagen || '-m' FROM perfumes WHERE imagen IS NOT NULL)
       AND id NOT IN (SELECT j.value FROM perfumes, json_each(perfumes.imagenes) AS j)
       AND id NOT IN (SELECT imagen FROM ofertas WHERE imagen IS NOT NULL)
       AND id NOT IN (SELECT imagen_movil FROM ofertas WHERE imagen_movil IS NOT NULL)`,
  ).run();
  return json({ ok: true, borradas: r.meta.changes || 0 });
});
