// Configuración de un evento de precios: fechas, modo (automático o manual), reglas (todas opcionales),
// qué perfumes entran y la vista previa de cómo quedan los precios, con cambios a mano perfume por perfume.
import { api } from '../api.js';
import { icono, escapar, ars, usd, dolarActual, confirmar, aviso, avisoError, conCarga, demorar, TIPOS } from '../ui.js';
import { normalizar } from '../datos.js';
import { ESTADOS_EVENTO, fechaEvento } from './eventos.js';

const POR_TANDA = 60;
const plata = (u) => (u === null || u === undefined ? '—' : dolarActual() ? ars(u * dolarActual()) : usd(u));
const dolares = (u) => (u === null || u === undefined ? '—' : usd(u));

function filaTramo(t, i, ultimo) {
  return `
    <div class="tramo" data-tramo="${i}">
      <span>${ultimo ? 'Si hoy le ganan más que eso' : 'Si hoy le ganan hasta USD'}</span>
      ${ultimo ? '' : `<input class="entrada" type="number" inputmode="decimal" min="0" step="1" value="${t.hasta ?? ''}" data-t="hasta" aria-label="Ganancia de hoy, hasta">`}
      <span>→ en el evento le ganan USD</span>
      <input class="entrada" type="number" inputmode="decimal" min="0" step="1" value="${t.ganancia}" data-t="ganancia" aria-label="Ganancia en el evento">
      ${ultimo ? '' : `<button class="boton-icono" type="button" data-quitar-tramo aria-label="Quitar este tramo">${icono('cerrar')}</button>`}
    </div>`;
}

export async function montar({ vista, params, app }) {
  const id = params[0];
  const r = await api(`/eventos/${encodeURIComponent(id)}`);
  const ev = r.evento;
  const config = ev.config;
  const enCurso = ['activo', 'aplicando', 'terminando'].includes(ev.estado);
  app.titulo(ev.nombre, { volver: '/eventos' });
  app.acciones('');

  let filas = [];
  let mostrados = POR_TANDA;
  let busqueda = '';
  let verTodos = false;
  let filtroMarcas = '';

  const estadoTexto = {
    activo: `Activo: ${ev.precios} precios tienen el precio del evento. ${ev.modo === 'auto' && ev.hasta ? `Termina solo el ${fechaEvento(ev.hasta)}.` : 'Lo terminás con el botón.'} Para cambiar algo, terminalo primero.`,
    programado: `Empieza solo el ${fechaEvento(ev.desde)} y termina solo el ${fechaEvento(ev.hasta)}. Hasta entonces podés cambiar lo que quieras.`,
    borrador: ev.modo === 'auto' ? 'Elegí las fechas y guardá para que quede programado.' : 'Listo: cuando quieras empezar, tocá "Activar ahora".',
    terminado: 'Terminó: los precios volvieron a como estaban. Lo podés volver a usar cambiando las fechas.',
  }[ev.estado] || '';

  vista.innerHTML = `
    <section class="tarjeta-admin estado-evento-caja estado-evento-caja--${ev.estado}">
      <span class="estado-evento estado-evento--${ev.estado}">${ESTADOS_EVENTO[ev.estado] || ev.estado}</span>
      <p>${estadoTexto}</p>
      ${ev.estado === 'activo' ? `<button class="boton boton--peligro boton--chico" type="button" data-terminar>${icono('cerrar')} Terminar ahora</button>` : ''}
    </section>

    <section class="tarjeta-admin">
      <h2 class="tarjeta-admin__titulo">En la tienda</h2>
      <p class="campo__ayuda" style="margin-bottom:10px">Mientras está activo, el evento sale primero en el menú con su nombre y tiene su propia página (no se mezcla con Ofertas).
        Para un banner que lleve ahí, en <a href="#/ofertas">Ofertas → Cartelera</a> elegí "Lleva a: el evento"; sale primero mientras el evento esté activo.</p>
      <label class="interruptor"><span class="interruptor__texto">Mostrar el % de descuento<small>Apagado: solo se ve el precio de antes tachado y el precio nuevo, sin el cartel con el %. Se puede cambiar aunque esté activo.</small></span>
        <input type="checkbox" data-mostrar-porcentaje ${config.mostrarPorcentaje ? 'checked' : ''}><span class="interruptor__pista"></span></label>
    </section>

    <form data-form-evento>
      <fieldset class="evento-campos" ${enCurso ? 'disabled' : ''}>
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Datos</h2>
          <div class="form-grilla form-grilla--2">
            <label class="campo ancho-total"><span>Nombre</span><input name="nombre" maxlength="60" value="${escapar(ev.nombre)}"></label>
            <label class="campo"><span>Empieza</span><input name="desde" type="datetime-local" value="${ev.desde}"></label>
            <label class="campo"><span>Termina</span><input name="hasta" type="datetime-local" value="${ev.hasta}"></label>
            <div class="campo ancho-total"><span class="campo__rotulo">Cómo se prende</span>
              <div class="segmentado" role="radiogroup" aria-label="Cómo se prende">
                <label><input type="radio" name="modo" value="auto" ${ev.modo === 'auto' ? 'checked' : ''}><span>Automático</span></label>
                <label><input type="radio" name="modo" value="manual" ${ev.modo !== 'auto' ? 'checked' : ''}><span>Manual</span></label>
              </div>
              <small class="campo__ayuda" data-ayuda-modo></small>
            </div>
          </div>
        </section>

        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Cómo cambian los precios</h2>
          <p class="campo__ayuda" style="margin-bottom:6px">Todo es opcional: prendé las reglas que quieras. Las ganancias son en dólares.</p>

          <label class="interruptor"><span class="interruptor__texto">Ganancia por tramos<small>Según cuánto le ganan hoy a cada perfume. Solo para los que tienen costo cargado.</small></span>
            <input type="checkbox" name="tramos" ${config.tramos.activo ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          <div class="tramos" data-tramos>${config.tramos.lista.map((t, i, l) => filaTramo(t, i, i === l.length - 1)).join('')}</div>
          <button class="boton boton--suave boton--chico" type="button" data-agregar-tramo>${icono('mas')} Agregar tramo</button>

          <label class="interruptor"><span class="interruptor__texto">Descuento en %<small>Para los perfumes sin costo cargado, o para todos.</small></span>
            <input type="checkbox" name="porcentaje" ${config.porcentaje.activo ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          <div class="form-grilla form-grilla--2" data-bloque-porcentaje>
            <label class="campo"><span>Descuento (%)</span><input name="porcentajeValor" type="number" inputmode="decimal" min="1" max="90" step="1" value="${config.porcentaje.valor}"></label>
            <div class="campo"><span class="campo__rotulo">A cuáles</span>
              <div class="segmentado" role="radiogroup" aria-label="A cuáles">
                <label><input type="radio" name="aQuien" value="sinCosto" ${config.porcentaje.aQuien !== 'todos' ? 'checked' : ''}><span>Los sin costo</span></label>
                <label><input type="radio" name="aQuien" value="todos" ${config.porcentaje.aQuien === 'todos' ? 'checked' : ''}><span>Todos</span></label>
              </div>
            </div>
          </div>

          <label class="interruptor"><span class="interruptor__texto">Ganancia mínima<small>Nunca ganarle menos que esto a un perfume (si tiene costo cargado).</small></span>
            <input type="checkbox" name="piso" ${config.piso.activo ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          <label class="campo" data-bloque-piso><span>Mínimo (USD)</span><input name="pisoValor" type="number" inputmode="decimal" min="0" step="1" value="${config.piso.valor}"></label>

          <label class="interruptor"><span class="interruptor__texto">Precio en pesos terminado en 900<small>Redondea para arriba (ej. $ 54.900).</small></span>
            <input type="checkbox" name="redondeo" ${config.redondeo ? 'checked' : ''}><span class="interruptor__pista"></span></label>
        </section>

        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Qué perfumes entran</h2>
          <p class="campo__ayuda">Si no marcás nada, entran todos.</p>
          <div class="casillas" style="margin:10px 0 14px">${Object.entries(TIPOS).map(([k, v]) => `
            <label class="casilla"><input type="checkbox" name="tipo" value="${k}" ${config.alcance.tipos.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
          <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar marca" data-buscar-marca aria-label="Buscar marca"></label>
          <div class="marcas-evento" data-marcas>${r.marcas.map((m) => `
            <label class="casilla" data-texto="${escapar(normalizar(m))}"><input type="checkbox" name="marca" value="${escapar(m)}" ${config.alcance.marcas.includes(m) ? 'checked' : ''}><span>${escapar(m)}</span></label>`).join('')}</div>
        </section>
      </fieldset>

      <section class="tarjeta-admin" ${enCurso ? 'hidden' : ''}>
        <h2 class="tarjeta-admin__titulo">Así quedan los precios</h2>
        <div class="resumen-evento" data-resumen><div class="cargando"><span></span><span></span><span></span></div></div>
        <div class="herramientas-admin">
          <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar perfume o marca" data-buscar aria-label="Buscar perfume"></label>
          <label class="interruptor" style="min-height:40px"><span class="interruptor__texto">Ver también los que no cambian</span><input type="checkbox" data-ver-todos><span class="interruptor__pista"></span></label>
        </div>
        <div class="lista-evento" data-lista></div>
        <div class="ver-mas" data-mas hidden><button class="boton boton--suave" type="button">Ver más</button></div>
      </section>

      <div class="barra-guardar">
        <button class="boton boton--suave" type="button" data-borrar>${icono('basura')}<span>Borrar</span></button>
        ${enCurso ? '' : `
          <button class="boton boton--contorno" type="submit">Guardar</button>
          <button class="boton boton--lleno" type="button" data-activar ${ev.modo === 'auto' ? 'hidden' : ''}>Activar ahora</button>`}
      </div>
    </form>`;

  const form = vista.querySelector('[data-form-evento]');
  const f = form.elements;

  function leerConfig() {
    const tramos = [...form.querySelectorAll('[data-tramo]')].map((el) => ({
      hasta: el.querySelector('[data-t="hasta"]') ? Number(el.querySelector('[data-t="hasta"]').value) || 0 : null,
      ganancia: Number(el.querySelector('[data-t="ganancia"]').value) || 0,
    }));
    return {
      tramos: { activo: f.tramos.checked, lista: tramos },
      porcentaje: { activo: f.porcentaje.checked, valor: Number(f.porcentajeValor.value) || 0, aQuien: form.querySelector('[name=aQuien]:checked').value },
      piso: { activo: f.piso.checked, valor: Number(f.pisoValor.value) || 0 },
      alcance: {
        tipos: [...form.querySelectorAll('[name=tipo]:checked')].map((x) => x.value),
        marcas: [...form.querySelectorAll('[name=marca]:checked')].map((x) => x.value),
      },
      manuales: config.manuales,
      redondeo: f.redondeo.checked,
      mostrarPorcentaje: config.mostrarPorcentaje,
    };
  }

  vista.querySelector('[data-mostrar-porcentaje]').addEventListener('change', async (e) => {
    const valor = e.target.checked;
    try {
      await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'POST', datos: { accion: 'tienda', mostrarPorcentaje: valor } });
      config.mostrarPorcentaje = valor;
      aviso(valor ? 'Listo: en la tienda se ve el % de descuento' : 'Listo: en la tienda se ve solo el precio de antes tachado');
    } catch (err) {
      e.target.checked = !valor;
      avisoError(err);
    }
  });

  function mostrarBloques() {
    const auto = form.querySelector('[name=modo]:checked').value === 'auto';
    form.querySelector('[data-ayuda-modo]').textContent = auto
      ? 'Empieza y termina solo en las fechas de arriba. Al terminar, los precios vuelven a como estaban.'
      : 'Lo prenden con "Activar ahora" y lo apagan con "Terminar ahora". Las fechas son solo de referencia.';
    form.querySelector('[data-activar]')?.toggleAttribute('hidden', auto);
    form.querySelector('[data-tramos]').hidden = !f.tramos.checked;
    form.querySelector('[data-agregar-tramo]').hidden = !f.tramos.checked;
    form.querySelector('[data-bloque-porcentaje]').hidden = !f.porcentaje.checked;
    form.querySelector('[data-bloque-piso]').hidden = !f.piso.checked;
  }

  function pintarLista() {
    const q = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const visibles = filas.filter((x) => (verTodos || x.nuevo !== null || x.regla === 'excluido' || x.regla === 'a mano')
      && q.every((w) => normalizar(`${x.marca} ${x.nombre}`).includes(w)));
    const lista = vista.querySelector('[data-lista]');
    lista.innerHTML = visibles.length ? visibles.slice(0, mostrados).map((x) => {
      const m = config.manuales[x.clave] || {};
      return `
      <div class="fila-evento ${x.nuevo === null ? 'es-igual' : ''}" data-clave="${escapar(x.clave)}">
        <div class="fila-evento__perfume"><strong>${escapar(x.nombre)}</strong><small>${escapar(x.marca)}${x.ml ? ` · ${x.ml} ml` : ''} · ${escapar(x.regla)}</small></div>
        <div class="fila-evento__dato"><small>Hoy</small><span>${plata(x.precio)}</span><small>${x.costo !== null ? `gana ${dolares(x.ganancia)}` : 'sin costo'}</small></div>
        <div class="fila-evento__dato fila-evento__dato--nuevo"><small>Evento</small><span>${x.nuevo !== null ? plata(x.nuevo) : 'igual'}</span><small>${x.gananciaNueva !== null ? `gana ${dolares(x.gananciaNueva)}` : ''}</small></div>
        <label class="fila-evento__manual"><small>${x.costo !== null ? 'Ganancia a mano (USD)' : 'Precio a mano (USD)'}</small>
          <input class="entrada" type="number" inputmode="decimal" min="0" step="1" placeholder="Auto" value="${x.costo !== null ? m.ganancia ?? '' : m.precio ?? ''}" data-manual></label>
        <label class="fila-evento__fuera"><input type="checkbox" data-excluir ${m.excluir ? 'checked' : ''}><span>Sacar</span></label>
      </div>`;
    }).join('') : '<p class="cifra__nota">No hay perfumes con esa búsqueda.</p>';
    vista.querySelector('[data-mas]').hidden = visibles.length <= mostrados;
  }

  function pintarResumen() {
    const cambian = filas.filter((x) => x.nuevo !== null);
    const conCosto = cambian.filter((x) => x.costo !== null);
    const sinCosto = filas.filter((x) => x.costo === null).length;
    const promedio = (k) => (conCosto.length ? conCosto.reduce((n, x) => n + x[k], 0) / conCosto.length : 0);
    vista.querySelector('[data-resumen]').innerHTML = `
      <div class="cifras">
        <div class="cifra"><span class="cifra__rotulo">Precios que cambian</span><span class="cifra__valor">${cambian.length}</span><span class="cifra__nota">de ${filas.length} tamaños</span></div>
        <div class="cifra"><span class="cifra__rotulo">Ganancia promedio hoy</span><span class="cifra__valor">${dolares(promedio('ganancia'))}</span><span class="cifra__nota">de los que cambian y tienen costo</span></div>
        <div class="cifra"><span class="cifra__rotulo">Ganancia promedio evento</span><span class="cifra__valor">${dolares(promedio('gananciaNueva'))}</span><span class="cifra__nota">${conCosto.length} con costo</span></div>
        <div class="cifra"><span class="cifra__rotulo">Sin costo cargado</span><span class="cifra__valor">${sinCosto}</span><span class="cifra__nota">${f.porcentaje.checked ? 'reciben el % de descuento' : 'quedan igual'}</span></div>
      </div>`;
  }

  let pedido = 0;
  const calcular = demorar(async () => {
    if (enCurso) return;
    const este = ++pedido;
    try {
      const res = await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'POST', datos: { accion: 'vista', config: leerConfig() } });
      if (este !== pedido) return;
      filas = res.filas;
      pintarResumen();
      pintarLista();
    } catch (err) {
      avisoError(err);
    }
  }, 350);

  // Cambios en la configuración → se recalcula la vista previa.
  form.addEventListener('input', (e) => {
    if (e.target.matches('[data-buscar-marca]')) {
      filtroMarcas = normalizar(e.target.value.trim());
      form.querySelectorAll('[data-marcas] [data-texto]').forEach((el) => { el.hidden = filtroMarcas && !el.dataset.texto.includes(filtroMarcas); });
      return;
    }
    if (e.target.matches('[data-buscar]')) {
      busqueda = e.target.value.trim();
      mostrados = POR_TANDA;
      pintarLista();
      return;
    }
    if (e.target.matches('[data-manual]')) {
      const clave = e.target.closest('[data-clave]').dataset.clave;
      const fila = filas.find((x) => x.clave === clave);
      const v = e.target.value.trim();
      if (v === '') delete config.manuales[clave];
      else config.manuales[clave] = fila.costo !== null ? { ganancia: Number(v) } : { precio: Number(v) };
      calcular();
      return;
    }
    if (e.target.name === 'nombre' || e.target.name === 'desde' || e.target.name === 'hasta') return;
    calcular();
  });
  form.addEventListener('change', (e) => {
    if (e.target.matches('[data-ver-todos]')) {
      verTodos = e.target.checked;
      mostrados = POR_TANDA;
      pintarLista();
      return;
    }
    if (e.target.matches('[data-excluir]')) {
      const clave = e.target.closest('[data-clave]').dataset.clave;
      if (e.target.checked) config.manuales[clave] = { excluir: true };
      else delete config.manuales[clave];
    }
    mostrarBloques();
    if (!e.target.matches('[data-manual], [name=nombre], [name=desde], [name=hasta], [name=modo]')) calcular();
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-agregar-tramo]')) {
      const cont = form.querySelector('[data-tramos]');
      const lista = leerConfig().tramos.lista;
      const anterior = lista.length > 1 ? lista[lista.length - 2].hasta || 0 : 0;
      lista.splice(lista.length - 1, 0, { hasta: anterior + 30, ganancia: lista[lista.length - 1].ganancia });
      cont.innerHTML = lista.map((t, i, l) => filaTramo(t, i, i === l.length - 1)).join('');
      calcular();
    }
    const quitar = e.target.closest('[data-quitar-tramo]');
    if (quitar) {
      quitar.closest('[data-tramo]').remove();
      const cont = form.querySelector('[data-tramos]');
      cont.innerHTML = leerConfig().tramos.lista.map((t, i, l) => filaTramo(t, i, i === l.length - 1)).join('');
      calcular();
    }
    if (e.target.closest('[data-mas]')) {
      mostrados += POR_TANDA;
      pintarLista();
    }
  });

  const datos = () => ({
    nombre: f.nombre.value,
    desde: f.desde.value,
    hasta: f.hasta.value,
    modo: form.querySelector('[name=modo]:checked').value,
    config: leerConfig(),
  });

  async function guardar() {
    const res = await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'PUT', datos: datos() });
    app.titulo(f.nombre.value, { volver: '/eventos' });
    return res;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(form.querySelector('[type=submit]'), async () => {
      try {
        const res = await guardar();
        aviso(res.estado === 'programado' ? `Guardado: empieza solo el ${fechaEvento(f.desde.value)}` : 'Evento guardado');
        app.ir('/eventos');
      } catch (err) {
        avisoError(err);
      }
    });
  });

  form.querySelector('[data-activar]')?.addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const n = filas.filter((x) => x.nuevo !== null).length;
    if (!(await confirmar(`¿Activar "${f.nombre.value}" ahora?`, { aceptar: 'Activar', detalle: `Cambian ${n} precios en la tienda. El precio de antes queda tachado y vuelve solo cuando lo terminás.` }))) return;
    try {
      await guardar();
      const res = await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'POST', datos: { accion: 'activar' } });
      aviso(`Evento activo: ${res.precios} precios cambiados`);
      app.ir('/eventos');
    } catch (err) {
      avisoError(err);
    }
  }));

  vista.querySelector('[data-terminar]')?.addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!(await confirmar(`¿Terminar "${ev.nombre}"?`, { aceptar: 'Terminar', peligro: true, detalle: 'Los precios vuelven a como estaban antes del evento.' }))) return;
    try {
      await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'POST', datos: { accion: 'terminar' } });
      aviso('Evento terminado: los precios volvieron');
      app.ir('/eventos');
    } catch (err) {
      avisoError(err);
    }
  }));

  vista.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!(await confirmar(`¿Borrar "${ev.nombre}"?`, { aceptar: 'Borrar', peligro: true, detalle: enCurso ? 'Está activo: primero los precios vuelven a como estaban.' : '' }))) return;
    try {
      await api(`/eventos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      aviso('Evento borrado');
      app.ir('/eventos');
    } catch (err) {
      avisoError(err);
    }
  });

  mostrarBloques();
  calcular();
  return undefined;
}
