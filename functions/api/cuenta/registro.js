// POST /api/cuenta/registro {email, contrasena, nombre?} → crea la cuenta y deja la sesión abierta.
import { manejar, json, error, leerJSON, texto, idAleatorio, ipDe, sentenciaCambio } from '../../../lib/util.js';
import { asegurarEsquema } from '../../../lib/esquema.js';
import { hashContrasena, crearSesion, emailValido } from '../../../lib/cuentas.js';
import { esHttps } from '../../../lib/sesion.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const d = await leerJSON(request, 5000);
  const email = texto(d.email, 160).toLowerCase();
  const contrasena = String(d.contrasena || '');
  if (!emailValido(email)) return error(400, 'Revisá el email: falta algo (ej. nombre@gmail.com).');
  if (contrasena.length < 6) return error(400, 'La contraseña tiene que tener al menos 6 letras o números.');
  if (contrasena.length > 200) return error(400, 'La contraseña es demasiado larga.');

  // Pocas cuentas nuevas por conexión y por hora (frena a los robots).
  const ip = `cuenta-nueva:${ipDe(request)}`;
  const { n } = await env.DB.prepare("SELECT count(*) AS n FROM intentos_login WHERE ip = ? AND fecha > datetime('now', '-1 hour')").bind(ip).first();
  if (n >= 5) return error(429, 'Se crearon muchas cuentas desde tu conexión. Probá en un rato.');

  const existe = await env.DB.prepare('SELECT 1 FROM clientes WHERE email = ?').bind(email).first();
  if (existe) return error(409, 'Ya hay una cuenta con ese email. Tocá "Ingresar".');

  const id = idAleatorio(16);
  const favoritos = Array.isArray(d.favoritos) ? d.favoritos.filter((x) => typeof x === 'string').slice(0, 60) : [];
  await env.DB.batch([
    env.DB.prepare('INSERT INTO clientes (id, email, nombre, clave, favoritos) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, texto(d.nombre, 120), await hashContrasena(contrasena), JSON.stringify(favoritos)),
    env.DB.prepare('INSERT INTO intentos_login (ip) VALUES (?)').bind(ip),
    sentenciaCambio(env),
  ]);
  const cookie = await crearSesion(env, id, esHttps(request));
  return json({ ok: true, cuenta: { email, nombre: texto(d.nombre, 120), puntos: 0 } }, 201, { 'Set-Cookie': cookie });
});
