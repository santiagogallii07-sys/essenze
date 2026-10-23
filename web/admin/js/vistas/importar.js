// Importar el Excel del catálogo: se lee en el navegador, se muestra qué cambia y se sube en tandas.
import { api, subirImagen } from '../api.js';
import { leerLibro, convertir } from '../excel.js';
import { procesarFoto } from '../fotos.js';
import { icono, escapar, usd, ars, aviso, avisoError, confirmar, TIPOS } from '../ui.js';

const EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const TANDA = 25;
const FOTOS_EN_PARALELO = 4;

function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = EXCELJS;
    s.onload = () => resolve(window.ExcelJS);
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá la conexión.'));
    document.head.append(s);
  });
}

function compararPrecios(nuevo, actual) {
  if (!actual) return 'nuevo';
  // Con descuento activo, el precio "de lista" es el tachado.
  const cambia = nuevo.presentaciones.some((n) => {
    const a = actual.presentaciones.find((x) => x.ml === n.ml);
    return !a || Number(a.precioAnterior || a.precio) !== Number(n.precio);
  });
  return cambia ? 'precio' : 'igual';
}

async function enParalelo(items, limite, fn) {
  let i = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const actual = items[i++];
      await fn(actual);
    }
  });
  await Promise.all(trabajadores);
}

export async function montar({ vista, app }) {
  app.titulo('Importar Excel');
  let importando = false;
  let urls = [];

  const liberarUrls = () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  };

  function inicio() {
    vista.innerHTML = `
      <a class="tarjeta-admin acceso-lote" href="#/importar/fotos">
        ${icono('imagen')}
        <span class="acceso-lote__texto"><strong>Fotos en lote</strong><small>Subí una carpeta entera de fotos: cada una va sola a su perfume.</small></span>
        ${icono('chevron')}
      </a>
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Cargar el catálogo desde Excel</h2>
        <ol class="pasos-import">
          <li>Elegí el archivo .xlsx del catálogo (una hoja por tipo: Diseñador, Árabes, Nicho…).</li>
          <li>Revisá qué perfumes son nuevos y cuáles cambian de precio. Todavía no se guarda nada.</li>
          <li>Confirmá: se suben los perfumes con sus fotos. Podés volver a importar cuando actualices precios.</li>
        </ol>
      </section>
      <label class="zona-archivo" data-zona>
        ${icono('tabla')}
        <strong>Elegí o arrastrá el Excel</strong>
        <small>Archivo .xlsx · conviene hacerlo desde la compu</small>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden data-archivo>
      </label>
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Qué hace con cada columna</h2>
        <ul class="lista-admin">
          <li class="fila-admin"><span class="fila-admin__texto">Hoja (Diseñador Masculino, Árabes Femeninos, Nicho…)</span><span class="fila-admin__valor">Tipo y género</span></li>
          <li class="fila-admin"><span class="fila-admin__texto">Perfume ("BLACK SEDUCTION EDT 100ML")</span><span class="fila-admin__valor">Nombre, concentración y ml</span></li>
          <li class="fila-admin"><span class="fila-admin__texto">Precio USD</span><span class="fila-admin__valor">Precio del tamaño</span></li>
          <li class="fila-admin"><span class="fila-admin__texto">Perfil aromático</span><span class="fila-admin__valor">Familia y acordes</span></li>
          <li class="fila-admin"><span class="fila-admin__texto">Notas destacadas</span><span class="fila-admin__valor">Notas</span></li>
          <li class="fila-admin"><span class="fila-admin__texto">Foto</span><span class="fila-admin__valor">Foto (fondo blanco quitado)</span></li>
        </ul>
        <p class="campo__ayuda" style="margin-top:10px">El mismo perfume en varias filas con distinto tamaño se agrupa en uno solo. Lo que edites a mano en el panel (descripción, stock, costos) no se pisa al reimportar.</p>
      </section>`;
    const zona = vista.querySelector('[data-zona]');
    const input = vista.querySelector('[data-archivo]');
    input.addEventListener('change', () => input.files[0] && analizar(input.files[0]));
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('es-arrastrando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('es-arrastrando'));
    zona.addEventListener('drop', (e) => {
      e.preventDefault();
      zona.classList.remove('es-arrastrando');
      const f = e.dataTransfer.files[0];
      if (f) analizar(f);
    });
  }

  async function analizar(archivo) {
    if (!/\.xlsx$/i.test(archivo.name)) {
      aviso('Tiene que ser un archivo .xlsx', 'error');
      return;
    }
    vista.innerHTML = `<div class="vacio-admin"><div class="cargando"><span></span><span></span><span></span></div><p>Leyendo ${escapar(archivo.name)}…</p><p class="vacio-admin__detalle">Con muchas fotos puede tardar unos segundos.</p></div>`;
    try {
      const [ExcelJS, existentes, ajustes] = await Promise.all([cargarExcelJS(), api('/perfumes'), api('/ajustes')]);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());
      const leido = leerLibro(libro);
      if (!leido.filas.length) throw new Error('No encontramos perfumes en el Excel. Revisá que tenga las columnas MARCA, PERFUME y PRECIO USD.');
      const { perfumes, avisos } = convertir(leido.filas);
      const porId = new Map(existentes.map((p) => [p.id, p]));
      for (const p of perfumes) p._estado = p.revisar ? 'revisar' : compararPrecios(p, porId.get(p.id));
      const ids = new Set(perfumes.map((p) => p.id));
      const ausentes = existentes.filter((p) => p.visible && !ids.has(p.id));
      revisar({ archivo, leido, perfumes, avisos, porId, ausentes, ajustes });
    } catch (e) {
      avisoError(e);
      inicio();
    }
  }

  function revisar(ctx) {
    const { leido, perfumes, avisos, porId, ausentes, ajustes } = ctx;
    const cuenta = (k) => perfumes.filter((p) => p._estado === k).length;
    const porTipo = Object.entries(TIPOS).map(([k, v]) => [v, perfumes.filter((p) => p.tipo === k).length]).filter(([, n]) => n);
    const conFoto = perfumes.filter((p) => p._foto).length;
    const sinFotoEnBase = perfumes.filter((p) => p._foto && !porId.get(p.id)?.imagen).length;
    let filtro = 'todos';

    vista.innerHTML = `
      <div class="cifras">
        <div class="cifra"><span class="cifra__rotulo">En el Excel</span><span class="cifra__valor num">${perfumes.length}</span><span class="cifra__nota">${leido.filas.length} filas · ${conFoto} con foto</span></div>
        <div class="cifra cifra--positiva"><span class="cifra__rotulo">Nuevos</span><span class="cifra__valor num">${cuenta('nuevo')}</span><span class="cifra__nota">Se agregan</span></div>
        <div class="cifra"><span class="cifra__rotulo">Cambian de precio</span><span class="cifra__valor num">${cuenta('precio')}</span><span class="cifra__nota">${cuenta('igual')} sin cambios</span></div>
        <div class="cifra ${cuenta('revisar') ? 'cifra--negativa' : ''}"><span class="cifra__rotulo">Para revisar</span><span class="cifra__valor num">${cuenta('revisar')}</span><span class="cifra__nota">Duplicados o sin precio</span></div>
      </div>

      <div class="grilla-admin grilla-admin--2" style="margin-top:12px">
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Opciones</h2>
          <label class="campo"><span>Fotos</span>
            <select data-op="fotos">
              <option value="faltantes">Subir solo a los que no tienen foto (${sinFotoEnBase})</option>
              <option value="todas">Reemplazar todas por las del Excel (${conFoto}) · pisa las fotos buenas</option>
              <option value="ninguna">No subir fotos</option>
            </select>
          </label>
          <label class="interruptor"><span class="interruptor__texto">Quitar fondo blanco de las fotos<small>Los frascos quedan sobre el escenario oscuro de la tienda</small></span><input type="checkbox" data-op="recortar" checked><span class="interruptor__pista"></span></label>
          <label class="interruptor"><span class="interruptor__texto">Pisar textos editados a mano<small>Nombre, perfil, acordes y notas vuelven a lo del Excel</small></span><input type="checkbox" data-op="pisarTextos"><span class="interruptor__pista"></span></label>
          ${ausentes.length ? `<label class="interruptor"><span class="interruptor__texto">Ocultar los ${ausentes.length} que no están en este Excel<small>No se borran: quedan ocultos y marcados para revisar</small></span><input type="checkbox" data-op="ocultar"><span class="interruptor__pista"></span></label>` : ''}
          ${leido.cotizacion && leido.cotizacion !== ajustes.cotizacion ? `<label class="interruptor"><span class="interruptor__texto">Actualizar el dólar a ${ars(leido.cotizacion)}<small>Hoy está en ${ars(ajustes.cotizacion)}</small></span><input type="checkbox" data-op="cotizacion" checked><span class="interruptor__pista"></span></label>` : ''}
        </section>
        <section class="tarjeta-admin">
          <h2 class="tarjeta-admin__titulo">Por tipo</h2>
          <ul class="lista-admin">${porTipo.map(([t, n]) => `<li class="fila-admin"><span class="fila-admin__texto">${t}</span><span class="fila-admin__valor num">${n}</span></li>`).join('')}</ul>
          ${leido.hojasIgnoradas.length ? `<p class="campo__ayuda" style="margin-top:8px">Hojas que no son de perfumes (se ignoran): ${leido.hojasIgnoradas.map(escapar).join(', ')}</p>` : ''}
        </section>
      </div>

      ${avisos.length ? `
        <details class="tarjeta-admin" style="margin-top:12px">
          <summary class="tarjeta-admin__titulo" style="margin:0">${icono('alerta')} ${avisos.length} avisos del Excel ${icono('abajo')}</summary>
          <ul class="avisos-import" style="margin-top:10px">${avisos.map((a) => `<li>${escapar(a)}</li>`).join('')}</ul>
        </details>` : ''}

      <section class="tarjeta-admin" style="margin-top:12px">
        <h2 class="tarjeta-admin__titulo">Vista previa</h2>
        <div class="chips-admin" data-filtros style="margin-bottom:10px"></div>
        <div class="contenedor-tabla"><table class="tabla-previa"><thead><tr><th></th><th>Perfume</th><th>Tipo</th><th class="num">Precio</th><th></th></tr></thead><tbody data-filas></tbody></table></div>
        <p class="campo__ayuda" data-mas-filas style="margin-top:8px"></p>
      </section>

      <div class="barra-guardar">
        <button class="boton boton--contorno" type="button" data-otro>Elegir otro archivo</button>
        <button class="boton boton--lleno" type="button" data-importar>Importar ${perfumes.length} perfumes</button>
      </div>
      <div style="height:80px"></div>`;

    const ETIQUETAS = { nuevo: 'Nuevo', precio: 'Cambia precio', igual: 'Sin cambios', revisar: 'Revisar' };
    function pintarTabla() {
      liberarUrls();
      const lista = filtro === 'todos' ? perfumes : perfumes.filter((p) => p._estado === filtro);
      vista.querySelector('[data-filtros]').innerHTML = [['todos', 'Todos', perfumes.length], ...Object.entries(ETIQUETAS).map(([k, v]) => [k, v, cuenta(k)])]
        .filter(([k, , n]) => n || k === 'todos')
        .map(([k, v, n]) => `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${v}<span>${n}</span></button>`).join('');
      vista.querySelector('[data-filas]').innerHTML = lista.slice(0, 60).map((p) => {
        let img = '';
        if (p._foto) {
          const u = URL.createObjectURL(new Blob([p._foto.datos], { type: `image/${p._foto.extension}` }));
          urls.push(u);
          img = `<img src="${u}" alt="" loading="lazy">`;
        }
        const actual = porId.get(p.id);
        const precios = p.presentaciones.map((x) => {
          const antes = actual?.presentaciones.find((a) => a.ml === x.ml);
          const cambio = antes && antes.precio !== x.precio ? `<s>${usd(antes.precio)}</s> ` : '';
          return `${x.ml ? `${x.ml} ml ` : ''}${cambio}${usd(x.precio)}`;
        }).join('<br>');
        return `<tr>
          <td>${img}</td>
          <td><strong style="font-weight:400">${escapar(p.nombre)}</strong><br><span class="cifra__nota">${escapar(p.marca)}${p.concentracion ? ` · ${escapar(p.concentracion)}` : ''}</span>${p.revisar ? `<br><span class="marca-revisar">${escapar(p.revisar)}</span>` : ''}</td>
          <td class="cifra__nota">${TIPOS[p.tipo]}</td>
          <td class="num">${precios}</td>
          <td><span class="etiqueta-cambio etiqueta-cambio--${p._estado}">${ETIQUETAS[p._estado]}</span></td>
        </tr>`;
      }).join('');
      vista.querySelector('[data-mas-filas]').textContent = lista.length > 60 ? `Se muestran 60 de ${lista.length}.` : '';
    }
    vista.querySelector('[data-filtros]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filtro]');
      if (!b) return;
      filtro = b.dataset.filtro;
      pintarTabla();
    });
    vista.querySelector('[data-otro]').addEventListener('click', () => { liberarUrls(); inicio(); });
    vista.querySelector('[data-importar]').addEventListener('click', async () => {
      const op = (k) => vista.querySelector(`[data-op="${k}"]`);
      const opciones = {
        fotos: op('fotos').value,
        recortar: op('recortar').checked,
        pisarTextos: op('pisarTextos').checked,
        ocultar: op('ocultar')?.checked || false,
        cotizacion: op('cotizacion')?.checked ? leido.cotizacion : 0,
      };
      if (opciones.ocultar && !(await confirmar(`Se van a ocultar ${ausentes.length} perfumes que no están en este Excel.`, { aceptar: 'Importar y ocultar' }))) return;
      liberarUrls();
      importar(ctx, opciones);
    });
    pintarTabla();
  }

  async function importar({ perfumes, porId, ajustes }, op) {
    importando = true;
    const errores = [];
    let fotosSubidas = 0;
    let nuevos = 0;
    let actualizados = 0;
    let candado = null;
    try { candado = await navigator.wakeLock?.request('screen'); } catch { /* el navegador no lo permite */ }
    const antesDeSalir = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', antesDeSalir);
    app.guardia(async () => !importando || confirmar('La importación sigue en curso. Si salís, se corta (lo ya subido queda guardado).', { aceptar: 'Salir igual', peligro: true }));

    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">Importando</h2>
        <div class="progreso">
          <div class="progreso__barra"><span data-barra></span></div>
          <div class="progreso__texto"><span data-fase>Preparando…</span><span data-cuenta>0 / ${perfumes.length}</span></div>
        </div>
        <p class="campo__ayuda" style="margin-top:10px">No cierres esta pestaña. Si se corta, volvé a importar el mismo Excel: sigue desde donde quedó sin duplicar nada.</p>
      </section>`;
    const barra = vista.querySelector('[data-barra]');
    const fase = vista.querySelector('[data-fase]');
    const cuenta = vista.querySelector('[data-cuenta]');

    const necesitaFoto = (p) => {
      if (op.fotos === 'ninguna' || !p._foto) return false;
      if (op.fotos === 'todas') return true;
      return !porId.get(p.id)?.imagen;
    };

    for (let i = 0; i < perfumes.length; i += TANDA) {
      const tanda = perfumes.slice(i, i + TANDA);
      const conFoto = tanda.filter(necesitaFoto);
      if (conFoto.length) {
        fase.textContent = `Procesando fotos (${fotosSubidas + 1}…)`;
        await enParalelo(conFoto, FOTOS_EN_PARALELO, async (p) => {
          try {
            const blob = new Blob([p._foto.datos], { type: `image/${p._foto.extension}` });
            const procesada = await procesarFoto(blob, { quitarFondo: op.recortar, maximo: 800 });
            const r = await subirImagen(procesada);
            p.imagen = r.id;
            p.imagen_fondo = r.fondo;
            fotosSubidas++;
          } catch (e) {
            errores.push(`Foto de ${p.marca} ${p.nombre}: ${e.message}`);
          }
        });
      }
      fase.textContent = 'Guardando perfumes…';
      const datos = tanda.map(({ _foto, _filas, _estado, ...resto }) => resto);
      let intento = 0;
      for (;;) {
        try {
          const r = await api('/importar', { metodo: 'POST', datos: { perfumes: datos, opciones: { pisarTextos: op.pisarTextos, reemplazarFotos: op.fotos === 'todas' } } });
          nuevos += r.nuevos;
          actualizados += r.actualizados;
          break;
        } catch (e) {
          if (e.estado === 401 || ++intento >= 3) {
            errores.push(`Tanda ${i + 1}–${i + tanda.length}: ${e.message}`);
            break;
          }
          await new Promise((res) => setTimeout(res, 1500 * intento));
        }
      }
      const hecho = Math.min(perfumes.length, i + TANDA);
      barra.style.transform = `scaleX(${hecho / perfumes.length})`;
      cuenta.textContent = `${hecho} / ${perfumes.length}`;
    }

    try {
      if (op.ocultar) {
        fase.textContent = 'Ocultando los que no están en el Excel…';
        await api('/importar', { metodo: 'PUT', datos: { presentes: perfumes.map((p) => p.id) } });
      }
      if (op.cotizacion) await api('/ajustes', { metodo: 'PUT', datos: { ...ajustes, cotizacion: op.cotizacion } });
    } catch (e) {
      errores.push(e.message);
    }

    importando = false;
    window.removeEventListener('beforeunload', antesDeSalir);
    candado?.release?.();

    vista.innerHTML = `
      <section class="tarjeta-admin">
        <h2 class="tarjeta-admin__titulo">${errores.length ? 'Importación terminada con avisos' : 'Importación terminada'}</h2>
        <div class="cifras">
          <div class="cifra cifra--positiva"><span class="cifra__rotulo">Nuevos</span><span class="cifra__valor num">${nuevos}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Actualizados</span><span class="cifra__valor num">${actualizados}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Fotos subidas</span><span class="cifra__valor num">${fotosSubidas}</span></div>
          <div class="cifra ${errores.length ? 'cifra--negativa' : ''}"><span class="cifra__rotulo">Errores</span><span class="cifra__valor num">${errores.length}</span></div>
        </div>
        ${errores.length ? `<ul class="avisos-import" style="margin-top:12px">${errores.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul><p class="campo__ayuda" style="margin-top:8px">Podés volver a importar el mismo archivo: completa lo que faltó.</p>` : ''}
        <div class="botonera" style="margin-top:14px">
          <a class="boton boton--lleno" href="#/perfumes">Ver perfumes</a>
          <a class="boton boton--contorno" href="/catalogo" target="_blank" rel="noopener">Ver la tienda</a>
        </div>
      </section>`;
    aviso(errores.length ? 'Importación terminada con avisos' : 'Catálogo importado', errores.length ? 'error' : 'ok');
  }

  inicio();
  return () => liberarUrls();
}
