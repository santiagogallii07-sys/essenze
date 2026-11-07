// GET /api/catalogo → perfumes visibles, ofertas vigentes y datos de la tienda, en partes.
// La parte 0 trae los datos de la tienda y los perfumes que se ven primero (stock, destacados, ofertas,
// evento, más vendidos); /api/catalogo?parte=1, 2… traen el resto, de a mil, mientras la página ya se ve.
// Todas las partes se cachean en el borde de Cloudflare por versión: cualquier cambio en el panel las renueva.
import { manejar, jsonCrudo, leerAjustes, hoyArgentina } from '../../lib/util.js';
import { listaJSON } from '../../lib/perfumes.js';
import { asegurarEsquema } from '../../lib/esquema.js';
import { actualizarDolarSiToca } from '../../lib/dolar.js';
import { revisarEventos, eventoActivo } from '../../lib/eventos.js';

// Primera parte: lo que se ve al entrar (hasta PRIMERA) y, si son pocos, los siguientes hasta MINIMO.
// Del evento y de las ofertas alcanza con los primeros: la fila del inicio muestra 10 y el catálogo,
// cuando se filtra por ellos, espera a tener todo.
const PRIMERA = 800;
const MINIMO = 60;
const TANDA = 1000;
const DE_CADA_FILA = 48;

function dividir(lista, { fijos, evento }) {
  const enEvento = new Set(evento?.ids || []);
  const rebajado = (p) => p.presentaciones.some((x) => x.precioAnterior && x.precioAnterior > x.precio);
  const delEvento = new Set((evento?.ids || []).slice(0, DE_CADA_FILA));
  const ofertas = new Set(lista.filter((p) => rebajado(p) && !enEvento.has(p.id)).slice(0, DE_CADA_FILA).map((p) => p.id));
  const esImportante = (p) => p.destacado || fijos.has(p.id) || delEvento.has(p.id) || ofertas.has(p.id)
    || p.presentaciones.some((x) => Number(x.stock) > 0);
  const primeros = lista.filter(esImportante).slice(0, PRIMERA);
  const elegidos = new Set(primeros);
  for (const p of lista) {
    if (primeros.length >= MINIMO) break;
    if (!elegidos.has(p)) { primeros.push(p); elegidos.add(p); }
  }
  const resto = lista.filter((p) => !elegidos.has(p));
  const partes = [primeros];
  for (let i = 0; i < resto.length; i += TANDA) partes.push(resto.slice(i, i + TANDA));
  return partes;
}

export const onRequestGet = manejar(async ({ request, env, waitUntil }) => {
  const parte = Math.max(0, Math.min(50, Math.floor(Number(new URL(request.url).searchParams.get('parte')) || 0)));
  await asegurarEsquema(env);
  // Eventos automáticos que llegaron a su fecha (empiezan o terminan solos): cambian precios y suben la versión.
  await revisarEventos(env);
  let ajustes = await leerAjustes(env);
  // Los lunes se actualiza el dólar de la semana (una sola vez); eso sube la versión y renueva el catálogo.
  if (await actualizarDolarSiToca(env, ajustes)) ajustes = await leerAjustes(env);
  const hoy = hoyArgentina();
  const claveDe = (n) => new Request(`https://cache.essenze/catalogo?v=${ajustes.version}&d=${hoy}&p=${n}`);
  const cache = caches.default;
  const guardado = await cache.match(claveDe(parte));
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
    cartelera: ajustes.cartelera,
    seccionVendidos: ajustes.seccionVendidos,
    seccionOfertas: ajustes.seccionOfertas,
    popupCuentas: ajustes.popupCuentas,
    // Las páginas abiertas comparan esta versión con /api/vivo para saber si tienen que actualizarse.
    version: ajustes.version,
  };
  const perfumes = JSON.parse(await listaJSON(env, { soloVisibles: true }));
  // Los más vendidos de los últimos 6 meses (para la fila del inicio y el orden "Más vendidos" del catálogo).
  const { results: vendidos } = await env.DB.prepare(
    `SELECT json_extract(j.value, '$.id') AS id, SUM(json_extract(j.value, '$.cantidad')) AS unidades
     FROM pedidos p, json_each(p.items) j
     WHERE p.estado IN ('cobrado', 'entregado') AND p.creado >= date('now', '-180 days') AND json_extract(j.value, '$.id') IS NOT NULL
     GROUP BY 1 ORDER BY unidades DESC LIMIT 60`,
  ).all();
  const masVendidos = vendidos.map((v) => v.id);
  // Evento de precios en curso (Cyber Day…): su nombre arma una fila propia en el inicio.
  const evento = await eventoActivo(env);
  const fijos = new Set([...masVendidos, ...vigentes.map((o) => o.perfume).filter(Boolean)]);
  const partes = dividir(perfumes, { fijos, evento });
  // Se arman y guardan todas las partes juntas: las que pide la página después ya están listas.
  const cuerpos = partes.map((lista, n) => (n === 0
    ? JSON.stringify({ ajustes: publicos, ofertas: vigentes, evento, masVendidos, partes: partes.length, total: perfumes.length, perfumes: lista })
    : JSON.stringify({ v: ajustes.version, perfumes: lista })));
  const respuestas = cuerpos.map((c) => jsonCrudo(c, 200, { 'Cache-Control': 'public, max-age=30' }));
  waitUntil(Promise.all(respuestas.map((r, n) => cache.put(claveDe(n), r.clone()))));
  return respuestas[parte] || jsonCrudo(JSON.stringify({ v: ajustes.version, perfumes: [] }), 200, { 'Cache-Control': 'public, max-age=30' });
});
