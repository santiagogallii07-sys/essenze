// POST /api/admin/stock/compras {fecha, proveedor, moneda, pago, metodo, items} → registrar una compra de mercadería
import { manejar, json, leerJSON, sentenciaVersion, sentenciaCambio } from '../../../../../lib/util.js';
import { asegurarEsquema } from '../../../../../lib/esquema.js';
import { sentenciasCompra } from '../../../../../lib/stock.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const { id, sentencias, catalogo } = await sentenciasCompra(env, await leerJSON(request, 60_000));
  // Si sumó stock a perfumes del catálogo, la tienda se actualiza (entrega inmediata).
  await env.DB.batch([...sentencias, catalogo ? sentenciaVersion(env) : sentenciaCambio(env)]);
  return json({ ok: true, id }, 201);
});
