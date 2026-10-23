// Fotos en lote: se elige una carpeta con fotos que se llaman como el id del perfume
// (ej. "afnan-9pm-eau-de-parfum.webp"), se revisa qué cambia y se suben todas juntas.
import { api, subirImagen } from '../api.js';
import { slug } from '../excel.js';
import { procesarFoto } from '../fotos.js';
import { icono, escapar, aviso, avisoError, confirmar, urlFotoChica } from '../ui.js';

const EN_PARALELO = 3;
const MAXIMO_DIRECTO = 1_700_000; // por debajo de esto y ya recortada, la foto se sube tal cual
const LADO_DIRECTO = 1600;
const LADO_MINI = 560;
const VISTA_PREVIA = 48;
const ES_FOTO = /\.(webp|png|jpe?g)$/i;

async function enParalelo(items, limite, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function huellaDe(archivo) {
  const hash = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

const idDeHuella = (huella) => `h-${huella.slice(0, 24)}`;

// Lee una carpeta soltada (con subcarpetas) usando la API de entradas del navegador.
async function archivosSoltados(transferencia) {
  const entradas = [...transferencia.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entradas.length) return [...transferencia.files];
  const archivos = [];
  const leer = async (entrada, ruta) => {
    if (entrada.isFile) {
      const f = await new Promise((res, rej) => entrada.file(res, rej));
      Object.defineProperty(f, 'rutaRelativa', { value: `${ruta}${f.name}` });
      archivos.push(f);
    } else if (entrada.isDirectory) {
      const lector = entrada.createReader();
      for (;;) {
        const tanda = await new Promise((res, rej) => lector.readEntries(res, rej));
        if (!tanda.length) break;
        for (const e of tanda) await leer(e, `${ruta}${entrada.name}/`);
      }
    }
  };
  for (const e of entradas) await leer(e, '');
  return archivos;
}

const rutaDe = (f) => f.rutaRelativa || f.webkitRelativePath || f.name;

// Si se eligió la carpeta PERFUMES entera, se usan solo las fotos de para_la_web.
function elegirFotos(archivos) {
  const fotos = archivos.filter((f) => ES_FOTO.test(f.name));
  const preparadas = fotos.filter((f) => /(^|\/)para_la_web\//i.test(rutaDe(f)));
  return { fotos: preparadas.length ? preparadas : fotos, ignorados: archivos.length - (preparadas.length || fotos.length) };
}

// Las fotos que ya vienen recortadas y livianas se suben sin volver a comprimirlas.
async function prepararFoto(archivo) {
  if (archivo.size <= MAXIMO_DIRECTO && /^image\/(webp|png)$/.test(archivo.type)) {
    const bmp = await createImageBitmap(archivo);
    const { width: ancho, height: alto } = bmp;
    if (Math.max(ancho, alto) <= LADO_DIRECTO) {
      const c = new OffscreenCanvas(48, 48);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, 48, 48);
      bmp.close?.();
      const d = ctx.getImageData(0, 0, 48, 48).data;
      let transparentes = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 200) transparentes++;
      return { blob: archivo, tipo: archivo.type, fondo: transparentes > 48 ? 'recorte' : 'foto', ancho, alto };
    }
    bmp.close?.();
  }
  return procesarFoto(archivo, { quitarFondo: true, maximo: 1100 });
}

// Copia chica para tarjetas, bolsa y miniaturas: alcanza para pantallas de alta densidad sin pesar de más.
async function crearMini(preparada) {
  const bmp = await createImageBitmap(preparada.blob);
  const escala = Math.min(1, LADO_MINI / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * escala));
  c.height = Math.max(1, Math.round(bmp.height * escala));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  let blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return { blob, tipo: blob.type, fondo: preparada.fondo, ancho: c.width, alto: c.height };
}

export async function montar({ vista, app }) {
  app.titulo('Fotos en lote', { volver: '#/importar' });
  let subiendo = false;
  let urls = [];
  const liberarUrls = () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  };

  function inicio() {
    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Subir muchas fotos de una vez</h2>
        <ol class="pasos-import">
          <li>Elegí la carpeta <strong>para_la_web</strong> (está dentro de PERFUMES). Cada foto se llama como el perfume, así se acomoda sola.</li>
          <li>Revisá el antes y el después. Todavía no se guarda nada.</li>
          <li>Confirmá: se suben y reemplazan las fotos. Las viejas que quedan sin uso se borran solas.</li>
        </ol>
      </section>
      <label class="zona-archivo" data-zona>
        ${icono('imagen')}
        <strong>Elegí o arrastrá la carpeta</strong>
        <small>Conviene hacerlo desde la compu · WebP, PNG o JPG</small>
        <input type="file" webkitdirectory multiple hidden data-carpeta>
      </label>
      <p class="campo__ayuda" style="margin-top:10px;text-align:center">
        ¿Pocas fotos o desde el celular? <label class="enlace-suelto">Elegí archivos sueltos<input type="file" accept="image/webp,image/png,image/jpeg" multiple hidden data-sueltos></label>
      </p>`;
    const zona = vista.querySelector('[data-zona]');
    for (const input of vista.querySelectorAll('[data-carpeta], [data-sueltos]')) {
      input.addEventListener('change', () => input.files.length && analizar([...input.files]));
    }
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('es-arrastrando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('es-arrastrando'));
    zona.addEventListener('drop', async (e) => {
      e.preventDefault();
      zona.classList.remove('es-arrastrando');
      try {
        analizar(await archivosSoltados(e.dataTransfer));
      } catch (err) {
        avisoError(err);
      }
    });
  }

  async function analizar(archivos) {
    const { fotos, ignorados } = elegirFotos(archivos);
    if (!fotos.length) {
      aviso('No hay fotos en lo que elegiste (WebP, PNG o JPG).', 'error');
      return;
    }
    vista.innerHTML = `<div class="vacio-admin"><div class="cargando"><span></span><span></span><span></span></div><p>Revisando ${fotos.length} fotos…</p></div>`;
    try {
      const perfumes = await api('/perfumes');
      const porId = new Map(perfumes.map((p) => [p.id, p]));
      const usados = new Set();
      const cruces = [];
      const sueltas = [];
      for (const archivo of fotos) {
        const nombre = archivo.name.replace(/\.[^.]+$/, '');
        const id = porId.has(nombre.toLowerCase()) ? nombre.toLowerCase() : slug(nombre);
        const perfume = porId.get(id);
        if (!perfume || usados.has(id)) sueltas.push(archivo);
        else {
          usados.add(id);
          cruces.push({ archivo, perfume, estado: perfume.imagen ? 'reemplaza' : 'nueva' });
        }
      }
      cruces.sort((a, b) => `${a.perfume.marca} ${a.perfume.nombre}`.localeCompare(`${b.perfume.marca} ${b.perfume.nombre}`, 'es'));
      const sinFotoNueva = perfumes.filter((p) => !usados.has(p.id));
      revisar({ cruces, sueltas, ignorados, sinFotoNueva });
    } catch (e) {
      avisoError(e);
      inicio();
    }
  }

  function revisar(ctx) {
    const { cruces, sueltas, ignorados, sinFotoNueva } = ctx;
    const nuevas = cruces.filter((c) => c.estado === 'nueva').length;
    const reemplazos = cruces.length - nuevas;
    let filtro = 'todas';
    const sinNada = sinFotoNueva.filter((p) => !p.imagen);

    vista.innerHTML = `
      <div class="cifras">
        <div class="cifra"><span class="cifra__rotulo">Fotos elegidas</span><span class="cifra__valor num">${cruces.length + sueltas.length}</span><span class="cifra__nota">${ignorados ? `${ignorados} otros archivos ignorados` : 'Todas son imágenes'}</span></div>
        <div class="cifra cifra--positiva"><span class="cifra__rotulo">Coinciden</span><span class="cifra__valor num">${cruces.length}</span><span class="cifra__nota">Con un perfume del catálogo</span></div>
        <div class="cifra"><span class="cifra__rotulo">Reemplazan</span><span class="cifra__valor num">${reemplazos}</span><span class="cifra__nota">${nuevas} perfumes sin foto hoy</span></div>
        <div class="cifra ${sueltas.length ? 'cifra--negativa' : ''}"><span class="cifra__rotulo">Sin perfume</span><span class="cifra__valor num">${sueltas.length}</span><span class="cifra__nota">El nombre no coincide</span></div>
      </div>

      ${sueltas.length > cruces.length ? `<p class="aviso-lote">${icono('alerta')}<span>La mayoría de los nombres no coincide con ningún perfume. ¿Elegiste la carpeta <strong>para_la_web</strong>?</span></p>` : ''}

      <div class="grilla-admin grilla-admin--2" style="margin-top:12px">
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Opciones</h2>
          <label class="campo"><span>Qué subir</span>
            <select data-op="modo">
              <option value="todas">Todas: reemplazar las fotos actuales (${cruces.length})</option>
              <option value="faltantes">Solo a los que no tienen foto (${nuevas})</option>
            </select>
          </label>
          <p class="campo__ayuda">Si se corta a mitad de camino, volvé a elegir la misma carpeta: las que ya subieron se saltean solas.</p>
        </section>
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Quedan sin foto nueva</h2>
          <p class="campo__ayuda">${sinFotoNueva.length} perfumes no tienen foto en esta carpeta${sinNada.length ? `; ${sinNada.length} de ellos no tienen ninguna foto` : ''}. Siguen como están.</p>
          ${sinFotoNueva.length ? `<details style="margin-top:8px"><summary class="campo__ayuda" style="cursor:pointer">Ver cuáles</summary>
            <ul class="avisos-import avisos-import--neutro" style="margin-top:8px">${sinFotoNueva.map((p) => `<li><a href="#/perfumes/${encodeURIComponent(p.id)}">${escapar(p.marca)} ${escapar(p.nombre)}</a>${p.imagen ? '' : ' · sin foto'}</li>`).join('')}</ul>
          </details>` : ''}
        </section>
      </div>

      ${sueltas.length ? `
        <details class="tarjeta-admin" style="margin-top:12px">
          <summary class="tarjeta-admin__titulo" style="margin:0">${icono('alerta')} ${sueltas.length === 1 ? '1 foto sin perfume' : `${sueltas.length} fotos sin perfume`} ${icono('abajo')}</summary>
          <p class="campo__ayuda" style="margin-top:8px">Para que coincidan, el archivo se tiene que llamar como el perfume en el link de la tienda (lo que va después de /perfume/).</p>
          <ul class="avisos-import" style="margin-top:8px">${sueltas.slice(0, 200).map((f) => `<li>${escapar(f.name)}</li>`).join('')}</ul>
        </details>` : ''}

      <section class="tarjeta-admin" style="margin-top:12px">
        <h2 class="tarjeta-admin__titulo">Antes y después</h2>
        <div class="chips-admin" data-filtros style="margin-bottom:12px"></div>
        <div class="comparar-fotos" data-grilla></div>
        <p class="campo__ayuda" data-mas style="margin-top:10px"></p>
      </section>

      <div class="barra-guardar">
        <button class="boton boton--contorno" type="button" data-otra>Elegir otra carpeta</button>
        <button class="boton boton--lleno" type="button" data-subir ${cruces.length ? '' : 'disabled'}>Subir ${cruces.length} fotos</button>
      </div>
      <div style="height:80px"></div>`;

    const boton = vista.querySelector('[data-subir]');
    const modo = vista.querySelector('[data-op="modo"]');
    const elegidas = () => (modo.value === 'faltantes' ? cruces.filter((c) => c.estado === 'nueva') : cruces);
    modo.addEventListener('change', () => {
      const n = elegidas().length;
      boton.textContent = `Subir ${n} fotos`;
      boton.disabled = !n;
    });

    const FILTROS = [['todas', 'Todas', cruces.length], ['reemplaza', 'Reemplazan', reemplazos], ['nueva', 'Sin foto hoy', nuevas]];
    function pintar() {
      liberarUrls();
      const lista = filtro === 'todas' ? cruces : cruces.filter((c) => c.estado === filtro);
      vista.querySelector('[data-filtros]').innerHTML = FILTROS.filter(([k, , n]) => n || k === 'todas')
        .map(([k, t, n]) => `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${t}<span>${n}</span></button>`).join('');
      vista.querySelector('[data-grilla]').innerHTML = lista.slice(0, VISTA_PREVIA).map(({ archivo, perfume }) => {
        const u = URL.createObjectURL(archivo);
        urls.push(u);
        const antes = perfume.imagen
          ? `<img src="${urlFotoChica(perfume.imagen)}" alt="" loading="lazy" decoding="async">`
          : '<span class="comparar-fotos__vacio">Sin foto</span>';
        return `<figure class="comparar-fotos__item">
          <div class="comparar-fotos__par">
            <div class="comparar-fotos__lado" data-rotulo="Antes">${antes}</div>
            <div class="comparar-fotos__lado comparar-fotos__lado--nueva" data-rotulo="Ahora"><img src="${u}" alt="" loading="lazy" decoding="async"></div>
          </div>
          <figcaption><strong>${escapar(perfume.nombre)}</strong><span>${escapar(perfume.marca)}</span></figcaption>
        </figure>`;
      }).join('');
      vista.querySelector('[data-mas]').textContent = lista.length > VISTA_PREVIA ? `Se muestran ${VISTA_PREVIA} de ${lista.length}.` : '';
    }
    vista.querySelector('[data-filtros]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filtro]');
      if (!b) return;
      filtro = b.dataset.filtro;
      pintar();
    });
    vista.querySelector('[data-otra]').addEventListener('click', () => { liberarUrls(); inicio(); });
    boton.addEventListener('click', async () => {
      const lista = elegidas();
      if (modo.value === 'todas' && reemplazos && !(await confirmar(`Se van a reemplazar ${reemplazos} fotos que hoy están en la tienda.`, { aceptar: `Subir ${lista.length} fotos` }))) return;
      liberarUrls();
      subir(lista);
    });
    pintar();
  }

  async function subir(lista) {
    subiendo = true;
    const errores = [];
    let subidas = 0;
    let yaEstaban = 0;
    let hechas = 0;
    let cortado = false;
    let candado = null;
    try { candado = await navigator.wakeLock?.request('screen'); } catch { /* el navegador no lo permite */ }
    const antesDeSalir = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', antesDeSalir);
    app.guardia(async () => !subiendo || confirmar('Las fotos se siguen subiendo. Si salís, se corta (lo ya subido queda guardado).', { aceptar: 'Salir igual', peligro: true }));

    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Subiendo fotos</h2>
        <div class="progreso">
          <div class="progreso__barra"><span data-barra></span></div>
          <div class="progreso__texto"><span data-fase>Preparando…</span><span data-cuenta>0 / ${lista.length}</span></div>
        </div>
        <p class="campo__ayuda" style="margin-top:10px">No cierres esta pestaña. Si se corta, volvé a elegir la misma carpeta: sigue desde donde quedó.</p>
      </section>`;
    const barra = vista.querySelector('[data-barra]');
    const fase = vista.querySelector('[data-fase]');
    const cuenta = vista.querySelector('[data-cuenta]');

    await enParalelo(lista, EN_PARALELO, async ({ archivo, perfume }) => {
      if (cortado) return;
      const nombre = `${perfume.marca} ${perfume.nombre}`;
      try {
        const huella = await huellaDe(archivo);
        if (perfume.imagen === idDeHuella(huella)) {
          yaEstaban++;
        } else {
          fase.textContent = nombre;
          const preparada = await prepararFoto(archivo);
          const mini = await crearMini(preparada);
          for (let intento = 1; ; intento++) {
            try {
              const r = await subirImagen(preparada, huella);
              await subirImagen(mini, huella, { mini: true });
              await api(`/perfumes/${encodeURIComponent(perfume.id)}`, { metodo: 'PATCH', datos: { imagen: r.id } });
              break;
            } catch (e) {
              if (e.estado === 401 || (e.estado >= 400 && e.estado < 500 && e.estado !== 429) || intento >= 3) throw e;
              await new Promise((res) => setTimeout(res, 1500 * intento));
            }
          }
          subidas++;
        }
      } catch (e) {
        if (e.estado === 401) cortado = true;
        errores.push(`${nombre}: ${e.message}`);
      }
      hechas++;
      barra.style.transform = `scaleX(${hechas / lista.length})`;
      cuenta.textContent = `${hechas} / ${lista.length}`;
    });

    let borradas = 0;
    if (!cortado && subidas) {
      fase.textContent = 'Borrando las fotos viejas que quedaron sin uso…';
      try {
        borradas = (await api('/imagenes/limpiar', { metodo: 'POST' })).borradas;
      } catch (e) {
        errores.push(`Limpieza de fotos viejas: ${e.message}`);
      }
    }

    subiendo = false;
    window.removeEventListener('beforeunload', antesDeSalir);
    candado?.release?.();

    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">${errores.length ? 'Terminó con avisos' : 'Fotos subidas'}</h2>
        <div class="cifras">
          <div class="cifra cifra--positiva"><span class="cifra__rotulo">Subidas</span><span class="cifra__valor num">${subidas}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Ya estaban</span><span class="cifra__valor num">${yaEstaban}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Viejas borradas</span><span class="cifra__valor num">${borradas}</span></div>
          <div class="cifra ${errores.length ? 'cifra--negativa' : ''}"><span class="cifra__rotulo">Errores</span><span class="cifra__valor num">${errores.length}</span></div>
        </div>
        ${errores.length ? `<ul class="avisos-import" style="margin-top:12px">${errores.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul><p class="campo__ayuda" style="margin-top:8px">Volvé a elegir la misma carpeta para completar lo que faltó.</p>` : ''}
        <div class="botonera" style="margin-top:14px">
          <a class="boton boton--lleno" href="/catalogo" target="_blank" rel="noopener">Ver la tienda</a>
          <a class="boton boton--contorno" href="#/perfumes">Ver perfumes</a>
        </div>
      </section>`;
    aviso(errores.length ? 'Terminó con avisos' : `${subidas} fotos subidas`, errores.length ? 'error' : 'ok');
  }

  inicio();
  return () => liberarUrls();
}
