// Pedidos de la web y ventas manuales: estados, cobro (va a la caja y descuenta stock) y WhatsApp al cliente.
import { api } from '../api.js';
import { icono, escapar, usd, fechaHora, hoja, confirmar, aviso, avisoError, conCarga, miniatura, ESTADOS, whatsappDe, hoy, demorar } from '../ui.js';
import { iconoWhatsapp } from '/js/iconos.js';

const METODOS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Dólares en efectivo', 'Otro'];
const SIGUIENTE = { nuevo: 'confirmado', confirmado: 'cobrado', cobrado: 'entregado' };
const TEXTO_SIGUIENTE = { nuevo: 'Confirmar', confirmado: 'Cobrar', cobrado: 'Marcar entregado' };

function tarjeta(p) {
  const wa = whatsappDe(p.telefono);
  const saludo = encodeURIComponent(`Hola ${p.nombre.split(' ')[0] || ''}! Te escribo de Essenze por tu pedido ${p.id}.`);
  return `
    <article class="tarjeta-pedido" data-id="${escapar(p.id)}">
      <div class="tarjeta-pedido__cabeza">
        <span class="tarjeta-pedido__numero">${escapar(p.id)}</span>
        <span class="estado estado--${p.estado}">${ESTADOS[p.estado]}</span>
        <span class="tarjeta-pedido__total">${usd(p.total)}</span>
      </div>
      <div class="tarjeta-pedido__cliente">
        <span>${escapar(p.nombre || 'Venta sin nombre')} <span class="origen">· ${p.origen === 'manual' ? 'venta manual' : 'web'}</span></span>
        <small>${[p.telefono, p.email].filter(Boolean).map(escapar).join(' · ')}${p.telefono || p.email ? ' · ' : ''}${fechaHora(p.creado)}</small>
      </div>
      <ul class="tarjeta-pedido__items">
        ${p.items.map((i) => `<li><span>${i.cantidad} ×</span><span>${escapar(i.marca)} ${escapar(i.nombre)}${i.ml ? ` · ${i.ml} ml` : ''}</span><span>${usd(i.precio * i.cantidad)}</span></li>`).join('')}
      </ul>
      ${p.comentario ? `<p class="tarjeta-pedido__notas">Cliente: ${escapar(p.comentario)}</p>` : ''}
      ${p.notas ? `<p class="tarjeta-pedido__notas">Nota interna: ${escapar(p.notas)}</p>` : ''}
      ${p.cobrado !== null && p.cobrado !== undefined ? `<p class="cifra__nota">Cobrado ${usd(p.cobrado)}${p.metodo_pago ? ` · ${escapar(p.metodo_pago)}` : ''}${p.costo_total ? ` · ganancia ${usd(p.cobrado - p.costo_total)}` : ''}</p>` : ''}
      <div class="tarjeta-pedido__acciones">
        ${wa ? `<a class="boton boton--suave boton--chico" href="https://wa.me/${wa}?text=${saludo}" target="_blank" rel="noopener">${iconoWhatsapp()} WhatsApp</a>` : ''}
        ${SIGUIENTE[p.estado] ? `<button class="boton boton--lleno boton--chico" type="button" data-siguiente>${TEXTO_SIGUIENTE[p.estado]}</button>` : ''}
        <button class="boton-icono" type="button" data-opciones aria-label="Más opciones">${icono('puntos')}</button>
      </div>
    </article>`;
}

function dialogoCobro(pedido) {
  const h = hoja({
    titulo: `Cobrar ${pedido.id}`,
    ancho: 460,
    html: `
      <label class="campo"><span>Monto cobrado (USD)</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${pedido.total}" data-monto></label>
      <label class="campo"><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option ${pedido.metodo_pago === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="campo"><span>Fecha del cobro</span><input type="date" value="${hoy()}" data-fecha></label>
      <p class="campo__ayuda">Se registra el ingreso en la caja y se descuenta el stock de los perfumes que lo controlan.</p>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Registrar cobro</button>',
  });
  h.dialogo.querySelector('[data-ok]').addEventListener('click', () => h.cerrar({
    cobrado: h.dialogo.querySelector('[data-monto]').value,
    metodo_pago: h.dialogo.querySelector('[data-metodo]').value,
    fecha: h.dialogo.querySelector('[data-fecha]').value,
  }));
  return h.cerrada;
}

async function dialogoVenta() {
  const lista = await api('/perfumes');
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lineas = [];
  const h = hoja({
    titulo: 'Registrar venta',
    ancho: 640,
    html: `
      <p class="campo__ayuda">Para ventas en persona, por Instagram o cualquier otro canal. Queda cobrada y suma a la caja.</p>
      <div class="campo selector-perfume">
        <span>Agregar perfume</span>
        <input class="entrada" data-buscar placeholder="Buscar marca o nombre…" autocomplete="off" enterkeyhint="search">
        <div class="resultados-busqueda" data-resultados hidden></div>
      </div>
      <div class="lineas-venta" data-lineas></div>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Cliente (opcional)</span><input data-nombre autocomplete="off"></label>
        <label class="campo"><span>Teléfono (opcional)</span><input data-telefono type="tel" inputmode="tel" autocomplete="off"></label>
        <label class="campo"><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" value="${hoy()}" data-fecha></label>
        <label class="campo ancho-total"><span>Total cobrado (USD)</span><input type="number" inputmode="decimal" step="0.01" min="0" data-total placeholder="Se calcula solo"></label>
      </div>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>Registrar venta</button>',
  });
  const d = h.dialogo;
  const buscar = d.querySelector('[data-buscar]');
  const resultados = d.querySelector('[data-resultados]');
  const contLineas = d.querySelector('[data-lineas]');

  function total() {
    return lineas.reduce((n, l) => n + (Number(l.precio) || 0) * (Number(l.cantidad) || 0), 0);
  }
  function pintarLineas() {
    contLineas.innerHTML = lineas.map((l, i) => {
      const p = lista.find((x) => x.id === l.id);
      return `
        <div class="linea-venta" data-i="${i}">
          <span class="fila-admin__texto"><span class="fila-admin__titulo">${escapar(p.marca)} · ${escapar(p.nombre)}</span></span>
          <button class="boton-icono" type="button" data-quitar aria-label="Quitar">${icono('cerrar')}</button>
          <div class="linea-venta__datos">
            <label class="campo"><span>Tamaño</span><select data-campo="ml">${p.presentaciones.map((x) => `<option value="${x.ml}" ${x.ml === l.ml ? 'selected' : ''}>${x.ml ? `${x.ml} ml` : 'Único'}</option>`).join('')}</select></label>
            <label class="campo"><span>Cantidad</span><input type="number" inputmode="numeric" min="1" value="${l.cantidad}" data-campo="cantidad"></label>
            <label class="campo"><span>Precio c/u</span><input type="number" inputmode="decimal" min="0" step="0.01" value="${l.precio}" data-campo="precio"></label>
          </div>
        </div>`;
    }).join('');
    d.querySelector('[data-total]').placeholder = lineas.length ? `${usd(total())} (calculado)` : 'Se calcula solo';
  }
  buscar.addEventListener('input', demorar(() => {
    const q = norm(buscar.value).split(/\s+/).filter(Boolean);
    const r = q.length ? lista.filter((p) => q.every((w) => norm(`${p.marca} ${p.nombre}`).includes(w))).slice(0, 8) : [];
    resultados.hidden = !r.length;
    resultados.innerHTML = r.map((p) => `<button type="button" data-id="${escapar(p.id)}">${miniatura(p)}<span>${escapar(p.marca)} · ${escapar(p.nombre)}</span></button>`).join('');
  }, 120));
  resultados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = lista.find((x) => x.id === b.dataset.id);
    const pres = p.presentaciones[0];
    lineas.push({ id: p.id, ml: pres.ml, cantidad: 1, precio: pres.precio });
    buscar.value = '';
    resultados.hidden = true;
    pintarLineas();
    buscar.focus();
  });
  contLineas.addEventListener('input', (e) => {
    const i = Number(e.target.closest('[data-i]')?.dataset.i);
    const campo = e.target.dataset.campo;
    if (!campo) return;
    lineas[i][campo] = Number(e.target.value);
    if (campo === 'ml') {
      const p = lista.find((x) => x.id === lineas[i].id);
      lineas[i].precio = p.presentaciones.find((x) => x.ml === lineas[i].ml)?.precio ?? lineas[i].precio;
      pintarLineas();
    } else {
      d.querySelector('[data-total]').placeholder = `${usd(total())} (calculado)`;
    }
  });
  contLineas.addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    lineas.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
    pintarLineas();
  });
  d.querySelector('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!lineas.length) return aviso('Agregá al menos un perfume.', 'error');
    try {
      await api('/pedidos', {
        metodo: 'POST',
        datos: {
          items: lineas,
          nombre: d.querySelector('[data-nombre]').value,
          telefono: d.querySelector('[data-telefono]').value,
          metodo_pago: d.querySelector('[data-metodo]').value,
          fecha: d.querySelector('[data-fecha]').value,
          cobrado: d.querySelector('[data-total]').value,
        },
      });
      aviso('Venta registrada');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));
  setTimeout(() => buscar.focus(), 80);
  return h.cerrada.then((v) => v === true);
}

export async function montar({ vista, consulta, app }) {
  app.titulo('Pedidos');
  const venta = document.createElement('button');
  venta.className = 'boton boton--lleno boton--chico';
  venta.type = 'button';
  venta.innerHTML = `${icono('mas')}<span>Venta</span>`;
  app.acciones(venta);

  const estado = { filtro: sessionStorage.getItem('admin-pedidos-filtro') || 'nuevo', q: '' };
  let datos = { pedidos: [], cuentas: {} };

  vista.innerHTML = `
    <div class="herramientas-admin">
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar número, nombre o teléfono" data-q enterkeyhint="search" aria-label="Buscar pedidos"></label>
      <div class="chips-admin" data-filtros role="group" aria-label="Estado"></div>
    </div>
    <div data-lista></div>`;
  const lista = vista.querySelector('[data-lista]');

  async function cargar() {
    const params = new URLSearchParams();
    if (estado.filtro !== 'todos') params.set('estado', estado.filtro);
    if (estado.q) params.set('q', estado.q);
    datos = await api(`/pedidos?${params}`);
    sessionStorage.setItem('admin-pedidos-filtro', estado.filtro);
    pintar();
    app.refrescarPedidos();
  }

  function pintar() {
    const total = Object.values(datos.cuentas).reduce((a, b) => a + b, 0);
    vista.querySelector('[data-filtros]').innerHTML = [...Object.entries(ESTADOS), ['todos', 'Todos']].map(([k, v]) => {
      const n = k === 'todos' ? total : datos.cuentas[k] || 0;
      return `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${estado.filtro === k}">${v}<span>${n}</span></button>`;
    }).join('');
    lista.innerHTML = datos.pedidos.length
      ? datos.pedidos.map(tarjeta).join('')
      : `<div class="vacio-admin">${icono('recibo')}<p>${estado.filtro === 'nuevo' ? 'No hay pedidos nuevos.' : 'No hay pedidos acá.'}</p><p class="vacio-admin__detalle">Los pedidos que los clientes mandan por WhatsApp desde la web aparecen solos en "Nuevos".</p></div>`;
  }

  async function cambiarEstado(p, nuevo, extra = {}) {
    try {
      await api(`/pedidos/${encodeURIComponent(p.id)}`, { metodo: 'PUT', datos: { estado: nuevo, ...extra } });
      aviso(`Pedido ${ESTADOS[nuevo].toLowerCase()}`);
      await cargar();
    } catch (err) {
      avisoError(err);
    }
  }

  vista.querySelector('[data-filtros]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    cargar();
  });
  vista.querySelector('[data-q]').addEventListener('input', demorar((e) => {
    estado.q = e.target.value.trim();
    if (estado.q) estado.filtro = 'todos';
    cargar();
  }, 250));

  lista.addEventListener('click', async (e) => {
    const art = e.target.closest('[data-id]');
    if (!art) return;
    const p = datos.pedidos.find((x) => x.id === art.dataset.id);
    if (e.target.closest('[data-siguiente]')) {
      const sig = SIGUIENTE[p.estado];
      if (sig === 'cobrado') {
        const cobro = await dialogoCobro(p);
        if (cobro) cambiarEstado(p, 'cobrado', cobro);
      } else {
        cambiarEstado(p, sig);
      }
      return;
    }
    if (e.target.closest('[data-opciones]')) {
      const h = hoja({
        titulo: p.id,
        ancho: 460,
        html: `
          <label class="campo"><span>Estado</span><select data-estado>${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${p.estado === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="campo"><span>Nota interna</span><textarea rows="3" data-notas placeholder="Ej. retira el sábado">${escapar(p.notas)}</textarea></label>
          <button class="boton boton--peligro boton--chico" type="button" data-eliminar style="justify-self:start">${icono('basura')} Eliminar pedido</button>`,
        pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Guardar</button>',
      });
      h.dialogo.querySelector('[data-ok]').addEventListener('click', async () => {
        const nuevo = h.dialogo.querySelector('[data-estado]').value;
        const notas = h.dialogo.querySelector('[data-notas]').value;
        h.cerrar();
        const pasaACobrado = ['cobrado', 'entregado'].includes(nuevo) && !['cobrado', 'entregado'].includes(p.estado);
        const cobro = pasaACobrado ? await dialogoCobro(p) : {};
        if (pasaACobrado && !cobro) return;
        cambiarEstado(p, nuevo, { notas, ...cobro });
      });
      h.dialogo.querySelector('[data-eliminar]').addEventListener('click', async () => {
        h.cerrar();
        if (await confirmar(`¿Eliminar el pedido ${p.id}?`, { aceptar: 'Eliminar', peligro: true, detalle: p.cobrado ? 'También se borra su ingreso de la caja y se devuelve el stock.' : '' })) {
          await api(`/pedidos/${encodeURIComponent(p.id)}`, { metodo: 'DELETE' }).catch(avisoError);
          cargar();
        }
      });
    }
  });

  venta.addEventListener('click', async () => {
    if (await dialogoVenta()) {
      estado.filtro = 'cobrado';
      cargar();
    }
  });

  await cargar();
  if (consulta.has('venta')) venta.click();
  return undefined;
}
