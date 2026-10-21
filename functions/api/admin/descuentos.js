// POST /api/admin/descuentos → cambia precios de muchos perfumes de una vez.
// Alcance: ids (uno o varios perfumes), marca, tipo o todos.
// Acciones:
//   aplicar   → descuento %: el precio actual queda tachado y el nuevo con el descuento.
//   quitar    → vuelve al precio anterior (saca el descuento).
//   aumentar  → sube (o baja con valor negativo) el precio en % o en USD fijos; si hay descuento, se ajustan los dos.
//   margen    → precio = costo + % de ganancia (solo los tamaños que tienen costo cargado).
import { manejar, json, leerJSON, numero, texto, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';

const ACCIONES = ['aplicar', 'quitar', 'aumentar', 'margen'];
const redondo = (n) => Math.max(1, Math.round(n));

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 200_000);
  const accion = ACCIONES.includes(d.accion) ? d.accion : 'aplicar';
  const valor = numero(d.porcentaje ?? d.valor, 0);
  const enDolares = d.modo === 'monto';
  if (accion === 'aplicar' && (valor <= 0 || valor >= 90)) throw new ErrorCliente(400, 'El descuento tiene que estar entre 1% y 89%.');
  if (accion === 'aumentar' && (!valor || (!enDolares && valor <= -90))) throw new ErrorCliente(400, 'Indicá cuánto aumentar.');
  if (accion === 'margen' && valor < 0) throw new ErrorCliente(400, 'La ganancia no puede ser negativa.');

  const condiciones = [];
  const valores = [];
  if (d.marca) { condiciones.push('marca = ?'); valores.push(texto(d.marca, 80)); }
  if (d.tipo) { condiciones.push('tipo = ?'); valores.push(texto(d.tipo, 40)); }
  if (Array.isArray(d.ids) && d.ids.length) { condiciones.push('id IN (SELECT value FROM json_each(?))'); valores.push(JSON.stringify(d.ids.slice(0, 3000))); }
  if (!condiciones.length && !d.todos) throw new ErrorCliente(400, 'Elegí un perfume, una marca, un tipo o todos.');

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(`SELECT id, presentaciones FROM perfumes ${where}`).bind(...valores).all();
  const ajustar = (p) => (enDolares ? p + valor : p * (1 + valor / 100));

  const sentencias = [];
  let cambiados = 0;
  for (const fila of results) {
    const antes = fila.presentaciones;
    const pres = JSON.parse(antes || '[]').map((x) => {
      const base = x.precioAnterior && x.precioAnterior > x.precio ? x.precioAnterior : x.precio;
      if (accion === 'quitar') return { ...x, precio: base, precioAnterior: null };
      if (accion === 'aplicar') return { ...x, precio: redondo(base * (1 - valor / 100)), precioAnterior: base };
      if (accion === 'aumentar') {
        if (x.precioAnterior && x.precioAnterior > x.precio) {
          return { ...x, precio: redondo(ajustar(x.precio)), precioAnterior: redondo(ajustar(x.precioAnterior)) };
        }
        return { ...x, precio: redondo(ajustar(x.precio)) };
      }
      // margen: solo si hay costo cargado
      if (x.costo === null || x.costo === undefined || x.costo <= 0) return x;
      return { ...x, precio: redondo(x.costo * (1 + valor / 100)), precioAnterior: null };
    });
    const nuevo = JSON.stringify(pres);
    if (nuevo === antes) continue;
    cambiados++;
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(nuevo, fila.id));
  }
  for (let i = 0; i < sentencias.length; i += 100) await env.DB.batch(sentencias.slice(i, i + 100));
  await sentenciaVersion(env).run();
  return json({ ok: true, perfumes: cambiados });
});
