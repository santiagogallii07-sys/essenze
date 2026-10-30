// Inicio del panel: lo importante del mes de un vistazo.
import { api } from '../api.js';
import { icono, escapar, usd, ars, nombreMes, fechaHora, ESTADOS, hoy, demorar, miniatura } from '../ui.js';
import { perfumesLivianos, buscarEn } from '../datos.js';

export function graficoMeses(meses, fmt = usd) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));
  return `
    <div class="barras" role="img" aria-label="Ingresos y egresos de los últimos meses">
      ${meses.map((m, i) => `
        <div class="barras__mes" title="${nombreMes(m.mes)}: ingresos ${fmt(m.ingresos)}, egresos ${fmt(m.egresos)}">
          <div class="barras__pila">
            <span class="barras__barra barras__barra--ingreso" style="height:${(m.ingresos / maximo) * 100}%;animation-delay:${i * 50}ms"></span>
            <span class="barras__barra barras__barra--egreso" style="height:${(m.egresos / maximo) * 100}%;animation-delay:${i * 50 + 25}ms"></span>
          </div>
          <span class="barras__rotulo">${nombreMes(m.mes, true)}</span>
        </div>`).join('')}
    </div>
    <div class="leyenda"><span>Ingresos</span><span>Egresos</span></div>`;
}

function saludo() {
  const h = Number(new Date().toLocaleString('es-AR', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Cordoba' }));
  return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export async function montar({ vista, app }) {
  app.titulo('Inicio');
  const r = await api('/resumen');
  const c = r.caja;
  const fmt = (n) => (r.moneda === 'ARS' ? ars(n) : usd(n));
  const nuevos = r.pedidos.nuevo || 0;
  const cat = r.catalogo;
  const fechaLarga = new Date(`${hoy()}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  vista.innerHTML = `
    <div class="saludo">
      <h2 class="saludo__titulo">${saludo()}</h2>
      <p class="saludo__fecha">${fechaLarga[0].toUpperCase()}${fechaLarga.slice(1)}</p>
    </div>

    <div class="buscador-general" data-buscador-general>
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar perfume, pedido o cliente" autocomplete="off" enterkeyhint="search" aria-label="Buscar perfumes y pedidos" data-q-general></label>
      <div class="buscador-general__resultados" data-resultados-general hidden></div>
    </div>

    <div class="cifras cifras--seis">
      <a class="cifra" href="#/pedidos">
        <span class="cifra__rotulo">Pedidos nuevos</span>
        <span class="cifra__valor num">${nuevos}</span>
        <span class="cifra__nota">${nuevos ? 'Esperan respuesta' : 'Todo al día'}</span>
      </a>
      <a class="cifra" href="#/caja">
        <span class="cifra__rotulo">Ventas de ${nombreMes(r.mes).split(' ')[0].toLowerCase()}</span>
        <span class="cifra__valor">${fmt(c.ventas)}</span>
        <span class="cifra__nota">${c.ventasCobradas} ${c.ventasCobradas === 1 ? 'venta cobrada' : 'ventas cobradas'}</span>
      </a>
      <a class="cifra" href="#/caja">
        <span class="cifra__rotulo">Costo de lo vendido</span>
        <span class="cifra__valor">${fmt(c.costoVendido)}</span>
        <span class="cifra__nota">${c.costoVendido ? `Lo que costaron los perfumes vendidos (${c.unidades} u.)` : 'Cargá costos para verlo'}</span>
      </a>
      <a class="cifra" href="#/caja">
        <span class="cifra__rotulo">Margen de ventas</span>
        <span class="cifra__valor">${fmt(c.margen)}</span>
        <span class="cifra__nota">${c.costoVendido ? `Ventas − costo − comisión ${fmt(c.comisiones)}` : 'Cargá costos para verlo'}</span>
      </a>
      <a class="cifra" href="#/caja">
        <span class="cifra__rotulo">Gastos del mes</span>
        <span class="cifra__valor">${fmt(c.egresos)}</span>
        <span class="cifra__nota">Todo lo que salió de la caja</span>
      </a>
      <a class="cifra ${c.saldo >= 0 ? '' : 'cifra--negativa'}" href="#/caja">
        <span class="cifra__rotulo">Saldo del mes</span>
        <span class="cifra__valor">${fmt(c.saldo)}</span>
        <span class="cifra__nota">Ingresos − egresos</span>
      </a>
    </div>

    <div class="acciones-rapidas" style="margin-top:12px">
      <a class="accion-rapida" href="#/pedidos?venta">${icono('dolar')}<span>Registrar venta</span></a>
      <a class="accion-rapida" href="#/caja?gasto">${icono('caja')}<span>Cargar gasto</span></a>
      <a class="accion-rapida" href="#/perfumes/nuevo">${icono('mas')}<span>Nuevo perfume</span></a>
      <a class="accion-rapida" href="#/ofertas">${icono('etiqueta')}<span>Ofertas</span></a>
    </div>

    <div class="grilla-admin grilla-admin--2" style="margin-top:12px">
      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">Últimos 6 meses <a href="#/caja">Ver caja</a></h3>
        ${graficoMeses(r.meses, fmt)}
      </section>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">Últimos pedidos <a href="#/pedidos">Ver todos</a></h3>
        ${r.ultimos.length ? `<ul class="lista-admin">${r.ultimos.map((p) => `
          <li><a class="fila-admin" href="#/pedidos">
            <span class="fila-admin__texto">
              <span class="fila-admin__titulo">${escapar(p.nombre || 'Sin nombre')}</span>
              <span class="fila-admin__sub">${escapar(p.numero ? `#${p.numero}` : p.id)} · ${fechaHora(p.creado)}</span>
            </span>
            <span class="estado estado--${p.estado}">${ESTADOS[p.estado]}</span>
            <span class="fila-admin__valor">${fmt(p.total)}</span>
          </a></li>`).join('')}</ul>` : '<p class="cifra__nota">Todavía no hay pedidos. Cuando un cliente mande uno desde la web, aparece acá.</p>'}
      </section>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">Catálogo <a href="#/perfumes">Ver perfumes</a></h3>
        <ul class="lista-admin">
          <li class="fila-admin"><span class="fila-admin__texto">Perfumes visibles</span><span class="fila-admin__valor num">${cat.visibles || 0} de ${cat.total || 0}</span></li>
          <li><a class="fila-admin" href="#/perfumes?filtro=sinFoto"><span class="fila-admin__texto">Sin foto</span><span class="fila-admin__valor num">${cat.sinFoto || 0}</span></a></li>
          <li><a class="fila-admin" href="#/perfumes?filtro=oferta"><span class="fila-admin__texto">En oferta</span><span class="fila-admin__valor num">${cat.enOferta || 0}</span></a></li>
          <li><a class="fila-admin" href="#/perfumes?filtro=revisar"><span class="fila-admin__texto">Para revisar</span><span class="fila-admin__valor num">${cat.revisar || 0}</span></a></li>
        </ul>
        ${cat.total ? '' : `<a class="boton boton--lleno boton--ancho" style="margin-top:12px" href="#/importar">${icono('tabla')} Importar el Excel</a>`}
      </section>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">Más vendidos del mes</h3>
        ${r.masVendidos.length ? `<ul class="lista-admin">${r.masVendidos.map((m) => `
          <li><a class="fila-admin" href="${m.id ? `#/perfumes/${encodeURIComponent(m.id)}` : '#/pedidos'}">
            <span class="fila-admin__texto"><span class="fila-admin__titulo">${escapar(m.nombre)}</span><span class="fila-admin__sub">${escapar(m.marca || 'Planilla de ventas')}</span></span>
            <span class="fila-admin__valor num">${m.unidades} u.</span>
          </a></li>`).join('')}</ul>` : '<p class="cifra__nota">Aparecen cuando marques pedidos como cobrados.</p>'}
        ${r.stockBajo.length ? `
          <h3 class="tarjeta-admin__titulo" style="margin-top:18px">Stock por terminarse</h3>
          <ul class="lista-admin">${r.stockBajo.map((s) => `
            <li><a class="fila-admin" href="#/perfumes/${encodeURIComponent(s.id)}">
              <span class="fila-admin__texto"><span class="fila-admin__titulo">${escapar(s.nombre)} · ${s.ml} ml</span><span class="fila-admin__sub">${escapar(s.marca)}</span></span>
              <span class="fila-admin__valor num" style="color:${s.stock ? 'var(--oro-claro)' : 'var(--rojo)'}">${s.stock ? `Queda ${s.stock}` : 'Se terminó: a pedido'}</span>
            </a></li>`).join('')}</ul>` : ''}
      </section>
    </div>`;

  // Buscador general: perfumes (de la lista guardada) y pedidos (por número, cliente o perfume).
  const entrada = vista.querySelector('[data-q-general]');
  const caja = vista.querySelector('[data-resultados-general]');
  entrada.addEventListener('focus', () => perfumesLivianos().catch(() => {}), { once: true });
  entrada.addEventListener('input', demorar(async () => {
    const q = entrada.value.trim();
    if (q.length < 2) {
      caja.hidden = true;
      return;
    }
    const [lista, pedidos] = await Promise.all([
      perfumesLivianos().catch(() => []),
      api(`/pedidos?q=${encodeURIComponent(q)}`).then((d) => d.pedidos.slice(0, 5)).catch(() => []),
    ]);
    if (entrada.value.trim() !== q) return;
    const perfumes = buscarEn(lista, q, 6);
    caja.innerHTML = `
      ${perfumes.length ? `<p class="buscador-general__grupo">Perfumes</p>${perfumes.map((p) => `
        <a class="buscador-general__fila" href="#/perfumes/${encodeURIComponent(p.id)}">${miniatura(p)}<span><strong>${escapar(p.nombre)}</strong><small>${escapar(p.marca)}</small></span></a>`).join('')}` : ''}
      ${pedidos.length ? `<p class="buscador-general__grupo">Pedidos</p>${pedidos.map((p) => `
        <a class="buscador-general__fila" href="#/pedidos?q=${encodeURIComponent(p.numero || p.id)}">${icono('recibo')}<span><strong>${escapar(p.numero ? `#${p.numero}` : p.id)} · ${escapar(p.nombre || 'Sin nombre')}</strong><small>${escapar(p.items.map((i) => i.nombre).join(', '))}</small></span><span class="estado estado--${p.estado}">${ESTADOS[p.estado]}</span></a>`).join('')}` : ''}
      ${perfumes.length || pedidos.length ? '' : `<p class="buscador-general__vacio">No encontramos "${escapar(q)}".</p>`}`;
    caja.hidden = false;
  }, 200));
}
