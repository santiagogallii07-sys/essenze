// Costos de proveedores: se suben las listas (Word, PDF, Excel o CSV), cada renglón se empareja con su perfume
// y se cargan los costos. Lo que se confirma queda recordado: la próxima lista se reconoce sola.
import { api } from '../api.js';
import { icono, escapar, usd, fechaHora, hoja, confirmar, aviso, avisoError, conCarga, demorar } from '../ui.js';
import { perfumesLivianos, olvidarPerfumes, buscarEn, normalizar } from '../datos.js';
import { leerLista, prepararCatalogo, armarPropuesta } from '../costos.js';

const POR_TANDA = 80;

function elegirPerfume(lista, renglon) {
  const h = hoja({
    titulo: 'Elegir el perfume',
    ancho: 560,
    html: `
      <p class="campo__ayuda">Renglón del proveedor: <strong>${escapar(renglon.descripcion)}</strong> · ${usd(renglon.costo)}</p>
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar marca o nombre" data-q autocomplete="off"></label>
      <div class="resultados-busqueda resultados-costos" data-resultados></div>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button>',
  });
  const d = h.dialogo;
  const entrada = d.querySelector('[data-q]');
  // Se empieza buscando con las primeras palabras del renglón.
  entrada.value = renglon.descripcion.replace(/^P\./i, '').split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  const pintar = () => {
    const r = buscarEn(lista, entrada.value, 12);
    d.querySelector('[data-resultados]').innerHTML = r.length ? r.map((p) => p.presentaciones.map((x) => `
      <button type="button" data-id="${escapar(p.id)}" data-ml="${x.ml}">${escapar(p.marca)} · ${escapar(p.nombre)} · ${x.ml ? `${x.ml} ml` : 'único'}${x.costo ? ` <small>(hoy ${usd(x.costo)})</small>` : ''}</button>`).join('')).join('')
      : '<p class="cifra__nota" style="padding:10px">No hay perfumes con esa búsqueda.</p>';
  };
  entrada.addEventListener('input', demorar(pintar, 150));
  d.querySelector('[data-resultados]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) h.cerrar({ id: b.dataset.id, ml: Number(b.dataset.ml) });
  });
  pintar();
  setTimeout(() => entrada.focus(), 80);
  return h.cerrada;
}

export async function montar({ vista, app }) {
  app.titulo('Costos de proveedores', { volver: '/importar' });
  const [perfumes, guardado] = await Promise.all([perfumesLivianos(), api('/costos')]);
  const catalogo = prepararCatalogo(perfumes);
  const vinculos = { ...guardado.vinculos };
  const nuevosVinculos = {};
  let listas = [];
  let revisando = null; // carga anterior abierta para revisar (sus listas, sin volver a subir los archivos)
  let criterio = 'medio';
  let resultado = null;
  let filtro = 'listos';
  let busqueda = '';
  let mostrados = POR_TANDA;
  const decision = new Map(); // clave del tamaño → { cargar, candidato }

  vista.innerHTML = `
    <section class="tarjeta-admin">
      <h2 class="tarjeta-admin__titulo">1 · Subí las listas de los proveedores</h2>
      <p class="campo__ayuda">Word (.docx), PDF, Excel o CSV, una o varias a la vez. Los costos tienen que estar en dólares.
        ${Object.keys(vinculos).length ? `Hay ${Object.keys(vinculos).length} renglones ya reconocidos de otras veces.` : ''}</p>
      <label class="zona-archivo" style="margin-top:12px" data-zona>
        ${icono('subir')}<strong>Elegir archivos</strong><small>o arrastralos acá</small>
        <input type="file" accept=".docx,.pdf,.xlsx,.xls,.csv,.txt" multiple hidden data-archivos>
      </label>
      <div class="listas-costos" data-listas></div>
      <div class="campo" data-opciones hidden style="margin-top:12px"><span class="campo__rotulo">Si un perfume está en varias listas</span>
        <div class="segmentado" role="radiogroup" aria-label="Si un perfume está en varias listas">
          <label><input type="radio" name="criterio" value="medio" checked><span>El del medio</span></label>
          <label><input type="radio" name="criterio" value="barato"><span>Usar el más barato</span></label>
          <label><input type="radio" name="criterio" value="ultimo"><span>Usar la última lista</span></label>
        </div>
      </div>
    </section>
    ${guardado.cargas.length ? `
    <section class="tarjeta-admin">
      <h2 class="tarjeta-admin__titulo">Cargas anteriores</h2>
      <p class="campo__ayuda" style="margin-bottom:8px">Si una carga salió mal, deshacela: los costos vuelven a como estaban antes (si después cambiaron alguno a mano, ese se respeta) y se olvidan los renglones que se habían reconocido en esa carga. Se deshace de la más nueva a la más vieja.</p>
      <ul class="lista-admin">${guardado.cargas.map((c, i) => {
        const deshacible = !c.deshecha && guardado.cargas.slice(0, i).every((x) => x.deshecha);
        return `
        <li class="fila-admin">
          <span class="fila-admin__texto">
            <span class="fila-admin__titulo">${fechaHora(c.fecha)} · ${c.tamanos} ${c.tamanos === 1 ? 'costo' : 'costos'}${c.deshecha ? ' · <em>deshecha</em>' : ''}</span>
            <span class="fila-admin__sub">${c.archivos.length ? c.archivos.map(escapar).join(', ') : 'Sin archivos'}</span>
          </span>
          ${c.revisable && !c.deshecha ? `<button class="boton boton--suave boton--chico" type="button" data-revisar="${escapar(c.id)}">${icono('buscar')} Revisar</button>` : ''}
          ${deshacible ? `<button class="boton boton--peligro boton--chico" type="button" data-deshacer="${escapar(c.id)}">${icono('girar')} Deshacer</button>` : ''}
        </li>`;
      }).join('')}</ul>
    </section>` : ''}
    <section class="tarjeta-admin" data-resultado hidden>
      <h2 class="tarjeta-admin__titulo">2 · Revisá y cargá</h2>
      <p class="campo__ayuda" data-revisando hidden style="margin-bottom:12px"></p>
      <div class="cifras" data-cifras></div>
      <div class="herramientas-admin" style="margin-top:12px">
        <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar perfume o renglón" data-buscar></label>
        <div class="chips-admin" data-filtros role="group" aria-label="Qué mostrar"></div>
      </div>
      <div class="lista-costos" data-lista></div>
      <div class="ver-mas" data-mas hidden><button class="boton boton--suave" type="button">Ver más</button></div>
    </section>
    <div class="barra-guardar" data-barra hidden>
      <span class="barra-guardar__estado" data-estado></span>
      <button class="boton boton--lleno" type="button" data-guardar>Cargar costos</button>
    </div>`;

  const $ = (s) => vista.querySelector(s);

  function calcular() {
    resultado = armarPropuesta(listas, catalogo, { vinculos: { ...vinculos, ...nuevosVinculos }, criterio });
    for (const p of resultado.propuestas) {
      const previa = decision.get(p.clave);
      const candidato = previa && p.candidatos.includes(previa.candidato) ? previa.candidato
        : p.candidatos.find((c) => c.renglon.clave === previa?.candidato?.renglon.clave) || p.elegido;
      // Los que ya tienen ese mismo costo no se marcan (al revisar una carga anterior, ya están cargados).
      const igual = p.actual !== null && Math.abs(p.actual - candidato.renglon.costo) < 0.005;
      decision.set(p.clave, { cargar: previa ? previa.cargar : p.seguro && !igual, candidato });
    }
    pintar();
  }

  function pintarListas() {
    $('[data-listas]').innerHTML = listas.map((l, i) => `
      <div class="lista-costo" data-i="${i}">
        ${icono('tabla')}
        <span class="lista-costo__texto"><strong>${escapar(l.nombre)}</strong><small>${l.filas.length} renglones leídos</small></span>
        <label class="lista-costo__recargo"><small>Sumar al costo (%)</small><input class="entrada" type="number" inputmode="decimal" step="0.5" min="0" value="${l.recargo}" data-recargo></label>
        <button class="boton-icono" type="button" data-quitar aria-label="Quitar esta lista">${icono('cerrar')}</button>
      </div>`).join('');
    $('[data-opciones]').hidden = listas.length < 2;
  }

  const ganancia = (p, costo) => {
    const precio = p.perfume.presentaciones.find((x) => x.ml === p.ml)?.precio;
    return precio ? precio - costo : null;
  };

  function filaPropuesta(p) {
    const dec = decision.get(p.clave);
    const costo = dec.candidato.renglon.costo;
    const g = ganancia(p, costo);
    const igual = p.actual !== null && Math.abs(p.actual - costo) < 0.005;
    return `
      <div class="fila-costo ${dec.cargar ? '' : 'es-apagada'}" data-k="${escapar(p.clave)}">
        <label class="fila-costo__cargar"><input type="checkbox" data-cargar ${dec.cargar ? 'checked' : ''}><span class="solo-lector">Cargar</span></label>
        <div class="fila-costo__perfume"><strong>${escapar(p.perfume.nombre)}</strong><small>${escapar(p.perfume.marca)} · ${p.ml ? `${p.ml} ml` : 'único'}${dec.candidato.recordado ? ' · reconocido de antes' : ''}</small></div>
        <div class="fila-costo__dato"><small>Costo hoy</small><span>${p.actual !== null ? usd(p.actual) : '—'}</span></div>
        <div class="fila-costo__dato fila-costo__dato--nuevo"><small>Costo nuevo</small><span>${usd(costo)}${igual ? ' <em>igual</em>' : ''}</span>
          <small class="${g !== null && g <= 0 ? 'es-perdida' : ''}">${g === null ? '' : g <= 0 ? `cuesta más que el precio (${usd(g + costo)})` : `gana ${usd(g)}`}</small></div>
        <div class="fila-costo__origen">${p.candidatos.length > 1
          ? `<select class="entrada" data-candidato aria-label="Renglón del proveedor">${p.candidatos.map((c, i) => `<option value="${i}" ${c === dec.candidato ? 'selected' : ''}>${escapar(c.renglon.lista)}: ${escapar(c.renglon.descripcion.slice(0, 60))} — ${usd(c.renglon.costo)}</option>`).join('')}</select>`
          : `<small>${escapar(dec.candidato.renglon.lista)}: ${escapar(dec.candidato.renglon.descripcion)}</small>`}</div>
      </div>`;
  }

  function filaSinPareja(s) {
    const r = s.renglon;
    return `
      <div class="fila-costo fila-costo--sin" data-clave="${escapar(r.clave)}">
        <div class="fila-costo__perfume"><strong>${escapar(r.descripcion)}</strong><small>${escapar(r.lista)} · ${usd(r.costo)}</small></div>
        <div class="fila-costo__acciones">
          ${s.sugerido && s.sugerido.ml === null ? `<small>¿${escapar(s.sugerido.perfume.marca)} ${escapar(s.sugerido.perfume.nombre)}? No tiene ese tamaño.</small>` : ''}
          <button class="boton boton--suave boton--chico" type="button" data-vincular>${icono('enlace')} Es un perfume del catálogo</button>
          <button class="boton boton--suave boton--chico" type="button" data-ignorar>No lo vendemos</button>
        </div>
      </div>`;
  }

  function pintar() {
    if (!resultado) return;
    const { propuestas, sinPareja } = resultado;
    const listos = propuestas.filter((p) => p.seguro);
    const revisar = propuestas.filter((p) => !p.seguro);
    const aCargar = propuestas.filter((p) => decision.get(p.clave).cargar);
    const tamanos = perfumes.reduce((n, p) => n + p.presentaciones.length, 0);
    $('[data-resultado]').hidden = false;
    $('[data-barra]').hidden = false;
    $('[data-cifras]').innerHTML = `
      <div class="cifra"><span class="cifra__rotulo">Listos para cargar</span><span class="cifra__valor">${listos.length}</span><span class="cifra__nota">Coinciden seguro</span></div>
      <div class="cifra"><span class="cifra__rotulo">Para revisar</span><span class="cifra__valor">${revisar.length}</span><span class="cifra__nota">Parecidos: confirmalos</span></div>
      <div class="cifra"><span class="cifra__rotulo">Renglones sin perfume</span><span class="cifra__valor">${sinPareja.length}</span><span class="cifra__nota">No están en el catálogo</span></div>
      <div class="cifra"><span class="cifra__rotulo">Catálogo sin costo nuevo</span><span class="cifra__valor">${tamanos - propuestas.length}</span><span class="cifra__nota">de ${tamanos} tamaños</span></div>`;
    $('[data-filtros]').innerHTML = [['listos', 'Listos', listos.length], ['revisar', 'Para revisar', revisar.length], ['sin', 'Sin perfume', sinPareja.length]]
      .map(([k, t, n]) => `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${t}<span>${n}</span></button>`).join('');
    const q = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const coincide = (t) => q.every((w) => normalizar(t).includes(w));
    let html = '';
    let total = 0;
    if (filtro === 'sin') {
      const l = sinPareja.filter((s) => coincide(`${s.renglon.descripcion} ${s.renglon.lista}`));
      total = l.length;
      html = l.slice(0, mostrados).map(filaSinPareja).join('');
    } else {
      const l = (filtro === 'listos' ? listos : revisar).filter((p) => coincide(`${p.perfume.marca} ${p.perfume.nombre} ${p.candidatos.map((c) => c.renglon.descripcion).join(' ')}`));
      total = l.length;
      html = l.slice(0, mostrados).map(filaPropuesta).join('');
    }
    $('[data-lista]').innerHTML = html || '<p class="cifra__nota">No hay nada acá.</p>';
    $('[data-mas]').hidden = total <= mostrados;
    $('[data-estado]').textContent = `${aCargar.length} costos marcados para cargar`;
    $('[data-guardar]').textContent = `Cargar ${aCargar.length} costos`;
  }

  // Abre una carga anterior con las mismas listas: se ven las pestañas y se sigue vinculando lo que faltó.
  async function abrirCarga(c) {
    const r = await api(`/costos?listas=${encodeURIComponent(c.id)}`);
    listas = r.listas;
    revisando = c;
    decision.clear();
    filtro = 'revisar';
    mostrados = POR_TANDA;
    const nota = $('[data-revisando]');
    nota.hidden = false;
    nota.innerHTML = `Revisando la carga del <strong>${fechaHora(c.fecha)}</strong> · Vinculá lo que falte y tocá <strong>Cargar</strong> para guardarlo. Si subís listas nuevas, se empieza de cero con esas.`;
    pintarListas();
    calcular();
    // Se abre la primera pestaña que tenga algo: primero lo dudoso, después lo que no tiene perfume.
    if (!resultado.propuestas.some((p) => !p.seguro)) {
      filtro = resultado.sinPareja.length ? 'sin' : 'listos';
      pintar();
    }
  }

  async function agregarArchivos(archivos) {
    if (revisando) {
      listas = [];
      revisando = null;
      decision.clear();
      $('[data-revisando]').hidden = true;
    }
    for (const archivo of archivos) {
      try {
        const filas = await leerLista(archivo);
        if (!filas.length) {
          aviso(`No encontré precios en ${archivo.name}.`, 'error');
          continue;
        }
        listas.push({ nombre: archivo.name.replace(/\.[^.]+$/, ''), archivo: archivo.name, filas, recargo: 0 });
      } catch (err) {
        avisoError(err);
      }
    }
    pintarListas();
    if (listas.length) calcular();
  }

  $('[data-archivos]').addEventListener('change', (e) => {
    agregarArchivos([...e.target.files]);
    e.target.value = '';
  });
  const zona = $('[data-zona]');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('es-arrastrando'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('es-arrastrando'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('es-arrastrando');
    agregarArchivos([...e.dataTransfer.files]);
  });

  $('[data-listas]').addEventListener('input', demorar((e) => {
    if (!e.target.matches('[data-recargo]')) return;
    listas[Number(e.target.closest('[data-i]').dataset.i)].recargo = Number(e.target.value) || 0;
    calcular();
  }, 300));
  $('[data-listas]').addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    listas.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
    pintarListas();
    if (listas.length) calcular();
    else {
      resultado = null;
      $('[data-resultado]').hidden = true;
      $('[data-barra]').hidden = true;
    }
  });
  vista.addEventListener('change', (e) => {
    if (e.target.name === 'criterio') {
      criterio = e.target.value;
      decision.clear();
      calcular();
      return;
    }
    const fila = e.target.closest('[data-k]');
    if (!fila) return;
    const p = resultado.propuestas.find((x) => x.clave === fila.dataset.k);
    const dec = decision.get(p.clave);
    if (e.target.matches('[data-cargar]')) dec.cargar = e.target.checked;
    if (e.target.matches('[data-candidato]')) {
      dec.candidato = p.candidatos[Number(e.target.value)];
      dec.cargar = true;
    }
    fila.outerHTML = filaPropuesta(p);
    pintar();
  });
  vista.addEventListener('input', demorar((e) => {
    if (!e.target.matches('[data-buscar]')) return;
    busqueda = e.target.value.trim();
    mostrados = POR_TANDA;
    pintar();
  }, 200));
  vista.addEventListener('click', async (e) => {
    const revisar = e.target.closest('[data-revisar]');
    if (revisar) {
      try {
        await abrirCarga(guardado.cargas.find((x) => x.id === revisar.dataset.revisar));
        $('[data-resultado]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        avisoError(err);
      }
      return;
    }
    const deshacer = e.target.closest('[data-deshacer]');
    if (deshacer) {
      const c = guardado.cargas.find((x) => x.id === deshacer.dataset.deshacer);
      if (!(await confirmar(`¿Deshacer la carga del ${fechaHora(c.fecha)}?`, { aceptar: 'Deshacer', peligro: true, detalle: `Vuelven los ${c.tamanos} costos de antes de esa carga.` }))) return;
      try {
        const r = await api(`/costos?carga=${encodeURIComponent(c.id)}`, { metodo: 'DELETE' });
        olvidarPerfumes();
        aviso(r.saltados ? `Listo: volvieron ${r.costos} costos (${r.saltados} se habían cambiado a mano y se dejaron igual)` : `Listo: volvieron ${r.costos} costos`);
        app.ir('/importar');
        setTimeout(() => app.ir('/importar/costos'), 50);
      } catch (err) {
        avisoError(err);
      }
      return;
    }
    const f = e.target.closest('[data-filtro]');
    if (f) {
      filtro = f.dataset.filtro;
      mostrados = POR_TANDA;
      pintar();
      return;
    }
    if (e.target.closest('[data-mas]')) {
      mostrados += POR_TANDA;
      pintar();
      return;
    }
    const sin = e.target.closest('[data-clave]');
    if (!sin) return;
    const s = resultado.sinPareja.find((x) => x.renglon.clave === sin.dataset.clave);
    if (e.target.closest('[data-ignorar]')) {
      nuevosVinculos[s.renglon.clave] = { ignorar: true, descripcion: s.renglon.descripcion };
      calcular();
      aviso('Listo: ese renglón no se va a mostrar más');
    }
    if (e.target.closest('[data-vincular]')) {
      const elegido = await elegirPerfume(perfumes, s.renglon);
      if (!elegido) return;
      nuevosVinculos[s.renglon.clave] = { ...elegido, descripcion: s.renglon.descripcion };
      calcular();
      aviso('Vinculado: pasó a "Listos" y la próxima vez se reconoce solo');
    }
  });

  $('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const elegidas = resultado.propuestas.filter((p) => decision.get(p.clave).cargar);
    if (!elegidas.length && !Object.keys(nuevosVinculos).length) return aviso('No hay costos marcados para cargar.', 'error');
    const cambios = elegidas.map((p) => ({ id: p.perfume.id, ml: p.ml, costo: decision.get(p.clave).candidato.renglon.costo }));
    // Se recuerda cada renglón usado (y los marcados como "no lo vendemos") para reconocerlos solos la próxima vez.
    const recordar = [
      ...elegidas.map((p) => ({ clave: decision.get(p.clave).candidato.renglon.clave, id: p.perfume.id, ml: p.ml, descripcion: decision.get(p.clave).candidato.renglon.descripcion })),
      ...Object.entries(nuevosVinculos).filter(([, v]) => v.ignorar).map(([clave, v]) => ({ clave, ignorar: true, descripcion: v.descripcion })),
    ];
    // Los vinculados a mano se recuerdan aunque no se cargue su costo esta vez.
    const usados = new Set(recordar.map((v) => v.clave));
    for (const [clave, v] of Object.entries(nuevosVinculos)) {
      if (!v.ignorar && !usados.has(clave)) recordar.push({ clave, id: v.id, ml: v.ml, descripcion: v.descripcion });
    }
    try {
      const r = await api('/costos', {
        metodo: 'POST',
        datos: {
          cambios,
          vinculos: recordar,
          archivos: listas.map((l) => l.archivo),
          // Se guardan los renglones leídos para poder volver a abrir esta revisión más tarde.
          listas: listas.map(({ nombre, archivo, recargo, filas }) => ({ nombre, archivo, recargo, filas })),
        },
      });
      olvidarPerfumes();
      aviso(`Listo: ${r.tamanos} costos cargados`);
      // Se vuelve a abrir la pantalla: queda abierta la carga recién guardada para seguir revisando.
      app.ir('/importar');
      setTimeout(() => app.ir('/importar/costos'), 50);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));

  // Al entrar se abre sola la última carga (si guardó sus listas), así se puede seguir revisando.
  const ultima = guardado.cargas.find((c) => !c.deshecha);
  if (ultima?.revisable) await abrirCarga(ultima).catch(() => {});
  return undefined;
}
