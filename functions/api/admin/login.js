// POST /api/admin/login {contrasena} · DELETE /api/admin/login (cerrar sesión) · GET (¿hay sesión?)
import { manejar, json, error, leerJSON, ipDe } from '../../../lib/util.js';
import { cookieDeSesion, cookieDeCierre, contrasenaCorrecta, sesionValida, esHttps } from '../../../lib/sesion.js';

const MAX_INTENTOS = 8;

export const onRequestPost = manejar(async ({ request, env }) => {
  const ip = ipDe(request);
  const { n } = await env.DB.prepare(
    "SELECT count(*) AS n FROM intentos_login WHERE ip = ? AND fecha > datetime('now', '-15 minutes')",
  ).bind(ip).first();
  if (n >= MAX_INTENTOS) return error(429, 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.');

  const { contrasena } = await leerJSON(request, 2000);
  if (!(await contrasenaCorrecta(env, contrasena))) {
    await env.DB.prepare('INSERT INTO intentos_login (ip) VALUES (?)').bind(ip).run();
    return error(401, 'Contraseña incorrecta.');
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM intentos_login WHERE ip = ?').bind(ip),
    env.DB.prepare("DELETE FROM intentos_login WHERE fecha < datetime('now', '-1 day')"),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': await cookieDeSesion(env, esHttps(request)) });
});

export const onRequestDelete = ({ request }) => json({ ok: true }, 200, { 'Set-Cookie': cookieDeCierre(esHttps(request)) });

export const onRequestGet = manejar(async ({ request, env }) => json({ sesion: await sesionValida(request, env) }));
