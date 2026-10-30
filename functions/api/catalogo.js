// GET /api/catalogo → perfumes visibles, ofertas vigentes y datos de la tienda.
// Se cachea en el borde de Cloudflare por versión: cualquier cambio en el panel la renueva.
import { manejar, jsonCrudo, leerAjustes, hoyArgentina } from '../../lib/util.js';
import { listaJSON } from '../../lib/perfumes.js';
import { asegurarEsquema } from '../../lib/esquema.js';
import { actualizarDolarSiToca } from '../../lib/dolar.js';

export const onRequestGet = manejar(async ({ request, env, waitUntil }) => {
  let ajustes = await leerAjustes(env);
  // Los lunes se actualiza el dólar de la semana (una sola vez); eso sube la versión y renueva el catálogo.
  if (await actualizarDolarSiToca(env, ajustes)) ajustes = await leerAjustes(env);
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
    popupCuentas: ajustes.popupCuentas,
    // Las páginas abiertas comparan esta versión con /api/vivo para saber si tienen que actualizarse.
    version: ajustes.version,
  };
  const perfumes = await listaJSON(env, { soloVisibles: true });
  // Los más vendidos de los últimos 6 meses (para la fila del inicio y el orden "Más vendidos" del catálogo).
  const { results: vendidos } = await env.DB.prepare(
    `SELECT json_extract(j.value, '$.id') AS id, SUM(json_extract(j.value, '$.cantidad')) AS unidades
     FROM pedidos p, json_each(p.items) j
     WHERE p.estado IN ('cobrado', 'entregado') AND p.creado >= date('now', '-180 days') AND json_extract(j.value, '$.id') IS NOT NULL
     GROUP BY 1 ORDER BY unidades DESC LIMIT 60`,
  ).all();
  const masVendidos = vendidos.map((v) => v.id);
  const cuerpo = `{"ajustes":${JSON.stringify(publicos)},"ofertas":${JSON.stringify(vigentes)},"masVendidos":${JSON.stringify(masVendidos)},"perfumes":${perfumes}}`;

  const respuesta = jsonCrudo(cuerpo, 200, { 'Cache-Control': 'public, max-age=30' });
  waitUntil(cache.put(clave, respuesta.clone()));
  return respuesta;
});
