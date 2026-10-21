// GET /api/admin/resumen?mes=AAAA-MM → números del tablero: caja del mes, 6 meses, pedidos y catálogo.
// Los montos salen en pesos (si hay dólar cargado); cada movimiento usa el dólar del día en que se registró.
import { manejar, json, hoyArgentina, leerAjustes } from '../../../lib/util.js';

function mesesAtras(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    lista.push(d.toISOString().slice(0, 7));
  }
  return lista;
}

export const onRequestGet = manejar(async ({ request, env }) => {
  const pedido = new URL(request.url).searchParams.get('mes');
  const mes = /^\d{4}-\d{2}$/.test(pedido || '') ? pedido : hoyArgentina().slice(0, 7);
  const meses = mesesAtras(mes, 6);
  const DB = env.DB;
  const dolar = Number((await leerAjustes(env)).cotizacion) || 0;
  const moneda = dolar ? 'ARS' : 'USD';
  const M = dolar ? `(CASE WHEN m.moneda = 'ARS' THEN m.monto_original ELSE m.monto * COALESCE(m.cotizacion, ${dolar}) END)` : 'm.monto';
  const dolarPedido = dolar
    ? `COALESCE((SELECT v.cotizacion FROM movimientos v WHERE v.pedido = p.id AND v.categoria = 'Venta' LIMIT 1), ${dolar})`
    : '1';

  const [caja, historia, costo, categorias, estados, catalogo, stockBajo, masVendidos, ultimos] = await DB.batch([
    DB.prepare(`SELECT
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' THEN ${M} END), 0) AS ingresos,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' THEN ${M} END), 0) AS egresos,
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' AND m.categoria = 'Venta' THEN ${M} END), 0) AS ventas,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' AND m.categoria = 'Comisiones' THEN ${M} END), 0) AS comisiones
      FROM movimientos m WHERE substr(m.fecha, 1, 7) = ?`).bind(mes),
    DB.prepare(`SELECT substr(m.fecha, 1, 7) AS mes,
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' THEN ${M} END), 0) AS ingresos,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' THEN ${M} END), 0) AS egresos
      FROM movimientos m WHERE substr(m.fecha, 1, 7) BETWEEN ? AND ? GROUP BY 1`).bind(meses[0], meses.at(-1)),
    DB.prepare(`SELECT coalesce(sum(p.costo_total * ${dolarPedido}), 0) AS costo, count(*) AS cantidad,
        coalesce(sum((SELECT sum(json_extract(j.value, '$.cantidad')) FROM json_each(p.items) j)), 0) AS unidades
      FROM pedidos p WHERE p.estado IN ('cobrado', 'entregado') AND substr(p.cobrado_en, 1, 7) = ?`).bind(mes),
    DB.prepare(`SELECT m.categoria, sum(${M}) AS total FROM movimientos m
      WHERE m.tipo = 'egreso' AND substr(m.fecha, 1, 7) = ? GROUP BY m.categoria ORDER BY total DESC`).bind(mes),
    DB.prepare('SELECT estado, count(*) AS n FROM pedidos GROUP BY estado'),
    DB.prepare(`SELECT count(*) AS total, sum(visible) AS visibles,
        sum(CASE WHEN imagen IS NULL THEN 1 ELSE 0 END) AS sinFoto,
        sum(CASE WHEN revisar != '' THEN 1 ELSE 0 END) AS revisar,
        sum(CASE WHEN EXISTS (SELECT 1 FROM json_each(presentaciones) WHERE json_extract(value, '$.precioAnterior') IS NOT NULL) THEN 1 ELSE 0 END) AS enOferta
      FROM perfumes`),
    DB.prepare(`SELECT p.id, p.marca, p.nombre, json_extract(j.value, '$.ml') AS ml, json_extract(j.value, '$.stock') AS stock
      FROM perfumes p, json_each(p.presentaciones) j
      WHERE p.visible = 1 AND json_extract(j.value, '$.stock') IS NOT NULL AND json_extract(j.value, '$.stock') <= 1
      ORDER BY stock, p.marca LIMIT 12`),
    DB.prepare(`SELECT json_extract(j.value, '$.id') AS id, json_extract(j.value, '$.marca') AS marca,
        json_extract(j.value, '$.nombre') AS nombre, sum(json_extract(j.value, '$.cantidad')) AS unidades
      FROM pedidos p, json_each(p.items) j
      WHERE p.estado IN ('cobrado', 'entregado') AND substr(p.cobrado_en, 1, 7) = ?
      GROUP BY coalesce(json_extract(j.value, '$.id'), lower(json_extract(j.value, '$.nombre')))
      ORDER BY unidades DESC LIMIT 5`).bind(mes),
    DB.prepare(`SELECT p.id, p.creado, p.estado, p.nombre, p.total * ${dolarPedido} AS total, p.origen
      FROM pedidos p ORDER BY p.creado DESC LIMIT 6`),
  ]);

  const c = caja.results[0];
  const porMes = new Map(historia.results.map((r) => [r.mes, r]));
  const costoVendido = costo.results[0].costo;
  return json({
    mes,
    moneda,
    dolar,
    caja: {
      ingresos: c.ingresos,
      egresos: c.egresos,
      saldo: c.ingresos - c.egresos,
      ventas: c.ventas,
      costoVendido,
      comisiones: c.comisiones,
      // Ganancia de las ventas: lo cobrado menos lo que costaron los perfumes y la comisión del pasante.
      margen: c.ventas - costoVendido - c.comisiones,
      ventasCobradas: costo.results[0].cantidad,
      unidades: costo.results[0].unidades,
    },
    meses: meses.map((m) => ({ mes: m, ingresos: porMes.get(m)?.ingresos || 0, egresos: porMes.get(m)?.egresos || 0 })),
    egresosPorCategoria: categorias.results,
    pedidos: Object.fromEntries(estados.results.map((r) => [r.estado, r.n])),
    catalogo: catalogo.results[0],
    stockBajo: stockBajo.results,
    masVendidos: masVendidos.results,
    ultimos: ultimos.results,
  });
});
