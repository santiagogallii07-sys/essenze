// Cuentas de clientes de la tienda: quiénes se registraron, sus pedidos y puntos, y contraseña nueva si se la olvidan.
import { api } from '../api.js';
import { icono, escapar, fechaHora, hoja, confirmar, aviso, avisoError, conCarga, demorar } from '../ui.js';

// Contraseña fácil de dictar por WhatsApp (ej. essenze-4821).
function contrasenaNueva() {
  return `essenze-${String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000)}`;
}

function dialogoContrasena(cliente) {
  const h = hoja({
    titulo: 'Contraseña nueva',
    ancho: 440,
    html: `
      <p class="campo__ayuda">Para ${escapar(cliente.email)}. Al guardarla se cierra su sesión en todos lados; después pasásela por WhatsApp y que la use para ingresar.</p>
      <label class="campo"><span>Contraseña nueva</span><input data-contrasena value="${contrasenaNueva()}" autocomplete="off" autocapitalize="none" spellcheck="false"></label>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Guardar</button>',
  });
  h.dialogo.querySelector('[data-ok]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    const contrasena = h.dialogo.querySelector('[data-contrasena]').value.trim();
    try {
      await api(`/clientes/${encodeURIComponent(cliente.id)}`, { metodo: 'PUT', datos: { contrasena } });
      h.cerrar(contrasena);
    } catch (err) {
      avisoError(err);
    }
  }));
  return h.cerrada;
}

export async function montar({ vista, app }) {
  app.titulo('Clientes');
  let q = '';
  let datos = { clientes: [], total: 0 };
  vista.innerHTML = `
    <p class="campo__ayuda" style="margin-bottom:12px">Las personas que se crearon una cuenta en la tienda. Suman 1 punto por cada dólar de sus compras cobradas (las ventas que cargás con su email también suman). Si alguien se olvida la contraseña, poné una nueva acá y pasásela por WhatsApp.</p>
    <div class="herramientas-admin">
      <label class="buscador-admin">${icono('buscar')}<input class="entrada" type="search" placeholder="Buscar por email o nombre" data-q enterkeyhint="search" aria-label="Buscar clientes"></label>
    </div>
    <div data-lista></div>`;
  const listaEl = vista.querySelector('[data-lista]');

  function pintar() {
    if (!datos.clientes.length) {
      listaEl.innerHTML = `<div class="vacio-admin">${icono('usuario')}<p>${q ? 'No hay clientes con esa búsqueda.' : 'Todavía no hay cuentas.'}</p><p class="vacio-admin__detalle">Cuando alguien se cree una cuenta en la tienda, aparece acá.</p></div>`;
      return;
    }
    listaEl.innerHTML = `
      <p class="contador-resultados">${datos.clientes.length} de ${datos.total} ${datos.total === 1 ? 'cuenta' : 'cuentas'}</p>
      <ul class="lista-clientes">${datos.clientes.map((c) => `
        <li class="cliente-admin" data-id="${escapar(c.id)}">
          <div class="cliente-admin__texto">
            <strong>${escapar(c.nombre || c.email)}</strong>
            <small>${c.nombre ? `${escapar(c.email)} · ` : ''}desde ${fechaHora(c.creado)}</small>
          </div>
          <div class="cliente-admin__datos">
            <span><strong>${c.pedidos}</strong> ${c.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
            <span><strong>${c.puntos}</strong> puntos</span>
            <span><strong>${c.favoritos || 0}</strong> favoritos</span>
          </div>
          <div class="cliente-admin__acciones">
            <a class="boton boton--suave boton--chico" href="#/pedidos?q=${encodeURIComponent(c.email)}">${icono('recibo')} Pedidos</a>
            <button class="boton boton--suave boton--chico" type="button" data-contrasena>${icono('editar')} Contraseña nueva</button>
            <button class="boton-icono" type="button" data-borrar aria-label="Borrar la cuenta de ${escapar(c.email)}">${icono('basura')}</button>
          </div>
        </li>`).join('')}</ul>`;
  }

  async function cargar() {
    datos = await api(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    pintar();
  }

  vista.querySelector('[data-q]').addEventListener('input', demorar((e) => {
    q = e.target.value.trim();
    cargar().catch(avisoError);
  }, 250));

  listaEl.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const c = datos.clientes.find((x) => x.id === li.dataset.id);
    if (e.target.closest('[data-contrasena]')) {
      const nueva = await dialogoContrasena(c);
      if (nueva) aviso(`Listo. Pasale a ${c.nombre || c.email} la contraseña: ${nueva}`);
      return;
    }
    if (e.target.closest('[data-borrar]')) {
      if (!(await confirmar(`¿Borrar la cuenta de ${c.email}?`, { aceptar: 'Borrar cuenta', peligro: true, detalle: 'Sus pedidos quedan en Pedidos; pierde los puntos y los favoritos guardados.' }))) return;
      try {
        await api(`/clientes/${encodeURIComponent(c.id)}`, { metodo: 'DELETE' });
        aviso('Cuenta borrada');
        cargar();
      } catch (err) {
        avisoError(err);
      }
    }
  });

  await cargar();
  return undefined;
}
