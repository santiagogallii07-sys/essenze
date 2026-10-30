// POST /api/cuenta/ingreso {email, contrasena} → abre la sesión del cliente (30 días).
import { manejar, json, error, leerJSON, texto, ipDe } from '../../../lib/util.js';
import { asegurarEsquema } from '../../../lib/esquema.js';
import { verificarContrasena, crearSesion } from '../../../lib/cuentas.js';
import { esHttps } from '../../../lib/sesion.js';

const MAX_INTENTOS = 10;

export const onRequestPost = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const ip = `cuenta:${ipDe(request)}`;
  const { n } = await env.DB.prepare("SELECT count(*) AS n FROM intentos_login WHERE ip = ? AND fecha > datetime('now', '-15 minutes')").bind(ip).first();
  if (n >= MAX_INTENTOS) return error(429, 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.');

  const d = await leerJSON(request, 5000);
  const email = texto(d.email, 160).toLowerCase();
  const c = await env.DB.prepare('SELECT id, email, nombre, clave FROM clientes WHERE email = ?').bind(email).first();
  if (!c || !(await verificarContrasena(String(d.contrasena || ''), c.clave))) {
    await env.DB.prepare('INSERT INTO intentos_login (ip) VALUES (?)').bind(ip).run();
    return error(401, 'El email o la contraseña no coinciden.');
  }
  await env.DB.prepare('DELETE FROM intentos_login WHERE ip = ?').bind(ip).run();
  const cookie = await crearSesion(env, c.id, esHttps(request));
  return json({ ok: true, cuenta: { email: c.email, nombre: c.nombre } }, 200, { 'Set-Cookie': cookie });
});
