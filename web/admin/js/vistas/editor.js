// Editor de un perfume: fotos (con recorte de fondo), datos, tamaños/precios/costos y aroma.
import { api, subirImagen } from '../api.js';
import { procesarFoto, urlTemporal } from '../fotos.js';
import { icono, escapar, usd, pesos, dolarActual, hoja, confirmar, aviso, avisoError, conCarga, TIPOS } from '../ui.js';
import { dialogoDescuento } from './ofertas.js';
import { frascoSVG } from '/js/frasco.js';

const ESTACIONES = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno' };
const OCASIONES = { dia: 'Día', noche: 'Noche' };
const CONCENTRACIONES = ['Eau de Parfum', 'Eau de Toilette', 'Parfum', 'Extrait de Parfum', 'Eau de Cologne', 'Eau de Parfum Intense', 'Elixir'];

let cacheLista = null;

const lista = (arr) => (arr || []).join(', ');
const separar = (t) => String(t || '').split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);

// Lee texto copiado de Fragrantica (oración de notas o la pirámide por secciones) y los acordes.
export function leerTextoFragrantica(texto) {
  const t = String(texto || '').replace(/\r/g, '');
  const oracion = (re) => {
    const m = t.match(re);
    return m ? separar(m[1].replace(/\s+y\s+|\s+and\s+/gi, ', ')) : [];
  };
  let salida = oracion(/notas? de salida (?:son|es)\s+([^;.]+)/i);
  let corazon = oracion(/notas? de coraz[oó]n (?:son|es)\s+([^;.]+)/i);
  let fondo = oracion(/notas? de fondo (?:son|es)\s+([^;.]+)/i);
  if (!salida.length) salida = oracion(/top notes? (?:are|is)\s+([^;.]+)/i);
  if (!corazon.length) corazon = oracion(/middle notes? (?:are|is)\s+([^;.]+)/i);
  if (!fondo.length) fondo = oracion(/base notes? (?:are|is)\s+([^;.]+)/i);

  const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const seccion = (inicio, fin) => {
    const i = lineas.findIndex((l) => inicio.test(l));
    if (i < 0) return [];
    const resto = lineas.slice(i + 1);
    const j = resto.findIndex((l) => fin.test(l));
    return (j < 0 ? resto.slice(0, 20) : resto.slice(0, j)).filter((l) => l.length < 40);
  };
  const FIN = /^(notas? de|top notes|middle notes|base notes|heart notes|votos|vote|perfume rating|calificaci|longevidad|longevity|fragancias|acordes|main accords)/i;
  if (!salida.length) salida = seccion(/^(notas? de salida|top notes)$/i, FIN);
  if (!corazon.length) corazon = seccion(/^(notas? de coraz[oó]n|middle notes|heart notes)$/i, FIN);
  if (!fondo.length) fondo = seccion(/^(notas? de fondo|base notes)$/i, FIN);

  const acordes = seccion(/^(acordes principales|main accords)$/i, /^(notas|top|perfume|votos|vote|\d)/i)
    .slice(0, 8)
    .map((nombre, i) => ({ nombre: nombre[0].toUpperCase() + nombre.slice(1), intensidad: Math.max(35, 100 - i * 11) }));
  return { salida, corazon, fondo, acordes };
}

function filaTamano(x = {}) {
  const v = (n) => (n === null || n === undefined ? '' : n);
  return `
    <div class="fila-tamano" data-tamano>
      <label class="campo"><span>ml</span><input type="number" inputmode="numeric" min="0" step="1" name="ml" value="${v(x.ml)}" placeholder="100"></label>
      <label class="campo"><span>Precio USD</span><input type="number" inputmode="decimal" min="0" step="0.01" name="precio" value="${v(x.precio)}" required></label>
      <label class="campo"><span>Precio antes</span><input type="number" inputmode="decimal" min="0" step="0.01" name="precioAnterior" value="${v(x.precioAnterior)}" placeholder="—"></label>
      <label class="campo"><span>Costo USD</span><input type="number" inputmode="decimal" min="0" step="0.01" name="costo" value="${v(x.costo)}" placeholder="—"></label>
      <label class="campo"><span>Stock</span><input type="number" inputmode="numeric" min="0" step="1" name="stock" value="${v(x.stock)}" placeholder="Sin control"></label>
      <button class="boton-icono fila-tamano__quitar" type="button" data-quitar-tamano aria-label="Quitar tamaño">${icono('basura')}</button>
      <p class="fila-tamano__margen" data-margen></p>
    </div>`;
}

function filaAcorde(a = { nombre: '', intensidad: 60 }) {
  return `
    <div class="fila-acorde" data-acorde>
      <input class="entrada" name="acorde" value="${escapar(a.nombre)}" placeholder="Ej. Amaderado" aria-label="Acorde">
      <input type="range" min="10" max="100" step="5" name="intensidad" value="${a.intensidad}" aria-label="Intensidad">
      <button class="boton-icono" type="button" data-quitar-acorde aria-label="Quitar acorde">${icono('cerrar')}</button>
    </div>`;
}

export async function montar({ vista, params, app }) {
  const esNuevo = params[0] === 'nuevo';
  const [perfume, todos] = await Promise.all([
    esNuevo ? Promise.resolve(null) : api(`/perfumes/${encodeURIComponent(params[0])}`),
    cacheLista ? Promise.resolve(cacheLista) : api('/perfumes'),
  ]);
  cacheLista = todos;
  const p = perfume || {
    marca: '', nombre: '', concentracion: 'Eau de Parfum', tipo: 'disenador-masculino', genero: 'hombre',
    familia: '', perfil: '', descripcion: '', notas: { salida: [], corazon: [], fondo: [], destacadas: [] },
    acordes: [], estaciones: [], ocasiones: [], presentaciones: [{ ml: 100, precio: '', precioAnterior: null, costo: null, stock: null }],
    imagen: null, imagen_fondo: '', imagenes: [], modelo3d: '', destacado: false, visible: true, fuente: '',
  };
  const estado = { imagen: p.imagen, fondo: p.imagen_fondo, imagenes: [...(p.imagenes || [])], fotosViejas: new Set(), sucio: false };

  app.titulo(esNuevo ? 'Nuevo perfume' : p.nombre, { volver: '#/perfumes' });
  const marcas = [...new Set(todos.map((x) => x.marca))].sort((a, b) => a.localeCompare(b, 'es'));

  vista.innerHTML = `
    <form class="editor" novalidate data-editor>
      <div class="editor__lado">
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Foto</h2>
          <div class="escena-foto" data-escena></div>
          <div class="botonera" style="margin-top:10px">
            <label class="boton boton--suave">${icono('subir')}<span>Subir</span><input type="file" accept="image/*" data-archivo hidden></label>
            <button class="boton boton--suave" type="button" data-link>${icono('enlace')}<span>Pegar link</span></button>
            <button class="boton-icono" type="button" data-quitar-foto aria-label="Quitar foto">${icono('basura')}</button>
          </div>
          <label class="interruptor" style="margin-top:6px">
            <span class="interruptor__texto">Quitar fondo blanco<small>Deja el frasco solo, sobre el escenario oscuro</small></span>
            <input type="checkbox" data-recortar checked><span class="interruptor__pista"></span>
          </label>
          <p class="campo__ayuda">También podés copiar una imagen y pegarla acá con Ctrl+V.</p>
        </section>

        <details class="tarjeta-admin" ${estado.imagenes.length ? 'open' : ''}>
          <summary class="tarjeta-admin__titulo" style="margin:0">Giro 360° y 3D ${icono('abajo')}</summary>
          <div style="display:grid;gap:10px;margin-top:12px">
            <p class="campo__ayuda">Subí entre 24 y 36 fotos sacadas girando el frasco (mismo fondo y luz). Se ordenan por nombre de archivo.</p>
            <div class="tira-360" data-tira></div>
            <div class="botonera">
              <label class="boton boton--suave">${icono('subir')}<span>Fotos 360°</span><input type="file" accept="image/*" multiple data-archivos-360 hidden></label>
              <button class="boton boton--suave" type="button" data-borrar-360>Quitar</button>
            </div>
            <p class="campo__ayuda" data-progreso-360></p>
            <label class="campo"><span>Modelo 3D (.glb)</span><input name="modelo3d" value="${escapar(p.modelo3d || '')}" placeholder="https://… o /modelos/archivo.glb"></label>
          </div>
        </details>

        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Publicación ${esNuevo ? '' : `<a href="/perfume?p=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Ver en la tienda</a>`}</h2>
          <label class="interruptor"><span class="interruptor__texto">Visible en la tienda</span><input type="checkbox" name="visible" ${p.visible ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          <label class="interruptor"><span class="interruptor__texto">Destacado<small>Aparece en el inicio</small></span><input type="checkbox" name="destacado" ${p.destacado ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          ${p.revisar ? `<p class="marca-revisar" style="margin-top:8px">${icono('alerta')}${escapar(p.revisar)}</p>
            <label class="interruptor"><span class="interruptor__texto">Ya lo revisé</span><input type="checkbox" name="revisado"><span class="interruptor__pista"></span></label>` : ''}
        </section>
      </div>

      <div class="editor__principal">
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Datos</h2>
          <div class="form-grilla form-grilla--2">
            <label class="campo"><span>Marca</span><input name="marca" required list="lista-marcas" value="${escapar(p.marca)}" autocomplete="off"></label>
            <label class="campo"><span>Nombre</span><input name="nombre" required value="${escapar(p.nombre)}" autocomplete="off"></label>
            <label class="campo"><span>Concentración</span><input name="concentracion" list="lista-concentraciones" value="${escapar(p.concentracion)}" autocomplete="off"></label>
            <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="campo"><span>Género</span><select name="genero">${[['hombre', 'Hombre'], ['mujer', 'Mujer'], ['unisex', 'Unisex']].map(([k, v]) => `<option value="${k}" ${p.genero === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          </div>
          <datalist id="lista-marcas">${marcas.map((m) => `<option value="${escapar(m)}"></option>`).join('')}</datalist>
          <datalist id="lista-concentraciones">${CONCENTRACIONES.map((c) => `<option value="${c}"></option>`).join('')}</datalist>
        </section>

        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Tamaños, precios y stock</h2>
          <div class="filas-tamanos" data-tamanos>${p.presentaciones.map(filaTamano).join('')}</div>
          <div class="botonera" style="margin-top:10px"><button class="boton boton--suave boton--chico" type="button" data-agregar-tamano>${icono('mas')}Agregar tamaño</button>${esNuevo ? '' : `<button class="boton boton--contorno boton--chico" type="button" data-precio-rapido>${icono('porcentaje')}Descuento o aumento</button>`}</div>
          <p class="campo__ayuda" style="margin-top:8px">"Precio antes" se muestra tachado (oferta). Stock vacío = no se controla. El costo nunca se muestra en la tienda.</p>
        </section>

        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Aroma
            <span style="display:flex;gap:12px">
              <a href="https://www.google.com/search?q=${encodeURIComponent(`fragrantica ${p.marca} ${p.nombre}`)}" target="_blank" rel="noopener" data-buscar-fragrantica>Buscar en Fragrantica</a>
              <button type="button" data-pegar-fragrantica>Pegar texto</button>
            </span>
          </h2>
          <div class="form-grilla form-grilla--2">
            <label class="campo"><span>Familia olfativa</span><input name="familia" value="${escapar(p.familia)}" placeholder="Ej. Ámbar especiado"></label>
            <label class="campo"><span>Perfil en una línea</span><input name="perfil" value="${escapar(p.perfil)}" placeholder="Ej. Dulce, cálido y amaderado."></label>
            <label class="campo ancho-total"><span>Descripción</span><textarea name="descripcion" rows="3" placeholder="Cómo lo describirías a un cliente">${escapar(p.descripcion)}</textarea></label>
            <label class="campo ancho-total"><span>Notas destacadas</span><textarea name="destacadas" rows="2" placeholder="Separadas por coma">${escapar(lista(p.notas?.destacadas))}</textarea></label>
            <label class="campo"><span>Notas de salida</span><input name="salida" value="${escapar(lista(p.notas?.salida))}" placeholder="Bergamota, pimienta"></label>
            <label class="campo"><span>Notas de corazón</span><input name="corazon" value="${escapar(lista(p.notas?.corazon))}" placeholder="Lavanda, iris"></label>
            <label class="campo ancho-total"><span>Notas de fondo</span><input name="fondo" value="${escapar(lista(p.notas?.fondo))}" placeholder="Vainilla, ámbar, cedro"></label>
          </div>
          <div class="campo" style="margin-top:14px">
            <span class="campo__rotulo">Acordes principales (nombre e intensidad)</span>
            <div class="filas-acordes" data-acordes>${p.acordes.map(filaAcorde).join('')}</div>
            <button class="boton boton--suave boton--chico" type="button" data-agregar-acorde style="justify-self:start">${icono('mas')}Agregar acorde</button>
          </div>
          <div class="campo" style="margin-top:14px">
            <span class="campo__rotulo">Estaciones</span>
            <div class="casillas">${Object.entries(ESTACIONES).map(([k, v]) => `<label class="casilla"><input type="checkbox" name="estaciones" value="${k}" ${p.estaciones.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
          </div>
          <div class="campo" style="margin-top:10px">
            <span class="campo__rotulo">Ocasión</span>
            <div class="casillas">${Object.entries(OCASIONES).map(([k, v]) => `<label class="casilla"><input type="checkbox" name="ocasiones" value="${k}" ${p.ocasiones.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
          </div>
          <label class="campo" style="margin-top:14px"><span>Link de referencia (Fragrantica)</span><input name="fuente" value="${escapar(p.fuente || '')}" placeholder="https://www.fragrantica.es/perfume/…"></label>
        </section>
      </div>

      <div class="barra-guardar">
        <span class="barra-guardar__estado" data-estado-guardado>${esNuevo ? '' : 'Sin cambios'}</span>
        ${esNuevo ? '' : `<button class="boton boton--peligro" type="button" data-eliminar aria-label="Eliminar perfume">${icono('basura')}</button>`}
        <button class="boton boton--lleno" type="submit">${esNuevo ? 'Crear perfume' : 'Guardar'}</button>
      </div>
    </form>`;

  const form = vista.querySelector('[data-editor]');
  const escena = form.querySelector('[data-escena]');
  const estadoGuardado = form.querySelector('[data-estado-guardado]');

  function marcarSucio() {
    estado.sucio = true;
    estadoGuardado.textContent = 'Cambios sin guardar';
  }

  function pintarFoto(urlLocal) {
    const src = urlLocal || (estado.imagen ? `/foto/${estado.imagen}` : '');
    escena.innerHTML = src
      ? `<img src="${src}" alt="" class="${estado.fondo === 'recorte' ? '' : 'es-foto'}"><span class="escena-foto__estado">${estado.fondo === 'recorte' ? 'Fondo quitado' : 'Foto completa'}</span>`
      : `${frascoSVG({ ...p, marca: form.elements.marca.value || p.marca, nombre: form.elements.nombre.value || p.nombre || 'Perfume' })}<span class="escena-foto__estado">Sin foto: se muestra una ilustración</span>`;
  }

  function pintar360() {
    form.querySelector('[data-tira]').innerHTML = estado.imagenes.map((id) => `<img src="/foto/${id}" alt="" loading="lazy">`).join('') || '<span class="campo__ayuda">Sin fotos 360°.</span>';
  }

  function pintarMargenes() {
    form.querySelectorAll('[data-tamano]').forEach((f) => {
      const precio = parseFloat(f.querySelector('[name=precio]').value);
      const costo = parseFloat(f.querySelector('[name=costo]').value);
      const m = f.querySelector('[data-margen]');
      if (Number.isFinite(precio) && Number.isFinite(costo) && precio > 0) {
        const g = precio - costo;
        m.innerHTML = `Ganancia por unidad: <strong>${pesos(g)}</strong> (${Math.round((g / precio) * 100)}%)${dolarActual() ? ` · se vende a ${pesos(precio)}` : ''}`;
      } else m.textContent = Number.isFinite(precio) && dolarActual() ? `Se vende a ${pesos(precio)}` : '';
    });
  }

  async function usarFoto(archivo) {
    const recortar = form.querySelector('[data-recortar]').checked;
    escena.innerHTML = '<div class="cargando"><span></span><span></span><span></span></div>';
    try {
      const procesada = await procesarFoto(archivo, { quitarFondo: recortar });
      estado.fondo = procesada.fondo;
      pintarFoto(urlTemporal(procesada.blob));
      const r = await subirImagen(procesada);
      if (estado.imagen) estado.fotosViejas.add(estado.imagen);
      estado.imagen = r.id;
      marcarSucio();
      aviso(procesada.fondo === 'recorte' ? 'Foto lista: se quitó el fondo blanco' : 'Foto lista');
    } catch (e) {
      avisoError(e);
      pintarFoto();
    }
  }

  async function traerDeLink(url) {
    const blob = await api(`/proxy-imagen?url=${encodeURIComponent(url)}`);
    await usarFoto(blob);
  }

  function datos() {
    const f = form.elements;
    const presentaciones = [...form.querySelectorAll('[data-tamano]')].map((fila) => {
      const v = (n) => fila.querySelector(`[name=${n}]`).value.trim();
      return { ml: Number(v('ml')) || 0, precio: v('precio'), precioAnterior: v('precioAnterior') || null, costo: v('costo') === '' ? null : v('costo'), stock: v('stock') === '' ? null : v('stock') };
    });
    const acordes = [...form.querySelectorAll('[data-acorde]')]
      .map((a) => ({ nombre: a.querySelector('[name=acorde]').value.trim(), intensidad: Number(a.querySelector('[name=intensidad]').value) }))
      .filter((a) => a.nombre);
    return {
      marca: f.marca.value,
      nombre: f.nombre.value,
      concentracion: f.concentracion.value,
      tipo: f.tipo.value,
      genero: f.genero.value,
      familia: f.familia.value,
      perfil: f.perfil.value,
      descripcion: f.descripcion.value,
      notas: { salida: separar(f.salida.value), corazon: separar(f.corazon.value), fondo: separar(f.fondo.value), destacadas: separar(f.destacadas.value) },
      acordes,
      estaciones: [...form.querySelectorAll('[name=estaciones]:checked')].map((x) => x.value),
      ocasiones: [...form.querySelectorAll('[name=ocasiones]:checked')].map((x) => x.value),
      presentaciones,
      imagen: estado.imagen,
      imagen_fondo: estado.fondo,
      imagenes: estado.imagenes,
      modelo3d: f.modelo3d.value.trim(),
      frasco: p.frasco || null,
      destacado: f.destacado.checked,
      visible: f.visible.checked,
      orden: p.orden || 0,
      fuente: f.fuente.value.trim(),
      pagina_catalogo: p.pagina_catalogo || '',
      revisar: f.revisado?.checked ? '' : p.revisar || '',
    };
  }

  /* Eventos */

  form.addEventListener('input', (e) => {
    marcarSucio();
    if (e.target.closest('[data-tamano]')) pintarMargenes();
    if (['marca', 'nombre'].includes(e.target.name)) {
      form.querySelector('[data-buscar-fragrantica]').href = `https://www.google.com/search?q=${encodeURIComponent(`fragrantica ${form.elements.marca.value} ${form.elements.nombre.value}`)}`;
    }
  });
  form.addEventListener('change', marcarSucio);

  form.querySelector('[data-archivo]').addEventListener('change', (e) => {
    if (e.target.files[0]) usarFoto(e.target.files[0]);
    e.target.value = '';
  });
  form.querySelector('[data-link]').addEventListener('click', () => {
    const h = hoja({
      titulo: 'Foto desde un link',
      ancho: 520,
      html: `<p class="campo__ayuda">Buscá el perfume en Google Imágenes o en la web de la marca, abrí la imagen más grande, tocá y mantené (o clic derecho) → <em>Copiar dirección de imagen</em>, y pegala acá.</p>
             <label class="campo"><span>Link de la imagen</span><input type="url" inputmode="url" placeholder="https://…" data-url autocomplete="off"></label>
             <p class="campo__error" data-error></p>`,
      pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-traer>Usar esta imagen</button>',
    });
    const input = h.dialogo.querySelector('[data-url]');
    setTimeout(() => input.focus(), 60);
    h.dialogo.querySelector('[data-traer]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
      try {
        await traerDeLink(input.value.trim());
        h.cerrar();
      } catch (err) {
        h.dialogo.querySelector('[data-error]').textContent = err.message;
      }
    }));
  });
  form.querySelector('[data-quitar-foto]').addEventListener('click', () => {
    if (!estado.imagen) return;
    estado.fotosViejas.add(estado.imagen);
    estado.imagen = null;
    estado.fondo = '';
    pintarFoto();
    marcarSucio();
  });

  form.querySelector('[data-archivos-360]').addEventListener('change', async (e) => {
    const archivos = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    e.target.value = '';
    if (!archivos.length) return;
    const progreso = form.querySelector('[data-progreso-360]');
    const recortar = form.querySelector('[data-recortar]').checked;
    const ids = [];
    try {
      for (const [i, archivo] of archivos.entries()) {
        progreso.textContent = `Procesando ${i + 1} de ${archivos.length}…`;
        const r = await subirImagen(await procesarFoto(archivo, { quitarFondo: recortar, maximo: 900 }));
        ids.push(r.id);
      }
      estado.imagenes.forEach((id) => estado.fotosViejas.add(id));
      estado.imagenes = ids;
      pintar360();
      marcarSucio();
      progreso.textContent = `${ids.length} fotos listas. Guardá para publicarlas.`;
    } catch (err) {
      progreso.textContent = '';
      avisoError(err);
    }
  });
  form.querySelector('[data-borrar-360]').addEventListener('click', () => {
    estado.imagenes.forEach((id) => estado.fotosViejas.add(id));
    estado.imagenes = [];
    pintar360();
    marcarSucio();
  });

  form.querySelector('[data-agregar-tamano]').addEventListener('click', () => {
    form.querySelector('[data-tamanos]').insertAdjacentHTML('beforeend', filaTamano({ ml: '', precio: '' }));
    form.querySelector('[data-tamano]:last-child [name=ml]').focus();
    marcarSucio();
  });
  form.querySelector('[data-precio-rapido]')?.addEventListener('click', async () => {
    if (estado.sucio && !(await confirmar('Primero se guardan los cambios que hiciste.', { aceptar: 'Guardar y seguir' }))) return;
    if (estado.sucio) form.requestSubmit();
    if (await dialogoDescuento({ perfume: p, perfumes: cacheLista || undefined })) {
      estado.sucio = false;
      cacheLista = null;
      const actual = await api(`/perfumes/${encodeURIComponent(p.id)}`);
      form.querySelector('[data-tamanos]').innerHTML = actual.presentaciones.map(filaTamano).join('');
      pintarMargenes();
    }
  });
  form.querySelector('[data-agregar-acorde]').addEventListener('click', () => {
    form.querySelector('[data-acordes]').insertAdjacentHTML('beforeend', filaAcorde());
    form.querySelector('[data-acorde]:last-child input').focus();
  });
  form.addEventListener('click', (e) => {
    const qt = e.target.closest('[data-quitar-tamano]');
    if (qt && form.querySelectorAll('[data-tamano]').length > 1) {
      qt.closest('[data-tamano]').remove();
      marcarSucio();
    }
    const qa = e.target.closest('[data-quitar-acorde]');
    if (qa) {
      qa.closest('[data-acorde]').remove();
      marcarSucio();
    }
  });

  form.querySelector('[data-pegar-fragrantica]').addEventListener('click', () => {
    const h = hoja({
      titulo: 'Pegar texto de Fragrantica',
      ancho: 620,
      html: `<p class="campo__ayuda">Abrí el perfume en Fragrantica, seleccioná desde los acordes principales hasta la pirámide de notas, copiá y pegá acá. También sirve el párrafo que dice "Las notas de salida son…".</p>
             <label class="campo"><span>Texto copiado</span><textarea rows="9" data-texto></textarea></label>
             <p class="campo__ayuda" data-resultado></p>`,
      pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-aplicar>Completar</button>',
    });
    h.dialogo.querySelector('[data-aplicar]').addEventListener('click', () => {
      const r = leerTextoFragrantica(h.dialogo.querySelector('[data-texto]').value);
      const total = r.salida.length + r.corazon.length + r.fondo.length + r.acordes.length;
      if (!total) {
        h.dialogo.querySelector('[data-resultado]').textContent = 'No encontramos notas ni acordes en ese texto. Probá copiando la sección de la pirámide.';
        return;
      }
      if (r.salida.length) form.elements.salida.value = lista(r.salida);
      if (r.corazon.length) form.elements.corazon.value = lista(r.corazon);
      if (r.fondo.length) form.elements.fondo.value = lista(r.fondo);
      if (r.acordes.length) form.querySelector('[data-acordes]').innerHTML = r.acordes.map(filaAcorde).join('');
      marcarSucio();
      h.cerrar();
      aviso(`Completamos ${r.salida.length + r.corazon.length + r.fondo.length} notas y ${r.acordes.length} acordes. Revisá y guardá.`);
    });
  });

  const alPegar = (e) => {
    const archivo = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (archivo) {
      e.preventDefault();
      usarFoto(archivo);
    }
  };
  document.addEventListener('paste', alPegar);

  form.querySelector('[data-eliminar]')?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar ${p.marca} ${p.nombre}?`, { aceptar: 'Eliminar', peligro: true, detalle: 'Se borra del catálogo con sus fotos. Los pedidos viejos lo siguen mostrando. Si solo querés que no se vea, ocultalo.' }))) return;
    try {
      await api(`/perfumes/${encodeURIComponent(p.id)}`, { metodo: 'DELETE' });
      cacheLista = null;
      estado.sucio = false;
      aviso('Perfume eliminado');
      app.ir('#/perfumes');
    } catch (err) {
      avisoError(err);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type=submit]');
    conCarga(boton, async () => {
      const d = datos();
      if (!d.marca.trim() || !d.nombre.trim()) return aviso('Completá la marca y el nombre.', 'error');
      if (d.presentaciones.some((x) => x.precio === '')) return aviso('Cada tamaño necesita un precio.', 'error');
      try {
        if (esNuevo) {
          const r = await api('/perfumes', { metodo: 'POST', datos: d });
          estado.sucio = false;
          cacheLista = null;
          aviso('Perfume creado');
          app.ir(`#/perfumes/${encodeURIComponent(r.id)}`);
        } else {
          await api(`/perfumes/${encodeURIComponent(p.id)}`, { metodo: 'PUT', datos: d });
          estado.sucio = false;
          cacheLista = null;
          estadoGuardado.textContent = 'Guardado';
          app.titulo(d.nombre, { volver: '#/perfumes' });
          aviso('Cambios guardados');
          // Las fotos reemplazadas se borran si ya nadie las usa.
          for (const id of estado.fotosViejas) api(`/imagenes/${id}`, { metodo: 'DELETE' }).catch(() => {});
          estado.fotosViejas.clear();
        }
      } catch (err) {
        avisoError(err);
      }
      return undefined;
    });
  });

  app.guardia(async () => !estado.sucio || confirmar('Tenés cambios sin guardar. ¿Salir igual?', { aceptar: 'Salir sin guardar', peligro: true }));
  const antesDeSalir = (e) => {
    if (estado.sucio) e.preventDefault();
  };
  window.addEventListener('beforeunload', antesDeSalir);

  pintarFoto();
  pintar360();
  pintarMargenes();

  return () => {
    document.removeEventListener('paste', alPegar);
    window.removeEventListener('beforeunload', antesDeSalir);
  };
}
