// Deudas: lo que les deben (ventas pagadas en parte o fiadas, o cargadas a mano) y lo que deben ellos.
// Cada pago se registra acá y entra (o sale) de la caja.
import { api } from '../api.js';
import { icono, escapar, usd, ars, fecha, hoja, confirmar, aviso, avisoError, conCarga, hoy, demorar, whatsappDe, dolarActual } from '../ui.js';
import { iconoWhatsapp } from '/js/iconos.js';

const METODOS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Dólares en efectivo', 'Otro'];
const FILTROS = { pendientes: 'Pendientes', saldadas: 'Saldadas', todas: 'Todas' };

const monto = (n, moneda) => (moneda === 'USD' ? usd(n) : ars(n));

function tarjeta(d) {
  const wa = whatsappDe(d.telefono);
  const recordatorio = encodeURIComponent(`Hola ${d.nombre.split(' ')[0]}! Te escribo de Essenze: te recuerdo que quedó pendiente ${monto(d.resta, d.moneda)}${d.concepto ? ` (${d.concepto})` : ''}. ¡Gracias!`);
  const avance = d.monto > 0 ? Math.min(100, Math.round((d.pagado / d.monto) * 100)) : 0;
  return `
    <article class="tarjeta-pedido tarjeta-deuda ${d.saldada ? 'es-saldada' : ''}" data-id="${escapar(d.id)}">
      <div class="tarjeta-pedido__cabeza">
        <span class="tarjeta-pedido__numero">${escapar(d.nombre)}</span>
        <span class="estado ${d.saldada ? 'estado--entregado' : d.tipo === 'pagar' ? 'estado--cancelado' : 'estado--nuevo'}">${d.saldada ? 'Saldada' : d.tipo === 'pagar' ? 'Debemos' : 'Nos debe'}</span>
        <span class="tarjeta-pedido__total">${d.saldada ? monto(d.monto, d.moneda) : `Falta ${monto(d.resta, d.moneda)}`}</span>
      </div>
      <div class="tarjeta-pedido__cliente">
        <span>${escapar(d.concepto || 'Sin detalle')}</span>
        <small>${fecha(d.fecha)}${d.telefono ? ` · ${escapar(d.telefono)}` : ''} · total ${monto(d.monto, d.moneda)}${d.pagado > 0 ? ` · ${d.tipo === 'pagar' ? 'pagado' : 'cobrado'} ${monto(d.pagado, d.moneda)}` : ''}</small>
      </div>
      <div class="barra-deuda" role="img" aria-label="${avance}% pagado"><span style="width:${avance}%"></span></div>
      ${d.notas ? `<p class="tarjeta-pedido__notas">${escapar(d.notas)}</p>` : ''}
      <div class="tarjeta-pedido__acciones">
        ${wa && !d.saldada && d.tipo !== 'pagar' ? `<a class="boton boton--suave boton--chico" href="https://wa.me/${wa}?text=${recordatorio}" target="_blank" rel="noopener">${iconoWhatsapp()} Recordar</a>` : ''}
        ${d.pedido ? `<a class="boton boton--suave boton--chico" href="#/pedidos?q=${encodeURIComponent(d.pedido_numero || d.pedido)}">${icono('recibo')} Ver venta</a>` : ''}
        <button class="boton-icono" type="button" data-editar aria-label="Ver y editar">${icono('editar')}</button>
        ${d.saldada ? '' : `<button class="boton boton--lleno boton--chico" type="button" data-pagar>${d.tipo === 'pagar' ? 'Registrar pago' : 'Registrar cobro'}</button>`}
      </div>
    </article>`;
}

function dialogoPago(d) {
  const cobrar = d.tipo !== 'pagar';
  const h = hoja({
    titulo: `${cobrar ? 'Cobro' : 'Pago'} · ${d.nombre}`,
    ancho: 440,
    html: `
      <p class="campo__ayuda">Falta ${monto(d.resta, d.moneda)}. ${cobrar ? 'Entra a la caja como "Cobro de deuda".' : 'Sale de la caja como "Pago de deuda".'}</p>
      <label class="campo"><span>Monto (${d.moneda === 'USD' ? 'USD' : '$'})</span><input type="number" inputmode="decimal" step="0.01" min="0" max="${d.resta}" value="${d.resta}" data-monto></label>
      <label class="campo"><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option>${m}</option>`).join('')}</select></label>
      <label class="campo"><span>Fecha</span><input type="date" value="${hoy()}" data-fecha></label>`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Registrar</button>`,
  });
  h.dialogo.querySelector('[data-ok]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    try {
      await api(`/deudas/${encodeURIComponent(d.id)}`, {
        metodo: 'POST',
        datos: { monto: h.dialogo.querySelector('[data-monto]').value, metodo: h.dialogo.querySelector('[data-metodo]').value, fecha: h.dialogo.querySelector('[data-fecha]').value },
      });
      aviso(cobrar ? 'Cobro registrado en la caja' : 'Pago registrado en la caja');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  setTimeout(() => h.dialogo.querySelector('[data-monto]').select(), 80);
  return h.cerrada.then((v) => v === true);
}

// Nueva deuda a mano, o ver/editar una existente con sus pagos.
async function dialogoDeuda(id = null) {
  let d = { tipo: 'cobrar', nombre: '', telefono: '', concepto: '', moneda: dolarActual() ? 'ARS' : 'USD', monto: '', fecha: hoy(), notas: '' };
  let pagos = [];
  if (id) ({ deuda: d, pagos } = await api(`/deudas/${encodeURIComponent(id)}`));
  const deVenta = !!d.pedido;
  const h = hoja({
    titulo: id ? d.nombre : 'Nueva deuda',
    ancho: 520,
    html: `
      ${deVenta ? `<p class="campo__ayuda">Viene de una venta: el monto se cambia editando la venta en Pedidos.</p>` : `
      <div class="segmentado" role="radiogroup" aria-label="Tipo de deuda">
        <label><input type="radio" name="tipo" value="cobrar" ${d.tipo !== 'pagar' ? 'checked' : ''}><span>Nos deben</span></label>
        <label><input type="radio" name="tipo" value="pagar" ${d.tipo === 'pagar' ? 'checked' : ''}><span>Debemos</span></label>
      </div>`}
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Nombre</span><input data-c="nombre" maxlength="120" autocapitalize="words" value="${escapar(d.nombre)}" placeholder="Cliente o proveedor"></label>
        <label class="campo"><span>Teléfono (opcional)</span><input data-c="telefono" type="tel" inputmode="tel" maxlength="40" value="${escapar(d.telefono)}"></label>
        ${deVenta ? '' : `
        <label class="campo ancho-total"><span>Detalle</span><input data-c="concepto" maxlength="300" value="${escapar(d.concepto)}" placeholder="Ej. Lattafa Khamrah 100 ml, seña…"></label>
        <label class="campo"><span>Monto</span><input data-c="monto" type="number" inputmode="decimal" step="0.01" min="0" value="${d.monto}"></label>
        <div class="campo"><span class="campo__rotulo">Moneda</span>
          <div class="segmentado"><label><input type="radio" name="moneda" value="ARS" ${d.moneda !== 'USD' ? 'checked' : ''}><span>Pesos</span></label><label><input type="radio" name="moneda" value="USD" ${d.moneda === 'USD' ? 'checked' : ''}><span>USD</span></label></div>
        </div>
        <label class="campo"><span>Fecha</span><input data-c="fecha" type="date" value="${d.fecha}"></label>`}
        <label class="campo ancho-total"><span>Notas</span><textarea data-c="notas" rows="2" placeholder="Ej. paga a fin de mes">${escapar(d.notas)}</textarea></label>
      </div>
      ${pagos.length ? `
        <h3 class="tarjeta-admin__titulo" style="margin-top:6px">Pagos</h3>
        <ul class="lista-admin">${pagos.map((p) => `
          <li class="fila-admin" data-pago="${escapar(p.id)}">
            <span class="fila-admin__texto"><span class="fila-admin__titulo">${monto(p.moneda === 'ARS' ? p.monto_original : p.monto, p.moneda)}</span><span class="fila-admin__sub">${fecha(p.fecha)}</span></span>
            <button class="boton-icono" type="button" data-borrar-pago aria-label="Borrar este pago">${icono('basura')}</button>
          </li>`).join('')}</ul>` : ''}
      ${id ? `<button class="boton boton--peligro boton--chico" type="button" data-borrar style="justify-self:start">${icono('basura')} Borrar deuda</button>` : ''}`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>${id ? 'Guardar' : 'Cargar deuda'}</button>`,
  });
  const dlg = h.dialogo;
  dlg.querySelector('[data-ok]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const datos = { ...d };
    dlg.querySelectorAll('[data-c]').forEach((el) => { datos[el.dataset.c] = el.value; });
    if (!deVenta) {
      datos.tipo = dlg.querySelector('[name=tipo]:checked').value;
      datos.moneda = dlg.querySelector('[name=moneda]:checked').value;
    }
    try {
      if (id) await api(`/deudas/${encodeURIComponent(id)}`, { metodo: 'PUT', datos });
      else await api('/deudas', { metodo: 'POST', datos });
      aviso(id ? 'Deuda guardada' : 'Deuda cargada');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  dlg.addEventListener('click', async (e) => {
    const pago = e.target.closest('[data-borrar-pago]');
    if (pago) {
      const fila = pago.closest('[data-pago]');
      if (!(await confirmar('¿Borrar este pago?', { aceptar: 'Borrar', peligro: true, detalle: 'También se borra de la caja.' }))) return;
      try {
        await api(`/deudas/${encodeURIComponent(id)}`, { metodo: 'POST', datos: { borrarPago: fila.dataset.pago } });
        fila.remove();
        aviso('Pago borrado');
        h.cerrar(true);
      } catch (err) {
        avisoError(err);
      }
      return;
    }
    if (e.target.closest('[data-borrar]')) {
      const detalle = d.pagado > 0 ? 'También se borran sus pagos de la caja.' : '';
      if (!(await confirmar(`¿Borrar la deuda de ${d.nombre}?`, { aceptar: 'Borrar', peligro: true, detalle }))) return;
      try {
        await api(`/deudas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
        aviso('Deuda borrada');
        h.cerrar(true);
      } catch (err) {
        avisoError(err);
      }
    }
  });
  if (!id) setTimeout(() => dlg.querySelector('[data-c="nombre"]').focus(), 80);
  return h.cerrada.then((v) => v === true);
}

export async function montar({ vista, app }) {
  app.titulo('Deudas');
  const nueva = document.createElement('button');
  nueva.className = 'boton boton--lleno boton--chico';
  nueva.type = 'button';
  nueva.innerHTML = `${icono('mas')}<span>Deuda</span>`;
  app.acciones(nueva);

  const estado = { filtro: 'pendientes', q: '' };
  let datos = { deudas: [], totales: { cobrar: {}, pagar: {} }, cuentas: {} };

  vista.innerHTML = `
    <div class="cifras" data-cifras></div>
    <div class="herramientas-admin" style="margin-top:14px">
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar nombre o detalle" data-q enterkeyhint="search" aria-label="Buscar deudas"></label>
      <div class="chips-admin" data-filtros role="group" aria-label="Qué mostrar"></div>
    </div>
    <div data-lista></div>`;

  const total = (t) => [t.ARS ? ars(t.ARS) : '', t.USD ? usd(t.USD) : ''].filter(Boolean).join(' + ') || ars(0);

  function pintar() {
    vista.querySelector('[data-cifras]').innerHTML = `
      <div class="cifra"><span class="cifra__rotulo">Nos deben</span><span class="cifra__valor">${total(datos.totales.cobrar)}</span><span class="cifra__nota">Lo que falta cobrar</span></div>
      <div class="cifra"><span class="cifra__rotulo">Debemos</span><span class="cifra__valor">${total(datos.totales.pagar)}</span><span class="cifra__nota">Lo que falta pagar</span></div>`;
    vista.querySelector('[data-filtros]').innerHTML = Object.entries(FILTROS)
      .map(([k, v]) => `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${estado.filtro === k}">${v}<span>${datos.cuentas[k] || 0}</span></button>`).join('');
    vista.querySelector('[data-lista]').innerHTML = datos.deudas.length
      ? datos.deudas.map(tarjeta).join('')
      : `<div class="vacio-admin">${icono('dolar')}<p>${estado.filtro === 'pendientes' ? 'No hay deudas pendientes.' : 'No hay nada acá.'}</p><p class="vacio-admin__detalle">Cuando registren una venta pagada en parte o fiada, lo que falta aparece acá solo. También podés cargar una con el botón "Deuda".</p></div>`;
  }

  async function cargar() {
    const params = new URLSearchParams({ estado: estado.filtro });
    if (estado.q) params.set('q', estado.q);
    datos = await api(`/deudas?${params}`);
    pintar();
  }

  vista.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-filtro]');
    if (f) {
      estado.filtro = f.dataset.filtro;
      cargar();
      return;
    }
    const art = e.target.closest('[data-id]');
    if (!art) return;
    const d = datos.deudas.find((x) => x.id === art.dataset.id);
    try {
      if (e.target.closest('[data-pagar]') && (await dialogoPago(d))) await cargar();
      if (e.target.closest('[data-editar]') && (await dialogoDeuda(d.id))) await cargar();
    } catch (err) {
      avisoError(err);
    }
  });
  vista.querySelector('[data-q]').addEventListener('input', demorar((e) => {
    estado.q = e.target.value.trim();
    cargar();
  }, 250));
  nueva.addEventListener('click', async () => {
    if (await dialogoDeuda()) {
      estado.filtro = 'pendientes';
      cargar();
    }
  });

  await cargar();
  return undefined;
}
