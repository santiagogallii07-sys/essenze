// PUT /api/admin/personaje {activo, titulo, texto, boton, enlace} → banner animado del cocodrilo en la cartelera.
import { manejar, json, leerJSON, leerAjustes, texto, sentenciaVersion } from '../../../lib/util.js';

export const onRequestPut = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 4000);
  const enlace = texto(d.enlace, 300);
  const valor = {
    activo: !!d.activo,
    titulo: texto(d.titulo, 80) || 'El lujo en cada nota',
    texto: texto(d.texto, 140),
    boton: texto(d.boton, 40) || 'Ver catálogo',
    // Igual que las ofertas: solo enlaces de la tienda (empiezan con /) o https.
    enlace: /^\/[^\s"'<>]*$/.test(enlace) || /^https:\/\/[^\s"'<>]+$/.test(enlace) ? enlace : '/catalogo',
  };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('personaje', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(valor)),
    sentenciaVersion(env),
  ]);
  return json((await leerAjustes(env)).personaje);
});
