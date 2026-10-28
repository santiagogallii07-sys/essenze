// Página de favoritos: los perfumes guardados, lado a lado para compararlos y pasarlos a la bolsa.
import { GENEROS, ESTACIONES, OCASIONES } from './config.js';
import { iniciarPagina, imagenPerfume, botonFavorito, agregarABolsa, escapar, enlaceWhatsapp } from './interfaz.js';
import { precio, presentacionesOrdenadas, inmediata, textoMl, enlacePerfume } from './datos.js';
import { obtenerFavoritos } from './favoritos.js';
import { icono, iconoWhatsapp } from './iconos.js';

const { perfumes } = await iniciarPagina('favoritos', { pildora: true });
const porId = new Map(perfumes.map((p) => [p.id, p]));

const comparador = document.querySelector('[data-comparador]');
const vacio = document.querySelector('[data-vacio]');
const intro = document.querySelector('[data-intro]');
const cuenta = document.querySelector('[data-cuenta]');
const pieFavoritos = document.querySelector('[data-pie-favoritos]');
const consultar = document.querySelector('[data-consultar]');

const celda = (rotulo, contenido) => `
  <div class="comparar__celda"><p class="comparar__rotulo">${rotulo}</p>${contenido || '<p class="comparar__nada">—</p>'}</div>`;

function notas(p) {
  const n = p.notas || {};
  const niveles = [['salida', 'Salida'], ['corazon', 'Corazón'], ['fondo', 'Fondo']].filter(([k]) => (n[k] || []).length);
  if (niveles.length) {
    return `<dl class="comparar__notas">${niveles.map(([k, t]) => `<div><dt>${t}</dt><dd>${n[k].slice(0, 4).map(escapar).join(', ')}</dd></div>`).join('')}</dl>`;
  }
  return (n.destacadas || []).length ? `<p class="comparar__texto">${n.destacadas.slice(0, 6).map(escapar).join(', ')}</p>` : '';
}

function acordes(p) {
  if (!p.acordes.length) return '';
  return `<ul class="comparar__acordes">${p.acordes.slice(0, 4).map((a) => `
    <li style="--valor:${a.intensidad}"><span>${escapar(a.nombre)}</span><span class="comparar__barra" aria-hidden="true"></span></li>`).join('')}</ul>`;
}

function usos(p) {
  const lista = [
    ...Object.entries(ESTACIONES).filter(([k]) => p.estaciones.includes(k)),
    ...Object.entries(OCASIONES).filter(([k]) => p.ocasiones.includes(k)),
  ];
  return lista.length ? `<ul class="comparar__usos">${lista.map(([k, v]) => `<li>${icono(k)}<span>${v}</span></li>`).join('')}</ul>` : '';
}

function columna(p, i) {
  const pres = presentacionesOrdenadas(p);
  const inicial = pres[0];
  const tamanos = pres.map((x) => `
    <label class="comparar__tamano">
      <input type="radio" name="ml-${i}" value="${x.ml}" ${x.ml === inicial.ml ? 'checked' : ''}>
      <span>${textoMl(x.ml)}${inmediata(x) ? '<small class="tamano-rapido__entrega">Entrega inmediata</small>' : ''}</span><span>${precio(x.precio)}</span>
    </label>`).join('');
  const detalle = [p.concentracion, GENEROS[p.genero]].filter(Boolean).map(escapar).join(' · ');

  return `
  <article class="comparar" data-id="${escapar(p.id)}" aria-label="${escapar(`${p.marca} ${p.nombre}`)}">
    <div class="comparar__imagen">
      <a href="${enlacePerfume(p)}" tabindex="-1" aria-hidden="true">${imagenPerfume(p)}</a>
      ${botonFavorito(p, 'comparar__favorito')}
    </div>
    <div class="comparar__identidad">
      <p class="tarjeta__marca">${escapar(p.marca)}</p>
      <h2 class="tarjeta__nombre"><a href="${enlacePerfume(p)}">${escapar(p.nombre)}</a></h2>
      ${detalle ? `<p class="tarjeta__detalle">${detalle}</p>` : ''}
    </div>
    <fieldset class="comparar__celda comparar__tamanos">
      <legend class="comparar__rotulo">Tamaños</legend>
      ${tamanos}
    </fieldset>
    ${celda('Familia', p.familia || p.perfil ? `<p class="comparar__texto">${escapar(p.familia || '')}${p.familia && p.perfil ? '<br>' : ''}${p.perfil ? `<span class="comparar__perfil">${escapar(p.perfil)}</span>` : ''}</p>` : '')}
    ${celda('Acordes', acordes(p))}
    ${celda('Notas', notas(p))}
    ${celda('Cuándo usarlo', usos(p))}
    <div class="comparar__accion">
      <button class="boton boton--lleno boton--chico boton--ancho" type="button" data-agregar-favorito aria-label="Agregar ${escapar(p.nombre)} a la bolsa">${icono('bolsa')} Agregar<span class="comparar__largo"> a la bolsa</span></button>
    </div>
  </article>`;
}

function pintar() {
  const lista = obtenerFavoritos().map((id) => porId.get(id)).filter(Boolean);
  const n = lista.length;
  comparador.removeAttribute('aria-busy');
  comparador.hidden = !n;
  intro.hidden = !n;
  pieFavoritos.hidden = !n;
  vacio.hidden = n > 0;
  cuenta.textContent = n ? `${n} ${n === 1 ? 'perfume' : 'perfumes'}` : '';
  comparador.classList.toggle('comparador--uno', n === 1);
  comparador.innerHTML = lista.map(columna).join('');
  if (!n) return;
  const texto = [
    'Hola Essenze! Estoy entre estos perfumes, ¿me ayudan a elegir?',
    '',
    ...lista.map((p) => `• ${p.marca} ${p.nombre}${p.concentracion ? ` (${p.concentracion})` : ''}`),
  ].join('\n');
  consultar.href = enlaceWhatsapp(texto);
  consultar.innerHTML = `${iconoWhatsapp()} ${n === 1 ? 'Consultar por este perfume' : 'Consultar por mis favoritos'}`;
}

comparador.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-agregar-favorito]');
  if (!boton) return;
  const art = boton.closest('.comparar');
  const p = porId.get(art.dataset.id);
  const elegido = art.querySelector('input[type="radio"]:checked');
  if (p && elegido) agregarABolsa(p, Number(elegido.value), 1, art.querySelector('.comparar__imagen'));
});

document.addEventListener('favoritos:cambio', pintar);
pintar();
