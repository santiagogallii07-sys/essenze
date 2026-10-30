// GET / PUT /api/admin/ajustes → datos de la tienda, dólar (automático de los lunes o a mano) y cuentas de clientes.
import { manejar, json, leerJSON, leerAjustes, texto, numero, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';
import { FUENTES, actualizarDolarSiToca, fijarDolarDeHoy } from '../../../lib/dolar.js';

export const onRequestGet = manejar(async ({ env }) => {
  const ajustes = await leerAjustes(env);
  return json((await actualizarDolarSiToca(env, ajustes)) ? await leerAjustes(env) : ajustes);
});

export const onRequestPut = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 5000);
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 10) throw new ErrorCliente(400, 'El WhatsApp tiene que tener código de país y área, ej. 5493512484272.');
  const antes = await leerAjustes(env);
  const dolarAuto = d.dolarAuto !== false;
  const dolarFuente = FUENTES[d.dolarFuente] ? d.dolarFuente : 'blue';
  const valores = {
    whatsapp,
    ciudad: texto(d.ciudad, 80),
    instagram: texto(d.instagram, 60).replace(/^@/, ''),
    mostrar_ars: d.mostrarArs ? '1' : '0',
    mostrar_usd: d.mostrarUsd ? '1' : '0',
    filtro_inmediata: d.filtroInmediata ? '1' : '0',
    popup_cuentas: d.popupCuentas === false ? '0' : '1',
    comision_usd: String(Math.max(0, numero(d.comision, 3))),
    estilo_fotos: d.estiloFotos === 'oscuro' ? 'oscuro' : 'blanco',
    dolar_auto: dolarAuto ? '1' : '0',
    dolar_fuente: dolarFuente,
  };
  // Con el dólar a mano se guarda lo escrito; con el automático, el valor lo pone DolarApi.
  if (!dolarAuto) valores.cotizacion = String(Math.max(0, numero(d.cotizacion, 0)));
  await env.DB.batch([
    ...Object.entries(valores).map(([k, v]) =>
      env.DB.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(k, v)),
    sentenciaVersion(env),
  ]);
  // Si recién se prendió el automático o se eligió otro dólar, se trae el valor ya mismo.
  let avisoDolar = '';
  if (dolarAuto && (!antes.dolarAuto || antes.dolarFuente !== dolarFuente)) {
    try {
      await fijarDolarDeHoy(env, dolarFuente);
    } catch {
      avisoDolar = 'No se pudo traer el dólar ahora: se va a intentar de nuevo solo.';
    }
  }
  return json({ ...(await leerAjustes(env)), avisoDolar });
});
