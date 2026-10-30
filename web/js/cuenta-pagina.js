// Mi cuenta: puntos, ofertas exclusivas, pedidos y favoritos. Sin cuenta: los beneficios y los botones para crearla o ingresar.
import { iniciarPagina, tarjeta, activarTarjetas, escapar, beneficiosCuenta, abrirCuenta, aviso } from './interfaz.js';
import { cuentaAbierta, traerCuenta, salir } from './cuenta.js';
import { tieneExclusiva } from './datos.js';
import { obtenerFavoritos } from './favoritos.js';
import { icono } from './iconos.js';

const ESTADOS = { nuevo: 'Recibido', confirmado: 'Confirmado', cobrado: 'Pagado', entregado: 'Entregado' };
const raiz = document.querySelector('[data-mi-cuenta]');

const fechaCorta = (utc) => new Date(`${String(utc).replace(' ', 'T')}Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

function sinCuenta() {
  raiz.innerHTML = `
    <section class="mi-cuenta__invitacion">
      <p class="cuenta-dialogo__sobre">Essenze · Clientes</p>
      <h1 class="titulo-pagina">Tu cuenta</h1>
      <p class="mi-cuenta__bajada">Creala gratis con tu email y una contraseña.</p>
      ${beneficiosCuenta('beneficios--grande')}
      <div class="mi-cuenta__botones">
        <button class="boton boton--lleno" type="button" data-cuenta-modo="registro">Crear cuenta</button>
        <button class="boton boton--contorno" type="button" data-cuenta-modo="ingreso">Ya tengo cuenta</button>
      </div>
    </section>`;
}

async function conCuenta(datos) {
  let d;
  try {
    d = await traerCuenta();
  } catch (e) {
    raiz.innerHTML = `<p class="mi-cuenta__vacio">${escapar(e.message)}</p>`;
    return;
  }
  if (!d) {
    sinCuenta();
    return;
  }
  const { cuenta, pedidos } = d;
  const exclusivas = datos.perfumes.filter(tieneExclusiva);
  const nFav = obtenerFavoritos().length;
  raiz.innerHTML = `
    <header class="mi-cuenta__cabecera">
      <div>
        <p class="cuenta-dialogo__sobre">Mi cuenta</p>
        <h1 class="titulo-pagina">Hola${cuenta.nombre ? `, ${escapar(cuenta.nombre.split(' ')[0])}` : ''}</h1>
        <p class="mi-cuenta__email">${escapar(cuenta.email)}</p>
      </div>
      <button class="enlace-dorado" type="button" data-salir-cuenta>Cerrar sesión</button>
    </header>

    <div class="mi-cuenta__resumen">
      <section class="mi-cuenta__puntos" aria-label="Tus puntos">
        ${icono('estrella')}
        <p><span class="mi-cuenta__numero">${cuenta.puntos}</span> <span class="mi-cuenta__rotulo">${cuenta.puntos === 1 ? 'punto' : 'puntos'}</span></p>
        <p class="mi-cuenta__nota">Sumás 1 punto por cada dólar de tus compras. Muy pronto vas a poder canjearlos por descuentos y promociones.</p>
      </section>
      <a class="mi-cuenta__tarjeta" href="/favoritos">${icono('corazon')}<span><strong>${nFav} ${nFav === 1 ? 'favorito' : 'favoritos'}</strong><small>Guardados en tu cuenta, en cualquier celular</small></span>${icono('flecha', 'mi-cuenta__flecha')}</a>
      <div class="mi-cuenta__tarjeta mi-cuenta__tarjeta--pronto">${icono('chat')}<span><strong>Asesor con IA <span class="beneficios__marca">Próximamente</span></strong><small>Te va a ayudar a elegir tu próximo perfume.</small></span></div>
    </div>

    <section class="seccion-inicio" aria-labelledby="t-exclusivas">
      <div class="seccion__cabecera"><h2 class="titulo-seccion" id="t-exclusivas">Ofertas exclusivas</h2></div>
      ${exclusivas.length
        ? `<div class="grilla-productos" data-exclusivas>${exclusivas.slice(0, 12).map((p) => tarjeta(p)).join('')}</div>`
        : '<p class="mi-cuenta__vacio">Pronto vas a ver acá ofertas solo para clientes con cuenta.</p>'}
    </section>

    <section class="seccion-inicio" aria-labelledby="t-pedidos">
      <div class="seccion__cabecera"><h2 class="titulo-seccion" id="t-pedidos">Tus pedidos</h2></div>
      ${pedidos.length ? `<ul class="mi-cuenta__pedidos">${pedidos.map((p) => `
        <li class="pedido-cliente">
          <p class="pedido-cliente__cabeza"><strong>Pedido #${p.numero}</strong><span>${fechaCorta(p.creado)}</span><span class="pedido-cliente__estado">${ESTADOS[p.estado] || p.estado}</span></p>
          <ul class="pedido-cliente__items">${p.items.map((i) => `<li>${i.cantidad} × ${escapar(i.marca)} ${escapar(i.nombre)}${i.ml ? ` · ${i.ml} ml` : ''}</li>`).join('')}</ul>
        </li>`).join('')}</ul>`
        : '<p class="mi-cuenta__vacio">Todavía no hiciste pedidos con tu cuenta. Los que hagas desde la web con la cuenta abierta aparecen acá y te suman puntos.</p>'}
    </section>`;
  const grilla = raiz.querySelector('[data-exclusivas]');
  if (grilla) activarTarjetas(grilla);
}

const datos = await iniciarPagina('cuenta');
const pintar = () => (cuentaAbierta() ? conCuenta(datos) : sinCuenta());
pintar();

raiz.addEventListener('click', async (e) => {
  const modo = e.target.closest('[data-cuenta-modo]');
  if (modo) abrirCuenta(modo.dataset.cuentaModo);
  if (e.target.closest('[data-salir-cuenta]')) {
    await salir();
    aviso('Cerraste tu sesión');
  }
});
document.addEventListener('cuenta:cambio', pintar);
document.addEventListener('catalogo:cambio', () => { if (cuentaAbierta()) pintar(); });
