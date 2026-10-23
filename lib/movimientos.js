import { texto, numero, hoyArgentina, leerAjustes, ErrorCliente } from './util.js';

export const CATEGORIAS = {
  ingreso: ['Venta', 'Aporte', 'Otros ingresos'],
  egreso: ['Compra de mercadería', 'Costo de mercadería', 'Envíos', 'Publicidad', 'Packaging', 'Comisiones', 'Impuestos', 'Servicios', 'Retiro', 'Otros gastos'],
};

export async function limpiarMovimiento(env, d) {
  const tipo = d.tipo === 'ingreso' ? 'ingreso' : 'egreso';
  const categoria = CATEGORIAS[tipo].includes(d.categoria) ? d.categoria : CATEGORIAS[tipo].at(-1);
  const moneda = d.moneda === 'ARS' ? 'ARS' : 'USD';
  const original = numero(d.monto, 0);
  if (original <= 0) throw new ErrorCliente(400, 'El monto tiene que ser mayor a cero.');
  let cotizacion = null;
  let monto = original;
  if (moneda === 'ARS') {
    cotizacion = numero(d.cotizacion, 0) || (await leerAjustes(env)).cotizacion;
    if (!cotizacion) throw new ErrorCliente(400, 'Cargá la cotización del dólar en Ajustes.');
    monto = Math.round((original / cotizacion) * 100) / 100;
  }
  return {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina(),
    tipo,
    categoria,
    descripcion: texto(d.descripcion, 200),
    monto,
    moneda,
    monto_original: moneda === 'ARS' ? original : null,
    cotizacion,
  };
}
