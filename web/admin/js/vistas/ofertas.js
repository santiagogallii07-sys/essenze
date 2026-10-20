// Cartelera del inicio (diapositivas de ofertas) y descuentos por marca, tipo o selección.
import { api, subirImagen } from '../api.js';
import { procesarFoto } from '../fotos.js';
import { icono, escapar, hoja, confirmar, aviso, avisoError, conCarga, fecha, miniatura, TIPOS } from '../ui.js';
import { frascoSVG } from '/js/frasco.js';

let cachePerfumes = null;
async function perfumes() {
  if (!cachePerfumes) cachePerfumes = await api('/perfumes');
  return cachePerfumes;
}

/* ---------- Descuentos ---------- */

export async function dialogoDescuento({ perfumes: lista, seleccion } = {}) {
  const todos = lista || (await perfumes());
  const marcas = [...new Set(todos.map((p) => p.marca))].sort((a, b) => a.localeCompare(b, 'es'));
  const h = hoja({
    titulo: 'Descuentos',
    ancho: 520,
    html: `
      <div class="segmentado" role="radiogroup" aria-label="Acción">
        <label><input type="radio" name="accion" value="aplicar" checked><span>Aplicar descuento</span></label>
        <label><input type="radio" name="accion" value="quitar"><span>Quitar descuento</span></label>
      </div>
      <label class="campo"><span>¿A qué perfumes?</span>
        <select data-alcance>
          ${seleccion ? `<option value="seleccion">Los ${seleccion.length} de la búsqueda actual</option>` : ''}
          <option value="marca">Una marca</option>
          <option value="tipo">Un tipo</option>
        </select>
      </label>
      <label class="campo" data-campo-marca ${seleccion ? 'hidden' : ''}><span>Marca</span>
        <select data-marca>${marcas.map((m) => `<option>${escapar(m)}</option>`).join('')}</select>
      </label>
      <label class="campo" data-campo-tipo hidden><span>Tipo</span>
        <select data-tipo>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      </label>
      <label class="campo" data-campo-porcentaje><span>Descuento (%)</span>
        <input type="number" inputmode="numeric" min="1" max="89" value="15" data-porcentaje>
        <small class="campo__ayuda">El precio actual queda tachado y el nuevo se redondea al dólar.</small>
      </label>
      <p class="campo__ayuda" data-resumen></p>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-aplicar>Aplicar</button>',
  });
  const d = h.dialogo;
  const alcance = d.querySelector('[data-alcance]');
  const actualizar = () => {
    const a = alcance.value;
    const quitar = d.querySelector('[name=accion]:checked').value === 'quitar';
    d.querySelector('[data-campo-marca]').hidden = a !== 'marca';
    d.querySelector('[data-campo-tipo]').hidden = a !== 'tipo';
    d.querySelector('[data-campo-porcentaje]').hidden = quitar;
    const afectados = a === 'seleccion' ? seleccion.length
      : a === 'marca' ? todos.filter((p) => p.marca === d.querySelector('[data-marca]').value).length
        : todos.filter((p) => p.tipo === d.querySelector('[data-tipo]').value).length;
    d.querySelector('[data-resumen]').textContent = `${quitar ? 'Vuelve al precio anterior en' : 'Se aplica a'} ${afectados} ${afectados === 1 ? 'perfume' : 'perfumes'}.`;
    d.querySelector('[data-aplicar]').textContent = quitar ? 'Quitar descuento' : 'Aplicar';
  };
  d.addEventListener('change', actualizar);
  actualizar();
  d.querySelector('[data-aplicar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const a = alcance.value;
    const cuerpo = {
      accion: d.querySelector('[name=accion]:checked').value,
      porcentaje: Number(d.querySelector('[data-porcentaje]').value),
      ...(a === 'seleccion' ? { ids: seleccion.map((p) => p.id) } : a === 'marca' ? { marca: d.querySelector('[data-marca]').value } : { tipo: d.querySelector('[data-tipo]').value }),
    };
    try {
      const r = await api('/descuentos', { metodo: 'POST', datos: cuerpo });
      cachePerfumes = null;
      aviso(`${cuerpo.accion === 'quitar' ? 'Descuento quitado' : 'Descuento aplicado'} en ${r.perfumes} ${r.perfumes === 1 ? 'perfume' : 'perfumes'}`);
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  return h.cerrada.then((v) => v === true);
}

/* ---------- Cartelera ---------- */

function enlacesSugeridos(lista) {
  const marcas = [...new Set(lista.map((p) => p.marca))].sort((a, b) => a.localeCompare(b, 'es'));
  return [
    ['/catalogo', 'Todo el catálogo'],
    ['/catalogo?oferta=1', 'Todo lo que está en oferta'],
    ...Object.entries(TIPOS).map(([k, v]) => [`/catalogo?tipo=${k}`, v]),
    ...marcas.map((m) => [`/catalogo?marca=${encodeURIComponent(m)}`, `Marca: ${m}`]),
  ];
}

async function editarOferta(oferta) {
  const lista = await perfumes();
  const o = oferta || { etiqueta: '', titulo: '', texto: '', boton: 'Ver ofertas', enlace: '/catalogo?oferta=1', perfume: null, imagen: null, activa: true, desde: '', hasta: '' };
  const enlaces = enlacesSugeridos(lista);
  const elegido = lista.find((p) => p.id === o.perfume);
  const h = hoja({
    titulo: oferta ? 'Editar diapositiva' : 'Nueva diapositiva',
    ancho: 620,
    html: `
      <div class="form-grilla form-grilla--2">
        <label class="campo ancho-total"><span>Título</span><input name="titulo" value="${escapar(o.titulo)}" maxlength="80" placeholder="Ej. Semana Lattafa" required></label>
        <label class="campo ancho-total"><span>Texto</span><textarea name="texto" rows="2" maxlength="240" placeholder="Una línea que explique la oferta">${escapar(o.texto)}</textarea></label>
        <label class="campo"><span>Sello</span><input name="etiqueta" value="${escapar(o.etiqueta)}" maxlength="40" placeholder="Ej. Hasta 20% OFF"></label>
        <label class="campo"><span>Texto del botón</span><input name="boton" value="${escapar(o.boton)}" maxlength="30"></label>
        <label class="campo ancho-total"><span>El botón lleva a</span>
          <select name="enlace">
            ${enlaces.map(([v, t]) => `<option value="${escapar(v)}" ${o.enlace === v ? 'selected' : ''}>${escapar(t)}</option>`).join('')}
            ${enlaces.some(([v]) => v === o.enlace) ? '' : `<option value="${escapar(o.enlace)}" selected>${escapar(o.enlace)}</option>`}
          </select>
        </label>
        <label class="campo ancho-total selector-perfume"><span>Perfume que se muestra</span>
          <input class="entrada" data-buscar-perfume placeholder="Buscar perfume…" value="${elegido ? escapar(`${elegido.marca} ${elegido.nombre}`) : ''}" autocomplete="off">
          <div class="resultados-busqueda" data-resultados hidden></div>
        </label>
        <div class="campo ancho-total">
          <span class="campo__rotulo">O una imagen propia (banner)</span>
          <div class="botonera">
            <label class="boton boton--suave boton--chico">${icono('imagen')}<span data-texto-imagen>${o.imagen ? 'Cambiar imagen' : 'Subir imagen'}</span><input type="file" accept="image/*" hidden data-imagen></label>
            <button class="boton boton--suave boton--chico" type="button" data-quitar-imagen ${o.imagen ? '' : 'hidden'}>Quitar imagen</button>
          </div>
        </div>
        <label class="campo"><span>Desde (opcional)</span><input type="date" name="desde" value="${o.desde || ''}"></label>
        <label class="campo"><span>Hasta (opcional)</span><input type="date" name="hasta" value="${o.hasta || ''}"></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Activa</span><input type="checkbox" name="activa" ${o.activa ? 'checked' : ''}><span class="interruptor__pista"></span></label>
      </div>`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>${oferta ? 'Guardar' : 'Crear'}</button>`,
  });
  const d = h.dialogo;
  let perfumeId = o.perfume;
  let imagenId = o.imagen;
  const buscador = d.querySelector('[data-buscar-perfume]');
  const resultados = d.querySelector('[data-resultados]');
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  buscador.addEventListener('input', () => {
    const q = norm(buscador.value).split(/\s+/).filter(Boolean);
    perfumeId = null;
    const r = q.length ? lista.filter((p) => q.every((w) => norm(`${p.marca} ${p.nombre}`).includes(w))).slice(0, 8) : [];
    resultados.hidden = !r.length;
    resultados.innerHTML = r.map((p) => `<button type="button" data-id="${escapar(p.id)}">${miniatura(p)}<span>${escapar(p.marca)} · ${escapar(p.nombre)}</span></button>`).join('');
  });
  resultados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = lista.find((x) => x.id === b.dataset.id);
    perfumeId = p.id;
    buscador.value = `${p.marca} ${p.nombre}`;
    resultados.hidden = true;
  });
  d.querySelector('[data-imagen]').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const r = await subirImagen(await procesarFoto(archivo, { quitarFondo: true, maximo: 1400 }));
      imagenId = r.id;
      d.querySelector('[data-texto-imagen]').textContent = 'Imagen lista';
      d.querySelector('[data-quitar-imagen]').hidden = false;
    } catch (err) {
      avisoError(err);
    }
  });
  d.querySelector('[data-quitar-imagen]').addEventListener('click', (e) => {
    imagenId = null;
    e.currentTarget.hidden = true;
    d.querySelector('[data-texto-imagen]').textContent = 'Subir imagen';
  });
  d.querySelector('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const f = (n) => d.querySelector(`[name=${n}]`);
    const datos = {
      titulo: f('titulo').value, texto: f('texto').value, etiqueta: f('etiqueta').value, boton: f('boton').value,
      enlace: f('enlace').value, perfume: perfumeId, imagen: imagenId, desde: f('desde').value, hasta: f('hasta').value, activa: f('activa').checked,
    };
    if (!datos.titulo.trim()) return aviso('Poné un título.', 'error');
    try {
      if (oferta) await api(`/ofertas/${oferta.id}`, { metodo: 'PUT', datos });
      else await api('/ofertas', { metodo: 'POST', datos });
      aviso('Cartelera actualizada');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));
  return h.cerrada.then((v) => v === true);
}

function tarjetaOferta(o, porId, i, total) {
  const p = porId.get(o.perfume);
  const vista = o.imagen ? `<img src="/foto/${o.imagen}" alt="">` : p ? (p.imagen ? `<img src="/foto/${p.imagen}" alt="">` : frascoSVG(p, { etiqueta: false })) : icono('imagen');
  const fechas = o.desde || o.hasta ? ` · ${o.desde ? `desde ${fecha(o.desde)}` : ''} ${o.hasta ? `hasta ${fecha(o.hasta)}` : ''}` : '';
  return `
    <article class="oferta-admin ${o.activa ? '' : 'es-inactiva'}" data-id="${o.id}">
      <div class="oferta-admin__vista">${vista}</div>
      <div class="oferta-admin__texto">
        ${o.etiqueta ? `<span class="oferta-admin__etiqueta">${escapar(o.etiqueta)}</span>` : ''}
        <span class="oferta-admin__titulo">${escapar(o.titulo)}</span>
        <span class="oferta-admin__sub">${escapar(o.texto)}</span>
        <span class="oferta-admin__sub">→ ${escapar(o.enlace)}${fechas}</span>
      </div>
      <div class="oferta-admin__acciones">
        <label class="interruptor"><input type="checkbox" data-activa ${o.activa ? 'checked' : ''}><span class="interruptor__pista"></span><span>Activa</span></label>
        <button class="boton-icono" type="button" data-mover="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icono('arriba')}</button>
        <button class="boton-icono" type="button" data-mover="1" aria-label="Bajar" ${i === total - 1 ? 'disabled' : ''}>${icono('abajo')}</button>
        <button class="boton-icono" type="button" data-editar aria-label="Editar">${icono('editar')}</button>
        <button class="boton-icono" type="button" data-borrar aria-label="Eliminar">${icono('basura')}</button>
      </div>
    </article>`;
}

export async function montar({ vista, app }) {
  app.titulo('Ofertas');
  const nueva = document.createElement('button');
  nueva.className = 'boton boton--lleno boton--chico';
  nueva.type = 'button';
  nueva.innerHTML = `${icono('mas')}<span>Diapositiva</span>`;
  app.acciones(nueva);

  let ofertas = [];
  const lista = await perfumes();
  const porId = new Map(lista.map((p) => [p.id, p]));
  const enOferta = () => lista.filter((p) => p.presentaciones.some((x) => x.precioAnterior)).length;

  async function cargar() {
    ofertas = await api('/ofertas');
    pintar();
  }

  function pintar() {
    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Cartelera del inicio <a href="/" target="_blank" rel="noopener">Ver en la tienda</a></h2>
        <p class="campo__ayuda" style="margin-bottom:12px">Las diapositivas se muestran en este orden y pasan solas. Si no hay ninguna activa, se muestra la bienvenida.</p>
        <div data-lista>${ofertas.length ? ofertas.map((o, i) => tarjetaOferta(o, porId, i, ofertas.length)).join('') : '<p class="vacio-admin">Todavía no hay diapositivas.</p>'}</div>
      </section>
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Descuentos en precios</h2>
        <p class="campo__ayuda">Hoy hay <strong>${enOferta()}</strong> perfumes con precio tachado. Aplicá un % a una marca o tipo de una sola vez, o quitalo cuando termine la promo.</p>
        <div class="botonera" style="margin-top:12px">
          <button class="boton boton--contorno" type="button" data-descuento>${icono('porcentaje')} Aplicar o quitar descuento</button>
          <a class="boton boton--suave" href="#/perfumes?filtro=oferta">Ver perfumes en oferta</a>
        </div>
      </section>`;
  }

  vista.addEventListener('click', async (e) => {
    if (e.target.closest('[data-descuento]')) {
      if (await dialogoDescuento({ perfumes: lista })) {
        cachePerfumes = null;
        const nuevos = await perfumes();
        lista.splice(0, lista.length, ...nuevos);
        pintar();
      }
      return;
    }
    const art = e.target.closest('[data-id]');
    if (!art) return;
    const o = ofertas.find((x) => x.id === art.dataset.id);
    if (e.target.closest('[data-editar]')) {
      if (await editarOferta(o)) cargar();
    } else if (e.target.closest('[data-borrar]')) {
      if (await confirmar(`¿Eliminar la diapositiva "${o.titulo}"?`, { aceptar: 'Eliminar', peligro: true })) {
        await api(`/ofertas/${o.id}`, { metodo: 'DELETE' }).catch(avisoError);
        cargar();
      }
    } else if (e.target.closest('[data-mover]')) {
      const i = ofertas.indexOf(o);
      const j = i + Number(e.target.closest('[data-mover]').dataset.mover);
      [ofertas[i], ofertas[j]] = [ofertas[j], ofertas[i]];
      pintar();
      api('/ofertas', { metodo: 'PUT', datos: { orden: ofertas.map((x) => x.id) } }).catch(avisoError);
    }
  });
  vista.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-activa]')) return;
    const o = ofertas.find((x) => x.id === e.target.closest('[data-id]').dataset.id);
    o.activa = e.target.checked;
    try {
      await api(`/ofertas/${o.id}`, { metodo: 'PUT', datos: o });
      aviso(o.activa ? 'Diapositiva activada' : 'Diapositiva pausada');
      pintar();
    } catch (err) {
      avisoError(err);
    }
  });
  nueva.addEventListener('click', async () => {
    if (await editarOferta(null)) cargar();
  });

  await cargar();
  return undefined;
}
