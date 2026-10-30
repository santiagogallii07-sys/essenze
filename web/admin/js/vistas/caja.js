// Caja (cash flow): ingresos, egresos, saldo y margen del mes, con movimientos y gráfico.
import { api } from '../api.js';
import { icono, escapar, usd, ars, fecha, nombreMes, hoja, confirmar, aviso, avisoError, conCarga, hoy, demorar } from '../ui.js';
import { graficoMeses } from './resumen.js';
import { importarVentas } from '../ventas-excel.js';

function moverMes(mes, delta) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

async function dialogoMovimiento({ movimiento, categorias, cotizacion, tipoInicial = 'egreso' }) {
  const m = movimiento || { tipo: tipoInicial, categoria: '', monto: '', moneda: cotizacion ? 'ARS' : 'USD', fecha: hoy(), descripcion: '' };
  const montoInicial = m.moneda === 'ARS' ? m.monto_original : m.monto;
  const h = hoja({
    titulo: movimiento ? 'Editar movimiento' : 'Nuevo movimiento',
    ancho: 480,
    html: `
      <div class="segmentado" role="radiogroup" aria-label="Tipo">
        <label><input type="radio" name="tipo" value="egreso" ${m.tipo === 'egreso' ? 'checked' : ''}><span>Gasto</span></label>
        <label><input type="radio" name="tipo" value="ingreso" ${m.tipo === 'ingreso' ? 'checked' : ''}><span>Ingreso</span></label>
      </div>
      <label class="campo"><span>Categoría</span><select data-categoria></select></label>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Monto</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${montoInicial ?? ''}" data-monto required></label>
        <div class="campo"><span class="campo__rotulo">Moneda</span>
          <div class="segmentado"><label><input type="radio" name="moneda" value="USD" ${m.moneda !== 'ARS' ? 'checked' : ''}><span>USD</span></label><label><input type="radio" name="moneda" value="ARS" ${m.moneda === 'ARS' ? 'checked' : ''}><span>Pesos</span></label></div>
        </div>
      </div>
      <p class="campo__ayuda" data-conversion></p>
      <label class="campo"><span>Fecha</span><input type="date" value="${m.fecha}" data-fecha></label>
      <label class="campo"><span>Detalle</span><input data-descripcion value="${escapar(m.descripcion)}" placeholder="Ej. Compra a proveedor Lattafa" maxlength="200"></label>`,
    pie: `${movimiento ? `<button class="boton boton--peligro" type="button" data-borrar aria-label="Eliminar">${icono('basura')}</button>` : ''}<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>Guardar</button>`,
  });
  const d = h.dialogo;
  const pintarCategorias = () => {
    const tipo = d.querySelector('[name=tipo]:checked').value;
    d.querySelector('[data-categoria]').innerHTML = categorias[tipo].map((c) => `<option ${c === m.categoria ? 'selected' : ''}>${c}</option>`).join('');
  };
  const pintarConversion = () => {
    const ars_ = d.querySelector('[name=moneda]:checked').value === 'ARS';
    const v = Number(d.querySelector('[data-monto]').value);
    d.querySelector('[data-conversion]').textContent = ars_ && v && cotizacion ? `≈ ${usd(v / cotizacion)} con el dólar a ${ars(cotizacion)} (se cambia en Ajustes)` : '';
  };
  d.addEventListener('change', (e) => {
    if (e.target.name === 'tipo') pintarCategorias();
    pintarConversion();
  });
  d.querySelector('[data-monto]').addEventListener('input', pintarConversion);
  pintarCategorias();
  pintarConversion();
  setTimeout(() => d.querySelector('[data-monto]').focus(), 80);

  d.querySelector('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const datos = {
      tipo: d.querySelector('[name=tipo]:checked').value,
      categoria: d.querySelector('[data-categoria]').value,
      monto: d.querySelector('[data-monto]').value,
      moneda: d.querySelector('[name=moneda]:checked').value,
      fecha: d.querySelector('[data-fecha]').value,
      descripcion: d.querySelector('[data-descripcion]').value,
    };
    try {
      if (movimiento) await api(`/movimientos/${movimiento.id}`, { metodo: 'PUT', datos });
      else await api('/movimientos', { metodo: 'POST', datos });
      aviso(datos.tipo === 'egreso' ? 'Gasto guardado' : 'Ingreso guardado');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  d.querySelector('[data-borrar]')?.addEventListener('click', async () => {
    h.cerrar();
    if (await confirmar('¿Eliminar este movimiento?', { aceptar: 'Eliminar', peligro: true })) {
      await api(`/movimientos/${movimiento.id}`, { metodo: 'DELETE' }).catch(avisoError);
      document.dispatchEvent(new CustomEvent('caja:recargar'));
    }
  });
  return h.cerrada.then((v) => v === true);
}

function csv(movimientos, mes) {
  const filas = [['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Monto USD', 'Moneda original', 'Monto original', 'Cotización']];
  for (const m of movimientos) filas.push([m.fecha, m.tipo, m.categoria, m.descripcion, m.monto, m.moneda, m.monto_original ?? '', m.cotizacion ?? '']);
  const texto = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
  a.download = `essenze-caja-${mes}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function montar({ vista, consulta, app }) {
  app.titulo('Caja');
  const nuevo = document.createElement('button');
  nuevo.className = 'boton boton--lleno boton--chico';
  nuevo.type = 'button';
  nuevo.innerHTML = `${icono('mas')}<span>Movimiento</span>`;
  const importar = document.createElement('button');
  importar.className = 'boton-icono';
  importar.type = 'button';
  importar.setAttribute('aria-label', 'Importar ventas desde Excel');
  importar.title = 'Importar ventas desde Excel';
  importar.innerHTML = icono('tabla');
  app.acciones([importar, nuevo]);

  let mes = sessionStorage.getItem('admin-caja-mes') || hoy().slice(0, 7);
  let datos;
  let resumen;
  let q = '';
  let resultadosBusqueda = [];
  const { cotizacion } = await api('/ajustes');

  async function cargar() {
    sessionStorage.setItem('admin-caja-mes', mes);
    [datos, resumen] = await Promise.all([api(`/movimientos?mes=${mes}`), api(`/resumen?mes=${mes}`)]);
    pintar();
  }

  function pintar() {
    const c = resumen.caja;
    const fmt = (n) => (resumen.moneda === 'ARS' ? ars(n) : usd(n));
    const maxCat = Math.max(1, ...resumen.egresosPorCategoria.map((x) => x.total));
    const esActual = mes === hoy().slice(0, 7);
    vista.innerHTML = `
      <div class="selector-mes">
        <button class="boton-icono" type="button" data-mes="-1" aria-label="Mes anterior">${icono('flechaIzq')}</button>
        <span class="selector-mes__nombre">${nombreMes(mes)}</span>
        <button class="boton-icono" type="button" data-mes="1" aria-label="Mes siguiente" ${esActual ? 'disabled' : ''}>${icono('flecha')}</button>
      </div>

      <div class="cifras">
        <div class="cifra cifra--positiva"><span class="cifra__rotulo">Ingresos</span><span class="cifra__valor">${fmt(c.ingresos)}</span><span class="cifra__nota">Ventas ${fmt(c.ventas)} · ${c.unidades} perfumes</span></div>
        <div class="cifra cifra--negativa"><span class="cifra__rotulo">Egresos</span><span class="cifra__valor">${fmt(c.egresos)}</span><span class="cifra__nota">Comisiones ${fmt(c.comisiones)}</span></div>
        <div class="cifra ${c.saldo >= 0 ? '' : 'cifra--negativa'}"><span class="cifra__rotulo">Saldo</span><span class="cifra__valor">${fmt(c.saldo)}</span><span class="cifra__nota">${resumen.moneda === 'ARS' && resumen.dolar ? usd(c.saldo / resumen.dolar) : 'Ingresos − egresos'}</span></div>
        <div class="cifra"><span class="cifra__rotulo">Ganancia de ventas</span><span class="cifra__valor">${fmt(c.margen)}</span><span class="cifra__nota">${c.ventas ? `${Math.round((c.margen / c.ventas) * 100)}% · costo ${fmt(c.costoVendido)}` : 'Sin ventas'}</span></div>
      </div>

      <div class="grilla-admin grilla-admin--2" style="margin-top:12px">
        <section class="tarjeta-admin">
          <h3 class="tarjeta-admin__titulo">Últimos 6 meses</h3>
          ${graficoMeses(resumen.meses, fmt)}
        </section>
        <section class="tarjeta-admin">
          <h3 class="tarjeta-admin__titulo">Gastos por categoría</h3>
          ${resumen.egresosPorCategoria.length ? resumen.egresosPorCategoria.map((x) => `
            <div class="barra-h"><span>${escapar(x.categoria)}</span><span class="num">${fmt(x.total)}</span>
              <span class="barra-h__pista"><span style="width:${(x.total / maxCat) * 100}%"></span></span></div>`).join('') : '<p class="cifra__nota">Sin gastos este mes.</p>'}
        </section>
      </div>

      <section class="tarjeta-admin" style="margin-top:12px">
        <h3 class="tarjeta-admin__titulo">Movimientos <button type="button" data-csv>${datos.movimientos.length ? 'Descargar planilla' : ''}</button></h3>
        <label class="buscador-admin" style="margin-bottom:10px">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar en todos los meses: perfume, cliente, gasto…" value="${escapar(q)}" autocomplete="off" enterkeyhint="search" aria-label="Buscar movimientos" data-q-caja></label>
        <div data-lista-mov>${q ? '' : listaMovimientos(datos.movimientos)}</div>
      </section>`;
    if (q) buscarMovimientos();
  }

  function listaMovimientos(movimientos) {
    const enPesos = (m) => (m.moneda === 'ARS' ? m.monto_original : m.monto * (m.cotizacion || resumen.dolar));
    if (!movimientos.length) {
      return q
        ? `<p class="cifra__nota">No hay movimientos con "${escapar(q)}".</p>`
        : `<div class="vacio-admin">${icono('caja')}<p>Sin movimientos en ${nombreMes(mes).toLowerCase()}.</p><p class="vacio-admin__detalle">Las ventas cobradas se suman solas. Cargá acá compras de mercadería, envíos, publicidad y otros gastos.</p></div>`;
    }
    return `<ul class="lista-admin">${movimientos.map((m) => `
      <li><button class="movimiento movimiento--${m.tipo}" type="button" data-mov="${m.id}">
        <span class="movimiento__titulo">${escapar(m.descripcion || m.categoria)}</span>
        <span class="movimiento__monto">${m.tipo === 'egreso' ? '−' : '+'}${resumen.moneda === 'ARS' ? ars(enPesos(m)) : usd(m.monto)}<small>${usd(m.monto)}</small></span>
        <span class="movimiento__sub">${fecha(m.fecha)} · ${escapar(m.categoria)}${m.pedido ? ' · desde pedido' : ''}</span>
      </button></li>`).join('')}</ul>`;
  }

  // La búsqueda recorre todos los meses (incluye los perfumes de las ventas).
  async function buscarMovimientos() {
    const buscado = q;
    const r = await api(`/movimientos?q=${encodeURIComponent(buscado)}`).catch(() => ({ movimientos: [] }));
    if (buscado !== q) return;
    resultadosBusqueda = r.movimientos;
    vista.querySelector('[data-lista-mov]').innerHTML = `<p class="contador-resultados">${r.movimientos.length} ${r.movimientos.length === 1 ? 'movimiento' : 'movimientos'} en todos los meses</p>${listaMovimientos(r.movimientos)}`;
  }

  vista.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mes]');
    if (b) {
      mes = moverMes(mes, Number(b.dataset.mes));
      cargar();
      return;
    }
    if (e.target.closest('[data-csv]') && datos.movimientos.length) {
      csv(datos.movimientos, mes);
      return;
    }
    const mov = e.target.closest('[data-mov]');
    if (mov) {
      const m = [...datos.movimientos, ...resultadosBusqueda].find((x) => x.id === mov.dataset.mov);
      if (m.pedido) {
        aviso('Este ingreso viene de un pedido: se cambia desde Pedidos.', 'error');
        return;
      }
      if (await dialogoMovimiento({ movimiento: m, categorias: datos.categorias, cotizacion })) cargar();
    }
  });
  vista.addEventListener('input', demorar((e) => {
    if (!e.target.matches('[data-q-caja]')) return;
    q = e.target.value.trim();
    if (q) buscarMovimientos();
    else vista.querySelector('[data-lista-mov]').innerHTML = listaMovimientos(datos.movimientos);
  }, 250));
  const recargar = () => cargar();
  document.addEventListener('caja:recargar', recargar);
  importar.addEventListener('click', async () => {
    if (await importarVentas()) cargar();
  });
  nuevo.addEventListener('click', async () => {
    if (await dialogoMovimiento({ categorias: datos.categorias, cotizacion })) cargar();
  });

  await cargar();
  if (consulta.has('gasto')) nuevo.click();
  return () => document.removeEventListener('caja:recargar', recargar);
}
