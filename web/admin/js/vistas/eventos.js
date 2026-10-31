// Eventos de precios (Cyber Day, Black Friday…): la lista y el botón para crear uno nuevo.
import { api } from '../api.js';
import { icono, escapar, hoja, avisoError, conCarga } from '../ui.js';

export const ESTADOS_EVENTO = {
  borrador: 'Listo para activar',
  programado: 'Programado',
  aplicando: 'Activándose…',
  activo: 'Activo',
  terminando: 'Terminando…',
  terminado: 'Terminado',
};

// "2026-11-03T14:30" → "3/11 14:30"
export function fechaEvento(v) {
  if (!v) return '';
  const [d, h] = v.split('T');
  const [, m, dia] = d.split('-');
  return `${Number(dia)}/${Number(m)} ${h}`;
}

function nuevoEvento(app) {
  const h = hoja({
    titulo: 'Nuevo evento',
    ancho: 440,
    html: `
      <label class="campo"><span>Nombre del evento</span><input data-nombre maxlength="60" placeholder="Ej. Cyber Day" autocapitalize="words"></label>
      <p class="campo__ayuda">Después elegís las fechas y cómo cambian los precios.</p>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-ok>Crear</button>',
  });
  const entrada = h.dialogo.querySelector('[data-nombre]');
  setTimeout(() => entrada.focus(), 80);
  h.dialogo.querySelector('[data-ok]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    try {
      const r = await api('/eventos', { metodo: 'POST', datos: { nombre: entrada.value } });
      h.cerrar();
      app.ir(`/eventos/${r.id}`);
    } catch (err) {
      avisoError(err);
    }
  }));
}

export async function montar({ vista, app }) {
  app.titulo('Eventos');
  const nuevo = document.createElement('button');
  nuevo.className = 'boton boton--lleno boton--chico';
  nuevo.type = 'button';
  nuevo.innerHTML = `${icono('mas')}<span>Nuevo evento</span>`;
  nuevo.addEventListener('click', () => nuevoEvento(app));
  app.acciones(nuevo);

  const { eventos } = await api('/eventos');
  vista.innerHTML = `
    <p class="campo__ayuda" style="margin-bottom:14px">Precios especiales por unos días (Cyber Day, Black Friday…). Cada evento tiene sus fechas y sus reglas; puede empezar y terminar solo, o lo prenden y apagan ustedes. Al terminar, los precios vuelven solos a como estaban.</p>
    ${eventos.length ? `<div class="lista-eventos">${eventos.map((ev) => `
      <a class="evento-admin evento-admin--${ev.estado}" href="#/eventos/${ev.id}">
        <span class="evento-admin__texto">
          <strong>${escapar(ev.nombre)}</strong>
          <small>${ev.desde || ev.hasta ? `${fechaEvento(ev.desde) || '—'} → ${fechaEvento(ev.hasta) || '—'}` : 'Sin fechas'} · ${ev.modo === 'auto' ? 'automático' : 'manual'}${ev.estado === 'activo' ? ` · ${ev.precios} precios cambiados` : ''}</small>
        </span>
        <span class="estado-evento estado-evento--${ev.estado}">${ESTADOS_EVENTO[ev.estado] || ev.estado}</span>
        ${icono('chevron')}
      </a>`).join('')}</div>`
      : `<div class="vacio-admin">${icono('estrella')}<p>Todavía no hay eventos.</p><p class="vacio-admin__detalle">Creá uno (por ejemplo "Cyber Day"), elegí las fechas y cuánto le quieren ganar a cada perfume.</p><button class="boton boton--lleno" type="button" data-nuevo>${icono('mas')} Nuevo evento</button></div>`}`;
  vista.querySelector('[data-nuevo]')?.addEventListener('click', () => nuevoEvento(app));
  return undefined;
}
