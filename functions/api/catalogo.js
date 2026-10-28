// GET /api/catalogo → perfumes visibles, ofertas vigentes y datos de la tienda.
// Se cachea en el borde de Cloudflare por versión: cualquier cambio en el panel la renueva.
import { manejar, jsonCrudo, leerAjustes, hoyArgentina } from '../../lib/util.js';
import { listaJSON } from '../../lib/perfumes.js';
import { asegurarEsquema } from '../../lib/esquema.js';

export const onRequestGet = manejar(async ({ request, env, waitUntil }) => {
  const ajustes = await leerAjustes(env);
  const hoy = hoyArgentina();
  const clave = new Request(`https://cache.essenze/catalogo?v=${ajustes.version}&d=${hoy}`);
  const cache = caches.default;
  const guardado = await cache.match(clave);
  if (guardado) return guardado;

  await asegurarEsquema(env);
  const { results: ofertas } = await env.DB.prepare(
    `SELECT id, etiqueta, titulo, texto, boton, enlace, perfume, imagen, imagen_movil, formato, desde, hasta
     FROM ofertas WHERE activa = 1 ORDER BY orden, creado`,
  ).all();
  const vigentes = ofertas.filter((o) => (!o.desde || o.desde <= hoy) && (!o.hasta || o.hasta >= hoy));
  const publicos = {
    whatsapp: ajustes.whatsapp,
    ciudad: ajustes.ciudad,
    instagram: ajustes.instagram,
    cotizacion: ajustes.cotizacion,
    mostrarArs: ajustes.mostrarArs,
    mostrarUsd: ajustes.mostrarUsd,
    filtroInmediata: ajustes.filtroInmediata,
    estiloFotos: ajustes.estiloFotos,
    personaje: ajustes.personaje,
  };
  const perfumes = await listaJSON(env, { soloVisibles: true });
  const cuerpo = `{"ajustes":${JSON.stringify(publicos)},"ofertas":${JSON.stringify(vigentes)},"perfumes":${perfumes}}`;

  const respuesta = jsonCrudo(cuerpo, 200, { 'Cache-Control': 'public, max-age=30' });
  waitUntil(cache.put(clave, respuesta.clone()));
  return respuesta;
});
