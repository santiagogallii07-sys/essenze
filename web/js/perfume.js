import { TIPOS, GENEROS, ESTACIONES, OCASIONES } from './config.js';
import { iniciarPagina, tarjeta, activarTarjetas, agregarABolsa, escapar, enlaceWhatsapp, observarRevelado, botonFavorito, garantias } from './interfaz.js';
import { precio, precioArs, presentacionesOrdenadas, hayStock, obtenerPerfume, disponible, maximoDe, textoMl, normalizar } from './datos.js';
import { montarVisor } from './visor.js';
import { fotoPersonaje } from './personaje.js';
import { icono, iconoWhatsapp } from './iconos.js';

const { perfumes } = await iniciarPagina('catalogo', { pildora: false });
const id = new URLSearchParams(location.search).get('p');
const raiz = document.querySelector('[data-ficha]');

let p = null;
try {
  p = id ? await obtenerPerfume(id) : null;
} catch {
  p = null;
}

if (!p) {
  document.title = 'Perfume no encontrado · Essenze';
  raiz.innerHTML = `
    <div class="contenedor no-encontrado">
      ${fotoPersonaje('sentado', 'no-encontrado__personaje')}
      <h1 class="titulo-seccion">No encontramos este perfume</h1>
      <p>Puede que ya no esté en el catálogo o que el enlace esté incompleto.</p>
      <a class="boton boton--contorno" href="/catalogo">Ver catálogo ${icono('flecha')}</a>
    </div>`;
} else {
  pintarFicha(p);
}

function piramide(notas) {
  const niveles = [
    ['salida', 'Salida', 'Lo primero que sentís, los primeros minutos.'],
    ['corazon', 'Corazón', 'El carácter del perfume, durante horas.'],
    ['fondo', 'Fondo', 'Lo que queda en la piel al final del día.'],
  ].filter(([k]) => (notas[k] || []).length);
  return niveles.map(([k, titulo, ayuda], i) => `
    <div class="piramide__nivel revelar" style="--nivel:${i}">
      <div class="piramide__rotulo"><h3>${titulo}</h3><p>${ayuda}</p></div>
      <ul class="piramide__notas">${notas[k].map((n) => `<li>${escapar(n)}</li>`).join('')}</ul>
    </div>`).join('');
}

function acordes(lista) {
  return lista.map((a) => `
    <li class="acorde" style="--valor:${a.intensidad}">
      <a href="/catalogo?acorde=${encodeURIComponent(a.nombre)}"><span class="acorde__nombre">${escapar(a.nombre)}</span></a>
      <span class="acorde__barra" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${a.intensidad}" aria-label="Intensidad de ${escapar(a.nombre)}"><span></span></span>
    </li>`).join('');
}

function usos(x) {
  const est = Object.entries(ESTACIONES).map(([k, v]) => `<li class="${x.estaciones.includes(k) ? 'es-si' : ''}">${icono(k)}<span>${v}</span></li>`).join('');
  const oca = Object.entries(OCASIONES).map(([k, v]) => `<li class="${x.ocasiones.includes(k) ? 'es-si' : ''}">${icono(k)}<span>${v}</span></li>`).join('');
  return `<ul class="usos__lista" aria-label="Estaciones">${est}</ul><ul class="usos__lista usos__lista--corta" aria-label="Ocasión">${oca}</ul>`;
}

function pintarFicha(p) {
  const titulo = `${p.marca} ${p.nombre}`;
  document.title = `${titulo} · Essenze Parfum & Decants`;
  document.querySelector('meta[name="description"]').setAttribute('content', `${titulo}${p.concentracion ? ` ${p.concentracion}` : ''}. ${p.descripcion || p.perfil || ''}`.trim());

  const pres = presentacionesOrdenadas(p);
  const inicial = pres.find(disponible) || pres[0];
  const conStock = hayStock(p);
  const tamanos = pres.map((x) => `
    <label class="tamano ${disponible(x) ? '' : 'tamano--agotado'}">
      <input type="radio" name="ml" value="${x.ml}" ${x.ml === inicial.ml ? 'checked' : ''} ${disponible(x) ? '' : 'disabled'}>
      <span class="tamano__ml">${textoMl(x.ml)}</span>
      <span class="tamano__precio">${disponible(x) ? precio(x.precio) : 'Sin stock'}</span>
      ${x.precioAnterior && x.precioAnterior > x.precio && disponible(x) ? `<s class="tamano__antes">${precio(x.precioAnterior)}</s>` : ''}
    </label>`).join('');

  const consulta = enlaceWhatsapp(`Hola! Quería consultar por ${titulo}${p.concentracion ? ` (${p.concentracion})` : ''}.`);
  const tienePiramide = ['salida', 'corazon', 'fondo'].some((k) => (p.notas?.[k] || []).length);
  const destacadas = p.notas?.destacadas || [];
  const tieneAroma = tienePiramide || destacadas.length || p.acordes.length;
  const meta = [p.concentracion, GENEROS[p.genero], p.familia].filter(Boolean).map(escapar).join(' · ');

  document.querySelector('[data-migas]').innerHTML = `
    <li><a href="/catalogo">Catálogo</a></li>
    <li><a href="/catalogo?tipo=${p.tipo}">${TIPOS[p.tipo] || ''}</a></li>
    <li><a href="/catalogo?marca=${encodeURIComponent(p.marca)}">${escapar(p.marca)}</a></li>`;

  document.querySelector('[data-info]').innerHTML = `
    <div class="ficha__arriba"><p class="ficha__marca"><a href="/catalogo?marca=${encodeURIComponent(p.marca)}">${escapar(p.marca)}</a></p>${botonFavorito(p, 'ficha__favorito')}</div>
    <h1 class="ficha__nombre">${escapar(p.nombre)}</h1>
    ${meta ? `<p class="ficha__meta">${meta}</p>` : ''}
    <span class="filete" aria-hidden="true"></span>
    ${p.descripcion ? `<p class="ficha__descripcion">${escapar(p.descripcion)}</p>` : ''}
    ${p.perfil ? `<p class="ficha__perfil">${escapar(p.perfil)}</p>` : ''}

    <form class="compra" data-compra>
      <fieldset class="compra__tamanos">
        <legend>Tamaño</legend>
        <div class="tamanos">${tamanos}</div>
      </fieldset>
      <p class="compra__ars" data-ars></p>
      <div class="compra__fila" data-fila-compra>
        <div class="cantidad cantidad--grande" role="group" aria-label="Cantidad">
          <button type="button" data-cant="-1" aria-label="Quitar uno">${icono('menos')}</button>
          <output data-cantidad aria-live="polite">1</output>
          <button type="button" data-cant="1" aria-label="Agregar uno">${icono('mas')}</button>
        </div>
        <button class="boton boton--lleno compra__agregar" type="submit" ${conStock ? '' : 'disabled'}>
          ${conStock ? `Agregar a la bolsa · <span data-precio-total>${precio(inicial.precio)}</span>` : 'Sin stock'}
        </button>
      </div>
      <p class="compra__stock" data-stock></p>
      <a class="enlace-whatsapp" href="${consulta}" target="_blank" rel="noopener">${iconoWhatsapp()} ${conStock ? 'Consultar por este perfume' : 'Avisame cuando vuelva a entrar'}</a>
      ${garantias({ compacta: true })}
    </form>`;

  const despues = document.querySelector('[data-despues]');
  despues.innerHTML = `
    ${tieneAroma ? `
    <section class="olfato contenedor" aria-labelledby="t-olfato">
      <h2 class="titulo-seccion revelar revelar--linea" id="t-olfato">Cómo huele</h2>
      <div class="olfato__grilla ${tienePiramide || destacadas.length ? '' : 'olfato__grilla--simple'}">
        ${tienePiramide ? `<div class="piramide">${piramide(p.notas)}</div>` : destacadas.length ? `
          <div class="notas-destacadas revelar">
            <h3 class="bloque__titulo">Notas destacadas</h3>
            <ul>${destacadas.map((n) => `<li><a href="/catalogo?q=${encodeURIComponent(normalizar(n))}">${escapar(n)}</a></li>`).join('')}</ul>
          </div>` : ''}
        <div class="olfato__lateral">
          ${p.acordes.length ? `<div class="bloque revelar"><h3 class="bloque__titulo">Acordes principales</h3><ul class="acordes">${acordes(p.acordes)}</ul></div>` : ''}
          ${p.estaciones.length || p.ocasiones.length ? `<div class="bloque usos revelar"><h3 class="bloque__titulo">Cuándo usarlo</h3>${usos(p)}</div>` : ''}
        </div>
      </div>
    </section>` : ''}

    <section class="seccion contenedor" aria-labelledby="t-relacionados">
      <div class="seccion__cabecera">
        <h2 class="titulo-seccion revelar revelar--linea" id="t-relacionados">También te puede gustar</h2>
        <a class="enlace-dorado" href="/catalogo?tipo=${p.tipo}">Ver ${(TIPOS[p.tipo] || 'catálogo').toLowerCase()} ${icono('flecha')}</a>
      </div>
      <div class="grilla-productos" data-grilla-relacionados></div>
    </section>

    <div class="barra-compra" data-barra-compra aria-hidden="true">
      <div class="barra-compra__texto"><strong>${escapar(p.nombre)}</strong><span data-barra-precio></span></div>
      <button class="boton boton--lleno" type="button" data-barra-agregar ${conStock ? '' : 'disabled'} tabindex="-1">${conStock ? 'Agregar' : 'Sin stock'}</button>
    </div>`;

  // Si se llegó desde una tarjeta, la foto ya está puesta (transición); se reemplaza por el visor completo.
  const visor = document.querySelector('[data-visor]');
  montarVisor(visor, p);
  visor.querySelector('[data-foto-principal]')?.style.setProperty('view-transition-name', 'foto-perfume');
  sessionStorage.removeItem('essenze-transicion');

  const form = document.querySelector('[data-compra]');
  const salida = form.querySelector('[data-cantidad]');
  const stockEl = form.querySelector('[data-stock]');
  const arsEl = form.querySelector('[data-ars]');
  const barra = despues.querySelector('[data-barra-compra]');
  let cantidad = 1;

  const seleccion = () => pres.find((x) => x.ml === Number(form.elements.ml.value)) || inicial;
  function refrescar() {
    const x = seleccion();
    const max = maximoDe(x);
    cantidad = Math.max(1, Math.min(cantidad, Math.max(1, max)));
    salida.textContent = cantidad;
    const total = form.querySelector('[data-precio-total]');
    if (total) total.textContent = precio(x.precio * cantidad);
    form.querySelector('[data-cant="1"]').disabled = cantidad >= max;
    form.querySelector('[data-cant="-1"]').disabled = cantidad <= 1;
    const ars = precioArs(x.precio * cantidad);
    arsEl.textContent = ars ? `${ars} (precio en dólares)` : '';
    if (!disponible(x)) stockEl.textContent = '';
    else if (x.stock !== null && x.stock !== undefined && x.stock <= 2) stockEl.textContent = `Quedan ${x.stock} en ${textoMl(x.ml)}`;
    else stockEl.textContent = 'Disponible · envío o retiro a coordinar';
    stockEl.classList.toggle('es-poco', x.stock !== null && x.stock !== undefined && x.stock > 0 && x.stock <= 2);
    barra.querySelector('[data-barra-precio]').textContent = `${textoMl(x.ml)} · ${precio(x.precio)}`;
  }
  form.addEventListener('change', refrescar);
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cant]');
    if (!b) return;
    cantidad += Number(b.dataset.cant);
    refrescar();
  });
  const agregar = () => {
    const x = seleccion();
    if (agregarABolsa(p, x.ml, cantidad, visor)) {
      cantidad = 1;
      refrescar();
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    agregar();
  });
  barra.querySelector('[data-barra-agregar]').addEventListener('click', agregar);
  refrescar();

  // Barra fija de compra en el celular cuando el botón principal queda fuera de la pantalla.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      const mostrar = !en.isIntersecting && en.boundingClientRect.top < 0;
      barra.classList.toggle('es-visible', mostrar);
      barra.setAttribute('aria-hidden', String(!mostrar));
      barra.querySelector('button').tabIndex = mostrar ? 0 : -1;
    }).observe(form.querySelector('[data-fila-compra]'));
  }

  // Relacionados: mismo tipo, mismo acorde principal, misma marca; con foto y stock primero.
  const principal = normalizar(p.acordes[0]?.nombre || '');
  const relacionados = perfumes
    .filter((x) => x.id !== p.id)
    .map((x) => ({
      x,
      puntos: (x.tipo === p.tipo ? 3 : 0) + (normalizar(x.acordes[0]?.nombre || '') === principal && principal ? 3 : 0)
        + (x.familia && x.familia === p.familia ? 2 : 0) + (x.marca === p.marca ? 1 : 0) + (hayStock(x) ? 1 : 0) + (x.imagen ? 1 : 0),
    }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 4)
    .map((r) => r.x);
  const grilla = despues.querySelector('[data-grilla-relacionados]');
  grilla.innerHTML = relacionados.map((x) => tarjeta(x, { revelar: true })).join('');
  activarTarjetas(grilla);

  observarRevelado();
}
