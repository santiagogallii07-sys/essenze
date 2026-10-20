import { ErrorCliente, texto } from './util.js';

const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

export function limpiarOferta(e) {
  const titulo = texto(e.titulo, 80);
  if (!titulo) throw new ErrorCliente(400, 'La oferta necesita un título.');
  const enlace = texto(e.enlace, 300);
  return {
    etiqueta: texto(e.etiqueta, 40),
    titulo,
    texto: texto(e.texto, 240),
    boton: texto(e.boton, 30) || 'Ver más',
    enlace: /^\/[^\s"'<>]*$/.test(enlace) || /^https:\/\/[^\s"'<>]+$/.test(enlace) ? enlace : '/catalogo',
    perfume: texto(e.perfume, 100) || null,
    imagen: /^[a-z0-9-]{6,40}$/.test(e.imagen || '') ? e.imagen : null,
    activa: e.activa === false || e.activa === 0 ? 0 : 1,
    desde: fecha(e.desde),
    hasta: fecha(e.hasta),
  };
}
