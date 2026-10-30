// Pedidos de la web y ventas manuales: estados, cobro (va a la caja y descuenta stock) y WhatsApp al cliente.
import { api } from '../api.js';
import { icono, escapar, usd, ars, pesos, precioDoble, dolarActual, fechaHora, hoja, confirmar, aviso, avisoError, conCarga, miniatura, ESTADOS, whatsappDe, hoy, demorar } from '../ui.js';
import { iconoWhatsapp } from '/js/iconos.js';
import { perfumesLivianos, olvidarPerfumes, buscarEn } from '../datos.js';

const METODOS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Dólares en efectivo', 'Otro'];
const SIGUIENTE = { nuevo: 'confirmado', confirmado: 'cobrado', cobrado: 'entregado' };
const TEXTO_SIGUIENTE = { nuevo: 'Confirmar', confirmado: 'Cobrar', cobrado: 'Marcar entregado' };
// Filtros de la lista, en este orden (abre en Todos).
const FILTROS = { todos: 'Todos', nuevo: 'Nuevos', confirmado: 'Confirmados', cobrado: 'Cobrados', entregado: 'Entregados', cancelado: 'Cancelados' };

// Número que ve el cliente (#1001); los pedidos viejos sin número muestran su código.
const numeroDe = (p) => (p.numero ? `#${p.numero}` : p.id);

// Pesos de una venta: con el dólar de esa venta cuando se cobró en pesos (así no aparecen redondeos).
function cobradoTexto(p, montoUsd = p.cobrado) {
  if (p.cobrado_ars && p.cobrado) return ars((montoUsd * p.cobrado_ars) / p.cobrado);
  return pesos(montoUsd);
}

function tarjeta(p) {
  const wa = whatsappDe(p.telefono);
  const saludo = encodeURIComponent(`Hola ${p.nombre.split(' ')[0] || ''}! Te escribo de Essenze por tu pedido ${numeroDe(p)}.`);
  return `
    <article class="tarjeta-pedido" data-id="${escapar(p.id)}">
      <div class="tarjeta-pedido__cabeza">
        <span class="tarjeta-pedido__numero">${escapar(numeroDe(p))}</span>
        <span class="estado estado--${p.estado}">${ESTADOS[p.estado]}</span>
        <span class="tarjeta-pedido__total">${precioDoble(p.total)}</span>
      </div>
      <div class="tarjeta-pedido__cliente">
        <span>${escapar(p.nombre || 'Sin nombre')} <span class="origen">· ${{ manual: 'venta manual', excel: 'planilla', web: 'web' }[p.origen] || p.origen}</span></span>
        <small>${[p.telefono, p.email].filter(Boolean).map(escapar).join(' · ')}${p.telefono || p.email ? ' · ' : ''}${fechaHora(p.creado)}</small>
      </div>
      <ul class="tarjeta-pedido__items">
        ${p.items.map((i) => `<li><span>${i.cantidad} ×</span><span>${escapar(i.marca)} ${escapar(i.nombre)}${i.ml ? ` · ${i.ml} ml` : ''}</span><span>${i.precioArs !== undefined ? ars(i.precioArs * i.cantidad) : pesos(i.precio * i.cantidad)}</span></li>`).join('')}
      </ul>
      ${p.comentario ? `<p class="tarjeta-pedido__notas">Cliente: ${escapar(p.comentario)}</p>` : ''}
      ${p.notas ? `<p class="tarjeta-pedido__notas">Nota interna: ${escapar(p.notas)}</p>` : ''}
      ${p.cobrado !== null && p.cobrado !== undefined ? `<p class="cifra__nota">Cobrado ${cobradoTexto(p)}${p.metodo_pago ? ` · ${escapar(p.metodo_pago)}` : ''}${p.costo_total ? ` · ganancia ${cobradoTexto(p, p.cobrado - p.costo_total)}` : ''}</p>` : ''}
      <div class="tarjeta-pedido__acciones">
        ${wa ? `<a class="boton boton--suave boton--chico" href="https://wa.me/${wa}?text=${saludo}" target="_blank" rel="noopener">${iconoWhatsapp()} WhatsApp</a>` : ''}
        <button class="boton boton--suave boton--chico" type="button" data-editar>${icono('editar')} Editar</button>
        ${SIGUIENTE[p.estado] ? `<button class="boton boton--lleno boton--chico" type="button" data-siguiente>${TEXTO_SIGUIENTE[p.estado]}</button>` : ''}
        <button class="boton-icono" type="button" data-opciones aria-label="Más opciones">${icono('puntos')}</button>
      </div>
    </article>`;
}

function dialogoCobro(pedido) {
  const h = hoja({
    titulo: `Cobrar ${numeroDe(pedido)}`,
    ancho: 460,
    html: `
      ${dolarActual() ? `<label class="campo"><span>Monto cobrado ($)</span><input type="number" inputmode="decimal" step="1" min="0" value="${Math.round((pedido.total * dolarActual()) / 100) * 100}" data-monto data-pesos></label>` : `<label class="campo"><span>Monto cobrado (USD)</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${pedido.total}" data-monto></label>`}
      <label class="campo"><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option ${pedido.metodo_pago === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="campo"><span>Fecha del cobro</span><input type="date" value="${hoy()}" data-fecha></label>
      <p class="campo__ayuda">Se registra el ingreso en la caja y se descuenta el stock de los perfumes que lo controlan.</p>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Registrar cobro</button>',
  });
  h.dialogo.querySelector('[data-ok]').addEventListener('click', () => h.cerrar({
    [h.dialogo.querySelector('[data-pesos]') ? 'cobradoArs' : 'cobrado']: h.dialogo.querySelector('[data-monto]').value,
    metodo_pago: h.dialogo.querySelector('[data-metodo]').value,
    fecha: h.dialogo.querySelector('[data-fecha]').value,
  }));
  return h.cerrada;
}

// Registrar una venta nueva o editar una existente (todo: perfumes, precios, costos, cliente, fecha, estado y cobro).
// El costo se carga en dólares (o en pesos, si se elige) y queda en dólares como "último costo" del perfume.
// boton: el que abrió la ventana; muestra que está cargando hasta que la ventana aparece.
async function dialogoVenta(pedido = null, boton = null) {
  const editando = !!pedido;
  if (boton) {
    boton.disabled = true;
    boton.classList.add('es-cargando');
  }
  let lista;
  let ajustes;
  let detalle;
  try {
    // La lista de perfumes es liviana y queda guardada: desde la segunda venta la ventana abre al instante.
    [lista, ajustes, detalle] = await Promise.all([
      perfumesLivianos(),
      api('/ajustes'),
      editando ? api(`/pedidos/${encodeURIComponent(pedido.id)}`) : null,
    ]);
  } catch (err) {
    avisoError(err);
    return false;
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.classList.remove('es-cargando');
    }
  }
  const movimientos = detalle?.movimientos || [];
  const venta = movimientos.find((m) => m.categoria === 'Venta');
  // Al editar se usa el dólar de esa venta, así los pesos no cambian con el dólar de hoy.
  const cot = venta?.cotizacion || dolarActual();
  const enPesos = cot > 0;
  const enMoneda = (usdN) => (enPesos ? Math.round((usdN * cot) / 100) * 100 : usdN);
  const textoMoneda = (n) => (enPesos ? ars(n) : usd(n));
  const aPesosMov = (m) => (m.moneda === 'ARS' && m.monto_original !== null ? m.monto_original : m.monto * (m.cotizacion || cot || 1));
  const presDe = (l) => lista.find((x) => x.id === l.id)?.presentaciones.find((x) => x.ml === l.ml);

  const lineas = editando
    ? pedido.items.map((i, origen) => ({
      id: i.id,
      ml: i.ml,
      cantidad: i.cantidad,
      precio: enPesos ? i.precioArs ?? enMoneda(i.precio) : i.precio,
      costo: i.costo ?? null,
      origen,
      marca: i.marca,
      nombre: i.nombre,
    }))
    : [];
  const totalLineas = () => lineas.reduce((n, l) => n + (Number(l.precio) || 0) * (Number(l.cantidad) || 0), 0);
  const unidades = () => lineas.reduce((n, l) => n + (Number(l.cantidad) || 0), 0);
  const comisionPorDefecto = () => {
    const usdN = (ajustes.comision || 0) * unidades();
    return enPesos ? Math.round(usdN * cot) : usdN;
  };

  // Valores iniciales del cobro al editar (en la moneda del panel).
  const cobradoInicial = venta ? Math.round(enPesos ? aPesosMov(venta) : venta.monto) : null;
  const comisionInicial = movimientos.filter((m) => m.categoria === 'Comisiones').reduce((n, m) => n + (enPesos ? aPesosMov(m) : m.monto), 0);
  // Si el cobro y la comisión coincidían con lo calculado (salvo redondeos), se recalculan solos al cambiar los perfumes.
  const parecidos = (x, y) => Math.abs(x - y) <= Math.max(1, Math.abs(y) * 0.002);
  const cobradoAuto = editando && (!venta || parecidos(cobradoInicial, totalLineas()));
  const comisionAuto = editando && parecidos(comisionInicial, comisionPorDefecto());
  const fechaInicial = editando ? String(pedido.cobrado_en || pedido.creado).slice(0, 10) : hoy();
  const cobrado = (e) => ['cobrado', 'entregado'].includes(e);

  const h = hoja({
    titulo: editando ? `Editar ${numeroDe(pedido)}` : 'Registrar venta',
    ancho: 680,
    html: `
      <p class="campo__ayuda">${editando
        ? 'Podés cambiar todo. Si la venta ya estaba cobrada, la caja y el stock se ajustan solos con los datos nuevos (con el dólar de esa venta).'
        : 'Para ventas en persona, por Instagram o cualquier otro canal. Queda cobrada y suma a la caja.'}
        El costo va a la caja como gasto ("Costo de mercadería") y queda guardado como último costo del perfume para la próxima venta.</p>
      ${enPesos ? `<div class="moneda-costo"><span class="campo__rotulo">Costo en</span>
        <div class="segmentado" role="radiogroup" aria-label="Moneda del costo">
          <label><input type="radio" name="moneda-costo" value="USD" checked data-moneda-costo><span>USD</span></label>
          <label><input type="radio" name="moneda-costo" value="ARS" data-moneda-costo><span>Pesos</span></label>
        </div></div>` : ''}
      <div class="campo selector-perfume">
        <span>Agregar perfume</span>
        <input class="entrada" data-buscar placeholder="Buscar marca o nombre…" autocomplete="off" enterkeyhint="search">
        <div class="resultados-busqueda" data-resultados hidden></div>
      </div>
      <div class="lineas-venta" data-lineas></div>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Nombre del cliente</span><input data-nombre autocomplete="off" autocapitalize="words" required value="${escapar(pedido?.nombre || '')}"><small class="campo__error" data-error-nombre></small></label>
        <label class="campo"><span>Teléfono${editando ? '' : ' (opcional)'}</span><input data-telefono type="tel" inputmode="tel" autocomplete="off" value="${escapar(pedido?.telefono || '')}"></label>
        <label class="campo"><span>Email${editando ? '' : ' (opcional)'}</span><input data-email type="email" inputmode="email" autocomplete="off" value="${escapar(pedido?.email || '')}"></label>
        <label class="campo"><span>Fecha</span><input type="date" value="${fechaInicial}" data-fecha></label>
        ${editando ? `<label class="campo"><span>Estado</span><select data-estado>${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${pedido.estado === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
        <label class="campo" data-cobro><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option ${pedido?.metodo_pago === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="campo" data-cobro><span>Total cobrado (${enPesos ? '$' : 'USD'})</span><input type="number" inputmode="decimal" step="0.01" min="0" data-total placeholder="Se calcula solo" value="${cobradoInicial ?? ''}"></label>
        ${editando ? `<label class="campo" data-cobro><span>Comisión del pasante (${enPesos ? '$' : 'USD'})</span><input type="number" inputmode="decimal" step="0.01" min="0" data-comision value="${venta ? Math.round(comisionInicial * 100) / 100 : ''}" placeholder="${textoMoneda(comisionPorDefecto())} (automática)"></label>` : ''}
        ${editando && (pedido.origen === 'web' || pedido.comentario) ? `<label class="campo ancho-total"><span>Comentario del cliente</span><textarea rows="2" data-comentario>${escapar(pedido.comentario || '')}</textarea></label>` : ''}
        ${editando ? `<label class="campo ancho-total"><span>Nota interna</span><textarea rows="2" data-notas>${escapar(pedido.notas || '')}</textarea></label>` : ''}
      </div>`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>${editando ? 'Guardar cambios' : 'Registrar venta'}</button>`,
  });
  const d = h.dialogo;
  const buscar = d.querySelector('[data-buscar]');
  const resultados = d.querySelector('[data-resultados]');
  const contLineas = d.querySelector('[data-lineas]');
  const campoTotal = d.querySelector('[data-total]');
  const campoComision = d.querySelector('[data-comision]');
  const campoEstado = d.querySelector('[data-estado]');
  let totalTocado = false;
  let comisionTocada = false;

  // Moneda en que se escribe el costo (por defecto dólares). Adentro siempre se guarda en dólares.
  let costoEnPesos = false;
  const costoVisible = (l) => {
    if (l.costo === null || l.costo === undefined) return '';
    return costoEnPesos ? l.costoArs ?? Math.round(l.costo * cot) : l.costo;
  };
  const equivalente = (l) => {
    if (!enPesos || l.costo === null || l.costo === undefined) return '';
    return costoEnPesos ? `≈ ${usd(l.costo)}` : `≈ ${ars(l.costo * cot)}`;
  };
  function refrescarTotales() {
    campoTotal.placeholder = lineas.length ? `${textoMoneda(totalLineas())} (calculado)` : 'Se calcula solo';
    if (cobradoAuto && !totalTocado) campoTotal.value = lineas.length ? Math.round(totalLineas() * 100) / 100 : '';
    if (campoComision) {
      campoComision.placeholder = `${textoMoneda(comisionPorDefecto())} (automática)`;
      if (comisionAuto && !comisionTocada && campoComision.value !== '') campoComision.value = Math.round(comisionPorDefecto() * 100) / 100;
    }
  }
  function mostrarCobro() {
    const visible = !campoEstado || cobrado(campoEstado.value);
    d.querySelectorAll('[data-cobro]').forEach((el) => { el.hidden = !visible; });
  }

  function pintarLineas() {
    contLineas.innerHTML = lineas.map((l, i) => {
      const p = lista.find((x) => x.id === l.id);
      const opciones = p ? [...p.presentaciones.map((x) => x.ml)] : [];
      if (!opciones.includes(l.ml)) opciones.push(l.ml);
      const ultimo = presDe(l)?.costo;
      return `
        <div class="linea-venta" data-i="${i}">
          <span class="fila-admin__texto"><span class="fila-admin__titulo">${escapar(p?.marca ?? l.marca ?? '')}${(p?.marca ?? l.marca) ? ' · ' : ''}${escapar(p?.nombre ?? l.nombre ?? '')}</span>${p ? '' : '<small class="cifra__nota">Ya no está en el catálogo: se mantiene como estaba.</small>'}</span>
          <button class="boton-icono" type="button" data-quitar aria-label="Quitar">${icono('cerrar')}</button>
          <div class="linea-venta__datos">
            <label class="campo"><span>Tamaño</span><select data-campo="ml" ${p ? '' : 'disabled'}>${opciones.map((ml) => `<option value="${ml}" ${ml === l.ml ? 'selected' : ''}>${ml ? `${ml} ml` : 'Único'}</option>`).join('')}</select></label>
            <label class="campo"><span>Cantidad</span><input type="number" inputmode="numeric" min="1" value="${l.cantidad}" data-campo="cantidad"></label>
            <label class="campo"><span>Precio c/u (${enPesos ? '$' : 'USD'})</span><input type="number" inputmode="decimal" min="0" step="0.01" value="${l.precio}" data-campo="precio"></label>
            <label class="campo"><span>Costo c/u (${costoEnPesos ? '$' : 'USD'})</span><input type="number" inputmode="decimal" min="0" step="${costoEnPesos ? 1 : 0.01}" value="${costoVisible(l)}" placeholder="Opcional" data-campo="costo">
              <small class="campo__ayuda" data-equivalente>${equivalente(l)}${l.recordado ? ' · último costo cargado' : ultimo && l.costo === null ? `Último: ${usd(ultimo)}` : ''}</small></label>
          </div>
        </div>`;
    }).join('');
    refrescarTotales();
  }

  buscar.addEventListener('input', demorar(() => {
    const r = buscarEn(lista, buscar.value);
    resultados.hidden = !r.length;
    resultados.innerHTML = r.map((p) => `<button type="button" data-id="${escapar(p.id)}">${miniatura(p)}<span>${escapar(p.marca)} · ${escapar(p.nombre)}</span></button>`).join('');
  }, 120));
  resultados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = lista.find((x) => x.id === b.dataset.id);
    const pres = p.presentaciones[0];
    // El costo arranca con el último que se cargó para ese perfume y tamaño.
    lineas.push({ id: p.id, ml: pres.ml, cantidad: 1, precio: enMoneda(pres.precio), costo: pres.costo ?? null, recordado: pres.costo !== null && pres.costo !== undefined });
    buscar.value = '';
    resultados.hidden = true;
    pintarLineas();
    buscar.focus();
  });
  contLineas.addEventListener('input', (e) => {
    const fila = e.target.closest('[data-i]');
    const campo = e.target.dataset.campo;
    if (!fila || !campo) return;
    const l = lineas[Number(fila.dataset.i)];
    if (campo === 'costo') {
      const v = e.target.value === '' ? null : Number(e.target.value);
      if (costoEnPesos) {
        l.costoArs = v;
        l.costo = v === null ? null : Math.round((v / cot) * 100) / 100;
      } else {
        delete l.costoArs;
        l.costo = v;
      }
    } else {
      l[campo] = Number(e.target.value);
    }
    if (campo === 'ml') {
      const pres = presDe(l);
      if (pres) {
        l.precio = enMoneda(pres.precio);
        if (pres.costo !== null && pres.costo !== undefined) {
          l.costo = pres.costo;
          delete l.costoArs;
        }
      }
      pintarLineas();
      return;
    }
    if (campo === 'costo') {
      l.recordado = false;
      fila.querySelector('[data-equivalente]').textContent = equivalente(l);
    }
    refrescarTotales();
  });
  contLineas.addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    lineas.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
    pintarLineas();
  });
  campoTotal.addEventListener('input', () => { totalTocado = true; });
  d.querySelectorAll('[data-moneda-costo]').forEach((r) => r.addEventListener('change', () => {
    costoEnPesos = r.value === 'ARS' && r.checked;
    pintarLineas();
  }));
  campoComision?.addEventListener('input', () => { comisionTocada = true; });
  campoEstado?.addEventListener('change', mostrarCobro);

  d.querySelector('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!lineas.length) return aviso('Agregá al menos un perfume.', 'error');
    const valor = (sel) => d.querySelector(sel)?.value;
    // El nombre es obligatorio: así cada venta queda a nombre de alguien.
    const campoNombre = d.querySelector('[data-nombre]');
    if (campoNombre.value.trim().length < 2) {
      d.querySelector('[data-error-nombre]').textContent = 'Escribí el nombre del cliente.';
      campoNombre.focus();
      return undefined;
    }
    const datos = {
      items: lineas.map((l) => ({
        id: l.id,
        ml: l.ml,
        cantidad: l.cantidad,
        [enPesos ? 'precioArs' : 'precio']: l.precio,
        // En pesos se manda lo escrito tal cual; si no se tocó, va el costo en dólares que ya tenía.
        ...(costoEnPesos && l.costoArs !== undefined && l.costoArs !== null ? { costoArs: l.costoArs } : { costo: l.costo }),
        ...(l.origen !== undefined ? { origen: l.origen } : {}),
      })),
      nombre: valor('[data-nombre]'),
      telefono: valor('[data-telefono]'),
      email: valor('[data-email]'),
      metodo_pago: valor('[data-metodo]'),
      fecha: valor('[data-fecha]'),
      [enPesos ? 'cobradoArs' : 'cobrado']: campoTotal.value,
    };
    if (editando) {
      Object.assign(datos, {
        estado: campoEstado.value,
        [enPesos ? 'comisionArs' : 'comision']: campoComision.value,
        notas: valor('[data-notas]'),
        ...(d.querySelector('[data-comentario]') ? { comentario: valor('[data-comentario]') } : {}),
      });
    }
    try {
      if (editando) await api(`/pedidos/${encodeURIComponent(pedido.id)}`, { metodo: 'PUT', datos });
      else await api('/pedidos', { metodo: 'POST', datos });
      olvidarPerfumes(); // cambió el último costo de esos perfumes
      aviso(editando ? 'Venta actualizada' : 'Venta registrada');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));
  d.querySelector('[data-nombre]').addEventListener('input', () => { d.querySelector('[data-error-nombre]').textContent = ''; });
  pintarLineas();
  mostrarCobro();
  if (!editando) setTimeout(() => buscar.focus(), 80);
  return h.cerrada.then((v) => v === true);
}

export async function montar({ vista, consulta, app }) {
  app.titulo('Pedidos');
  const venta = document.createElement('button');
  venta.className = 'boton boton--lleno boton--chico';
  venta.type = 'button';
  venta.innerHTML = `${icono('mas')}<span>Venta</span>`;
  app.acciones(venta);

  const guardado = sessionStorage.getItem('admin-pedidos-filtro');
  const estado = { filtro: FILTROS[guardado] ? guardado : 'todos', q: consulta.get('q') || '' };
  if (estado.q) estado.filtro = 'todos';
  let datos = { pedidos: [], cuentas: {} };

  vista.innerHTML = `
    <div class="herramientas-admin">
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar número, cliente o perfume" value="${escapar(estado.q)}" data-q enterkeyhint="search" aria-label="Buscar pedidos"></label>
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
    vista.querySelector('[data-filtros]').innerHTML = Object.entries(FILTROS).map(([k, v]) => {
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
    if (e.target.closest('[data-editar]')) {
      try {
        if (await dialogoVenta(p, e.target.closest('[data-editar]'))) await cargar();
      } catch (err) {
        avisoError(err);
      }
      return;
    }
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
        titulo: numeroDe(p),
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
        if (await confirmar(`¿Eliminar el pedido ${numeroDe(p)}?`, { aceptar: 'Eliminar', peligro: true, detalle: p.cobrado ? 'También se borra su ingreso de la caja y se devuelve el stock.' : '' })) {
          await api(`/pedidos/${encodeURIComponent(p.id)}`, { metodo: 'DELETE' }).catch(avisoError);
          cargar();
        }
      });
    }
  });

  venta.addEventListener('click', async () => {
    if (await dialogoVenta(null, venta)) {
      estado.filtro = 'cobrado';
      cargar();
    }
  });

  await cargar();
  // La lista de perfumes se baja de antemano: al tocar "Venta" ya está lista.
  perfumesLivianos().catch(() => {});
  if (consulta.has('venta')) venta.click();
  return undefined;
}
