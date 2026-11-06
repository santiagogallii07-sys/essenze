// Stock: lo que tienen para entrega inmediata (del catálogo y fuera del catálogo), compras de mercadería
// (suman stock, dejan el último costo y van a la caja o a Deudas) y ajustes a mano.
import { api } from '../api.js';
import { icono, escapar, usd, ars, pesos, fecha, hoja, confirmar, aviso, avisoError, conCarga, hoy, demorar, miniatura, dolarActual } from '../ui.js';
import { perfumesLivianos, olvidarPerfumes, buscarEn, normalizar } from '../datos.js';

const METODOS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Dólares en efectivo', 'Otro'];
const FILTROS = { todo: 'Todo', catalogo: 'Del catálogo', fuera: 'Fuera del catálogo' };
const PAGOS = { pagado: 'Pagada', deuda: 'Se debe', sin_caja: 'Sin caja' };
const POR_TANDA = 60;

const textoMl = (ml) => (ml ? `${ml} ml` : 'Único');

// Compra de mercadería: perfumes del catálogo o escritos a mano, cantidad y costo de cada uno.
function dialogoCompra(lista, libres) {
  const enPesos = dolarActual() > 0;
  let moneda = enPesos ? 'ARS' : 'USD';
  const lineas = [];
  const h = hoja({
    titulo: 'Cargar compra',
    ancho: 680,
    html: `
      <p class="campo__ayuda">Suma el stock, deja el costo como último costo de cada perfume y registra el gasto. Las ventas de ese stock ya no vuelven a sumar el costo como gasto en la caja.</p>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Proveedor (opcional)</span><input data-proveedor maxlength="120" autocapitalize="words" placeholder="Ej. Distribuidora X"></label>
        <label class="campo"><span>Fecha</span><input type="date" value="${hoy()}" data-fecha></label>
      </div>
      ${enPesos ? `<div class="moneda-costo"><span class="campo__rotulo">Costos en</span>
        <div class="segmentado" role="radiogroup" aria-label="Moneda de los costos">
          <label><input type="radio" name="moneda-compra" value="ARS" checked><span>Pesos</span></label>
          <label><input type="radio" name="moneda-compra" value="USD"><span>USD</span></label>
        </div></div>` : ''}
      <div class="campo selector-perfume">
        <span>Agregar perfume</span>
        <input class="entrada" data-buscar placeholder="Buscar marca o nombre…" autocomplete="off" enterkeyhint="search">
        <div class="resultados-busqueda" data-resultados hidden></div>
        <button class="boton boton--suave boton--chico selector-perfume__libre" type="button" data-libre>${icono('mas')} Perfume que no está en el catálogo</button>
      </div>
      <div class="lineas-venta" data-lineas></div>
      <p class="compra-total" data-total></p>
      <div class="campo"><span class="campo__rotulo">El gasto</span>
        <div class="segmentado" role="radiogroup" aria-label="Cómo se pagó">
          <label><input type="radio" name="pago" value="pagado" checked><span>Pagado (sale de la caja)</span></label>
          <label><input type="radio" name="pago" value="deuda"><span>Lo debemos</span></label>
          <label><input type="radio" name="pago" value="sin_caja"><span>No registrar</span></label>
        </div>
        <p class="campo__ayuda" data-ayuda-pago></p>
      </div>
      <label class="campo" data-campo-metodo><span>Forma de pago</span><select data-metodo>${METODOS.map((m) => `<option>${m}</option>`).join('')}</select></label>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>Cargar compra</button>',
  });
  const d = h.dialogo;
  const buscar = d.querySelector('[data-buscar]');
  const resultados = d.querySelector('[data-resultados]');
  const cont = d.querySelector('[data-lineas]');
  const signo = () => (moneda === 'ARS' ? '$' : 'USD');
  const enMoneda = (costoUsd) => (costoUsd === null || costoUsd === undefined ? '' : moneda === 'ARS' ? Math.round(costoUsd * dolarActual()) : costoUsd);
  const total = () => lineas.reduce((n, l) => n + (Number(l.costo) || 0) * (Number(l.cantidad) || 0), 0);

  function pintarTotal() {
    const t = total();
    d.querySelector('[data-total]').textContent = lineas.length ? `Total: ${moneda === 'ARS' ? ars(t) : usd(t)}` : '';
    const pago = d.querySelector('[name=pago]:checked').value;
    d.querySelector('[data-campo-metodo]').hidden = pago !== 'pagado';
    d.querySelector('[data-ayuda-pago]').textContent = {
      pagado: 'Se registra en la caja como "Compra de mercadería".',
      deuda: 'Va a Deudas como "Debemos" a nombre del proveedor; cuando lo paguen, lo registran ahí.',
      sin_caja: 'Solo suma el stock (por ejemplo, mercadería que ya tenían o que ya anotaron en la caja).',
    }[pago];
  }

  function pintar() {
    cont.innerHTML = lineas.map((l, i) => {
      const p = l.libre ? null : lista.find((x) => x.id === l.id);
      const cabeza = l.libre
        ? `<div class="linea-venta__libre">
            <label class="campo"><span>Marca</span><input data-campo="marca" maxlength="80" autocapitalize="words" value="${escapar(l.marca)}" placeholder="Ej. Lattafa"></label>
            <label class="campo"><span>Nombre</span><input data-campo="nombre" maxlength="120" autocapitalize="words" value="${escapar(l.nombre)}" placeholder="Ej. Khamrah Qahwa"></label>
          </div>`
        : '';
      return `
        <div class="linea-venta" data-i="${i}">
          <span class="fila-admin__texto"><span class="fila-admin__titulo">${l.libre ? 'Fuera del catálogo' : `${escapar(p.marca)} · ${escapar(p.nombre)}`}</span>${l.libre ? '<small class="cifra__nota">Queda en la lista de stock, sin publicarse en la tienda.</small>' : ''}</span>
          <button class="boton-icono" type="button" data-quitar aria-label="Quitar">${icono('cerrar')}</button>
          ${cabeza}
          <div class="linea-venta__datos">
            ${l.libre
              ? `<label class="campo"><span>Tamaño (ml)</span><input type="number" inputmode="numeric" min="0" value="${l.ml || ''}" placeholder="100" data-campo="ml"></label>`
              : `<label class="campo"><span>Tamaño</span><select data-campo="ml">${p.presentaciones.map((x) => `<option value="${x.ml}" ${x.ml === l.ml ? 'selected' : ''}>${textoMl(x.ml)}</option>`).join('')}</select></label>`}
            <label class="campo"><span>Cantidad</span><input type="number" inputmode="numeric" min="1" value="${l.cantidad}" data-campo="cantidad"></label>
            <label class="campo"><span>Costo c/u (${signo()})</span><input type="number" inputmode="decimal" min="0" step="${moneda === 'ARS' ? 1 : 0.01}" value="${l.costo}" placeholder="Opcional" data-campo="costo"></label>
          </div>
        </div>`;
    }).join('');
    pintarTotal();
  }

  const agregar = (l) => {
    lineas.push(l);
    buscar.value = '';
    resultados.hidden = true;
    pintar();
    cont.querySelector(`[data-i="${lineas.length - 1}"] [data-campo="${l.libre && !l.nombre ? 'marca' : 'cantidad'}"]`)?.focus();
  };
  buscar.addEventListener('input', demorar(() => {
    const texto = buscar.value.trim();
    const r = buscarEn(lista, texto);
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    const fuera = palabras.length ? libres.filter((l) => palabras.every((w) => normalizar(`${l.marca} ${l.nombre}`).includes(w))).slice(0, 5) : [];
    resultados.hidden = !r.length && !fuera.length && texto.length < 2;
    resultados.innerHTML = r.map((p) => `<button type="button" data-id="${escapar(p.id)}">${miniatura(p)}<span>${escapar(p.marca)} · ${escapar(p.nombre)}</span></button>`).join('')
      + fuera.map((l) => `<button type="button" data-stock-libre="${escapar(l.id)}">${icono('paquete')}<span>${escapar([l.marca, l.nombre].filter(Boolean).join(' · '))}${l.ml ? ` · ${l.ml} ml` : ''} <small>(fuera del catálogo)</small></span></button>`).join('')
      + (texto.length >= 2 ? `<button type="button" data-libre>${icono('mas')}<span>Agregar "${escapar(texto)}" (no está en el catálogo)</span></button>` : '');
  }, 120));
  const libreNuevo = () => agregar({ libre: true, marca: '', nombre: buscar.value.trim(), ml: 100, cantidad: 1, costo: '' });
  d.querySelector('.selector-perfume__libre').addEventListener('click', libreNuevo);
  resultados.addEventListener('click', (e) => {
    if (e.target.closest('[data-libre]')) return libreNuevo();
    const sl = e.target.closest('[data-stock-libre]');
    if (sl) {
      const l = libres.find((x) => x.id === sl.dataset.stockLibre);
      return agregar({ libre: true, stockLibre: l.id, marca: l.marca, nombre: l.nombre, ml: l.ml, cantidad: 1, costo: enMoneda(l.costo) });
    }
    const b = e.target.closest('[data-id]');
    if (!b) return undefined;
    const p = lista.find((x) => x.id === b.dataset.id);
    const pres = p.presentaciones[0];
    return agregar({ id: p.id, ml: pres.ml, cantidad: 1, costo: enMoneda(pres.costo) });
  });
  cont.addEventListener('input', (e) => {
    const fila = e.target.closest('[data-i]');
    const campo = e.target.dataset.campo;
    if (!fila || !campo) return;
    const l = lineas[Number(fila.dataset.i)];
    l[campo] = campo === 'marca' || campo === 'nombre' || campo === 'costo' ? e.target.value : Number(e.target.value);
    if (campo === 'ml' && !l.libre) {
      const pres = lista.find((x) => x.id === l.id)?.presentaciones.find((x) => x.ml === l.ml);
      if (pres?.costo !== null && pres?.costo !== undefined) {
        l.costo = enMoneda(pres.costo);
        fila.querySelector('[data-campo="costo"]').value = l.costo;
      }
    }
    pintarTotal();
  });
  cont.addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    lineas.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
    pintar();
  });
  d.querySelectorAll('[name=moneda-compra]').forEach((r) => r.addEventListener('change', () => {
    // Los costos ya escritos se pasan a la otra moneda con el dólar de hoy.
    const antes = moneda;
    moneda = r.value;
    for (const l of lineas) {
      if (l.costo === '' || l.costo === null) continue;
      const n = Number(l.costo);
      l.costo = antes === 'ARS' && moneda === 'USD' ? Math.round((n / dolarActual()) * 100) / 100 : antes === 'USD' && moneda === 'ARS' ? Math.round(n * dolarActual()) : n;
    }
    pintar();
  }));
  d.querySelectorAll('[name=pago]').forEach((r) => r.addEventListener('change', pintarTotal));

  d.querySelector('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!lineas.length) return aviso('Agregá al menos un perfume.', 'error');
    if (lineas.some((l) => l.libre && String(l.nombre || '').trim().length < 2)) return aviso('Escribí el nombre de cada perfume que no está en el catálogo.', 'error');
    const pago = d.querySelector('[name=pago]:checked').value;
    if (pago === 'deuda' && !d.querySelector('[data-proveedor]').value.trim()) {
      d.querySelector('[data-proveedor]').focus();
      return aviso('Escribí a qué proveedor se le debe.', 'error');
    }
    try {
      await api('/stock/compras', {
        metodo: 'POST',
        datos: {
          proveedor: d.querySelector('[data-proveedor]').value,
          fecha: d.querySelector('[data-fecha]').value,
          moneda,
          pago,
          metodo: d.querySelector('[data-metodo]').value,
          items: lineas.map((l) => (l.libre
            ? { libre: true, stockLibre: l.stockLibre, marca: l.marca, nombre: l.nombre, ml: l.ml, cantidad: l.cantidad, costo: l.costo }
            : { id: l.id, ml: l.ml, cantidad: l.cantidad, costo: l.costo })),
        },
      });
      olvidarPerfumes(); // cambió el stock y el último costo
      aviso('Compra cargada: el stock ya está sumado');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));
  setTimeout(() => buscar.focus(), 80);
  return h.cerrada.then((v) => v === true);
}

// Perfume fuera del catálogo: corregir nombre, tamaño, cantidad o costo, o sacarlo de la lista.
function dialogoLibre(l) {
  const h = hoja({
    titulo: [l.marca, l.nombre].filter(Boolean).join(' · '),
    ancho: 460,
    html: `
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Marca</span><input data-c="marca" maxlength="80" value="${escapar(l.marca)}"></label>
        <label class="campo"><span>Nombre</span><input data-c="nombre" maxlength="120" value="${escapar(l.nombre)}"></label>
        <label class="campo"><span>Tamaño (ml)</span><input data-c="ml" type="number" inputmode="numeric" min="0" value="${l.ml}"></label>
        <label class="campo"><span>En stock</span><input data-c="cantidad" type="number" inputmode="numeric" min="0" value="${l.cantidad}"></label>
        <label class="campo"><span>Último costo (USD)</span><input data-c="costo" type="number" inputmode="decimal" min="0" step="0.01" value="${l.costo ?? ''}"></label>
      </div>
      <button class="boton boton--peligro boton--chico" type="button" data-borrar style="justify-self:start">${icono('basura')} Sacar de la lista</button>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Guardar</button>',
  });
  h.dialogo.querySelector('[data-ok]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const datos = {};
    h.dialogo.querySelectorAll('[data-c]').forEach((el) => { datos[el.dataset.c] = el.value; });
    try {
      await api(`/stock/libres/${encodeURIComponent(l.id)}`, { metodo: 'PUT', datos });
      aviso('Guardado');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  h.dialogo.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!(await confirmar(`¿Sacar ${l.nombre} de la lista de stock?`, { aceptar: 'Sacar', peligro: true }))) return;
    try {
      await api(`/stock/libres/${encodeURIComponent(l.id)}`, { metodo: 'DELETE' });
      aviso('Sacado de la lista');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  });
  return h.cerrada.then((v) => v === true);
}

export async function montar({ vista, app }) {
  app.titulo('Stock');
  const compra = document.createElement('button');
  compra.className = 'boton boton--lleno boton--chico';
  compra.type = 'button';
  compra.innerHTML = `${icono('mas')}<span>Compra</span>`;
  app.acciones(compra);

  const estado = { filtro: 'todo', q: '', mostrados: POR_TANDA };
  let lista = [];
  let datos = { libres: [], compras: [] };

  vista.innerHTML = `
    <div class="cifras" data-cifras></div>
    <div class="herramientas-admin" style="margin-top:14px">
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar perfume o marca" data-q enterkeyhint="search" aria-label="Buscar en el stock"></label>
      <div class="chips-admin" data-filtros role="group" aria-label="Qué mostrar"></div>
    </div>
    <ul class="lista-admin lista-stock" data-lista></ul>
    <div class="ver-mas" data-mas hidden><button class="boton boton--suave" type="button">Ver más</button></div>
    <section class="tarjeta-admin" data-compras style="margin-top:18px"></section>`;

  // Todo lo que tiene stock: cada tamaño del catálogo y cada perfume de fuera del catálogo.
  function filas() {
    const delCatalogo = lista.flatMap((p) => p.presentaciones.filter((x) => Number(x.stock) > 0).map((x) => ({
      clave: `${p.id}|${x.ml}`, p, ml: x.ml, cantidad: Number(x.stock), costo: x.costo ?? null, texto: `${p.marca} ${p.nombre}`,
    })));
    const fuera = datos.libres.filter((l) => l.cantidad > 0).map((l) => ({
      clave: `libre|${l.id}`, libre: l, ml: l.ml, cantidad: l.cantidad, costo: l.costo, texto: `${l.marca} ${l.nombre}`,
    }));
    return { delCatalogo, fuera };
  }

  function fila(f) {
    const nombre = f.libre ? [f.libre.marca, f.libre.nombre].filter(Boolean).join(' · ') : `${f.p.marca} · ${f.p.nombre}`;
    return `
      <li class="fila-admin fila-stock" data-clave="${escapar(f.clave)}">
        ${f.libre ? `<span class="mini mini--svg">${icono('paquete')}</span>` : miniatura(f.p)}
        <span class="fila-admin__texto">
          <span class="fila-admin__titulo">${escapar(nombre)}</span>
          <span class="fila-admin__sub">${textoMl(f.ml)}${f.libre ? ' · fuera del catálogo' : ''}${f.costo !== null ? ` · costo ${pesos(f.costo)}` : ''}</span>
        </span>
        <span class="contador-stock">
          <button class="boton-icono" type="button" data-mover="-1" aria-label="Uno menos">${icono('menos')}</button>
          <strong data-cantidad>${f.cantidad}</strong>
          <button class="boton-icono" type="button" data-mover="1" aria-label="Uno más">${icono('mas')}</button>
        </span>
        ${f.libre ? `<button class="boton-icono" type="button" data-editar-libre aria-label="Editar">${icono('editar')}</button>` : ''}
      </li>`;
  }

  function pintar() {
    const { delCatalogo, fuera } = filas();
    const todas = [...delCatalogo, ...fuera];
    const unidades = todas.reduce((n, f) => n + f.cantidad, 0);
    const valor = todas.reduce((n, f) => n + (f.costo || 0) * f.cantidad, 0);
    vista.querySelector('[data-cifras]').innerHTML = `
      <div class="cifra"><span class="cifra__rotulo">Unidades en stock</span><span class="cifra__valor">${unidades}</span><span class="cifra__nota">${todas.length} ${todas.length === 1 ? 'perfume' : 'perfumes'}, ${fuera.reduce((n, f) => n + f.cantidad, 0)} fuera del catálogo</span></div>
      <div class="cifra"><span class="cifra__rotulo">Valor a costo</span><span class="cifra__valor">${dolarActual() ? ars(Math.round((valor * dolarActual()) / 100) * 100) : usd(valor)}</span><span class="cifra__nota">Con el último costo cargado</span></div>`;
    const cuentas = { todo: todas.length, catalogo: delCatalogo.length, fuera: fuera.length };
    vista.querySelector('[data-filtros]').innerHTML = Object.entries(FILTROS)
      .map(([k, v]) => `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${estado.filtro === k}">${v}<span>${cuentas[k]}</span></button>`).join('');
    const palabras = normalizar(estado.q).split(/\s+/).filter(Boolean);
    const elegidas = (estado.filtro === 'catalogo' ? delCatalogo : estado.filtro === 'fuera' ? fuera : todas)
      .filter((f) => palabras.every((w) => normalizar(f.texto).includes(w)))
      .sort((a, b) => a.texto.localeCompare(b.texto, 'es') || a.ml - b.ml);
    vista.querySelector('[data-lista]').innerHTML = elegidas.length
      ? elegidas.slice(0, estado.mostrados).map(fila).join('')
      : `<li class="vacio-admin">${icono('paquete')}<p>${estado.q ? 'No hay nada con esa búsqueda.' : 'No hay stock cargado acá.'}</p><p class="vacio-admin__detalle">Con "Compra" cargás lo que compraron: suma el stock y registra el gasto.</p></li>`;
    vista.querySelector('[data-mas]').hidden = elegidas.length <= estado.mostrados;

    vista.querySelector('[data-compras]').innerHTML = `
      <h2 class="tarjeta-admin__titulo">Últimas compras</h2>
      ${datos.compras.length ? `
        <p class="campo__ayuda" style="margin-bottom:8px">Si cargaron una mal, deshacela: se resta el stock que sumó y se borra su gasto (o su deuda).</p>
        <ul class="lista-admin">${datos.compras.map((c) => {
          const unidades = c.items.reduce((n, i) => n + i.cantidad, 0);
          return `
          <li class="fila-admin" data-compra="${escapar(c.id)}">
            <span class="fila-admin__texto">
              <span class="fila-admin__titulo">${fecha(c.fecha)}${c.proveedor ? ` · ${escapar(c.proveedor)}` : ''} · ${c.moneda === 'ARS' ? ars(c.total) : usd(c.total)}</span>
              <span class="fila-admin__sub">${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} · ${PAGOS[c.pago] || c.pago} · ${escapar(c.items.map((i) => `${i.cantidad}× ${[i.marca, i.nombre].filter(Boolean).join(' ')}`).join(', ').slice(0, 140))}</span>
            </span>
            <button class="boton boton--peligro boton--chico" type="button" data-deshacer>${icono('girar')} Deshacer</button>
          </li>`;
        }).join('')}</ul>` : '<p class="cifra__nota">Todavía no cargaron compras.</p>'}`;
  }

  async function cargar() {
    [lista, datos] = await Promise.all([perfumesLivianos(), api('/stock')]);
    pintar();
  }

  // Los + y − cambian el número al instante y se guarda un momento después (así se pueden tocar varias veces seguidas).
  const pendientes = new Map();
  const guardar = demorar(async () => {
    const cambios = [...pendientes.entries()];
    pendientes.clear();
    try {
      for (const [claveFila, cantidad] of cambios) {
        const [a, b] = claveFila.split('|');
        if (a === 'libre') await api(`/stock/libres/${encodeURIComponent(b)}`, { metodo: 'PUT', datos: { cantidad } });
        else await api('/stock', { metodo: 'PUT', datos: { id: a, ml: Number(b), stock: cantidad } });
      }
      olvidarPerfumes();
    } catch (err) {
      avisoError(err);
      cargar();
    }
  }, 700);

  vista.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-filtro]');
    if (f) {
      estado.filtro = f.dataset.filtro;
      estado.mostrados = POR_TANDA;
      pintar();
      return;
    }
    if (e.target.closest('[data-mas]')) {
      estado.mostrados += POR_TANDA;
      pintar();
      return;
    }
    const mover = e.target.closest('[data-mover]');
    if (mover) {
      const li = mover.closest('[data-clave]');
      const num = li.querySelector('[data-cantidad]');
      const nuevo = Math.max(0, Number(num.textContent) + Number(mover.dataset.mover));
      num.textContent = nuevo;
      // Se actualiza también la copia local, para que las cifras de arriba cuadren.
      const [a, b] = li.dataset.clave.split('|');
      if (a === 'libre') datos.libres.find((l) => l.id === b).cantidad = nuevo;
      else lista.find((p) => p.id === a).presentaciones.find((x) => x.ml === Number(b)).stock = nuevo;
      pendientes.set(li.dataset.clave, nuevo);
      guardar();
      return;
    }
    if (e.target.closest('[data-editar-libre]')) {
      const id = e.target.closest('[data-clave]').dataset.clave.split('|')[1];
      if (await dialogoLibre(datos.libres.find((l) => l.id === id))) cargar();
      return;
    }
    const deshacer = e.target.closest('[data-deshacer]');
    if (deshacer) {
      const c = datos.compras.find((x) => x.id === deshacer.closest('[data-compra]').dataset.compra);
      if (!(await confirmar(`¿Deshacer la compra del ${fecha(c.fecha)}?`, { aceptar: 'Deshacer', peligro: true, detalle: 'Se resta el stock que sumó y se borra su gasto de la caja (o su deuda).' }))) return;
      try {
        await api(`/stock/compras/${encodeURIComponent(c.id)}`, { metodo: 'DELETE' });
        olvidarPerfumes();
        aviso('Compra deshecha');
        cargar();
      } catch (err) {
        avisoError(err);
      }
    }
  });
  vista.querySelector('[data-q]').addEventListener('input', demorar((e) => {
    estado.q = e.target.value.trim();
    estado.mostrados = POR_TANDA;
    pintar();
  }, 200));
  compra.addEventListener('click', async () => {
    if (await dialogoCompra(lista, datos.libres)) cargar();
  });

  await cargar();
  return undefined;
}
