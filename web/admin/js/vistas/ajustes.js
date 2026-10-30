// Ajustes de la tienda, dólar de la semana, cuentas de clientes, copia de seguridad y sesión.
import { api } from '../api.js';
import { icono, escapar, ars, aviso, avisoError, conCarga, fijarDolar } from '../ui.js';

const FUENTES = { blue: 'Blue', oficial: 'Oficial', bolsa: 'MEP', contadoconliqui: 'Contado con liqui', cripto: 'Cripto', tarjeta: 'Tarjeta' };

// "lunes 26/10" a partir de "2026-10-26"
function lunesTexto(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `lunes ${Number(d)}/${Number(m)}`;
}

function proximoLunes(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function montar({ vista, app }) {
  app.titulo('Ajustes');
  const a = await api('/ajustes');
  vista.innerHTML = `
    <form class="tarjeta-admin" data-form>
      <h2 class="tarjeta-admin__titulo">Tienda</h2>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>WhatsApp de pedidos</span><input name="whatsapp" inputmode="numeric" value="${escapar(a.whatsapp)}" required>
          <small class="campo__ayuda">Con código de país y área, sin + ni espacios. Ej. 5493512484272</small></label>
        <label class="campo"><span>Ciudad</span><input name="ciudad" value="${escapar(a.ciudad)}"></label>
        <label class="campo"><span>Instagram (opcional)</span><input name="instagram" value="${escapar(a.instagram)}" placeholder="usuario, sin @" autocapitalize="none" autocorrect="off"></label>
        <label class="campo"><span>Comisión del pasante por perfume (USD)</span><input name="comision" type="number" inputmode="decimal" step="0.01" min="0" value="${a.comision ?? 3}">
          <small class="campo__ayuda">Se registra sola como gasto por cada perfume que cobrás (${ars((a.comision ?? 3) * (a.cotizacion || 0))} al dólar de esta semana).</small></label>

        <fieldset class="dolar ancho-total">
          <legend class="campo__rotulo">Dólar (pesos por USD)</legend>
          <label class="interruptor"><span class="interruptor__texto">Actualizar solo todos los lunes<small>Toma el valor de venta del dólar elegido (el mismo número que muestra Dolarito) y queda fijo toda la semana, así nadie ve cambiar el precio de un día para el otro.</small></span>
            <input type="checkbox" name="dolarAuto" ${a.dolarAuto ? 'checked' : ''}><span class="interruptor__pista"></span></label>
          <div class="form-grilla form-grilla--2">
            <label class="campo" data-solo-auto><span>Qué dólar</span>
              <select name="dolarFuente">${Object.entries(FUENTES).map(([k, v]) => `<option value="${k}" ${a.dolarFuente === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="campo"><span>Valor de esta semana</span><input name="cotizacion" type="number" inputmode="decimal" step="0.01" min="0" value="${a.cotizacion || ''}"></label>
          </div>
          <p class="campo__ayuda" data-solo-auto>${a.dolarFecha ? `Se actualizó el ${lunesTexto(a.dolarFecha)}. El próximo cambio es el ${lunesTexto(proximoLunes(a.dolarFecha))}.` : 'Se actualiza en la próxima visita a la tienda.'}</p>
          <p class="campo__ayuda" data-solo-mano>Escribí el valor y guardá. Convierte los precios del catálogo (en dólares) a pesos en la tienda y en el panel.</p>
          <button class="boton boton--suave boton--chico" type="button" data-dolar-ahora data-solo-auto>${icono('girar')} Traer el valor de hoy</button>
        </fieldset>

        <label class="campo ancho-total"><span>Fotos de los perfumes en la tienda</span>
          <select name="estiloFotos">
            <option value="blanco" ${a.estiloFotos !== 'oscuro' ? 'selected' : ''}>Fondo blanco (estilo estudio)</option>
            <option value="oscuro" ${a.estiloFotos === 'oscuro' ? 'selected' : ''}>Escenario oscuro con luz dorada</option>
          </select>
          <small class="campo__ayuda">Cambia cómo se ven todas las fotos al instante, sin tocar las fotos.</small></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Mostrar precios en pesos en la tienda<small>Los precios se calculan con el dólar de la semana (USD 100 = ${ars(100 * (a.cotizacion || 0))}). Si está apagado, la tienda muestra los dólares.</small></span>
          <input type="checkbox" name="mostrarArs" ${a.mostrarArs ? 'checked' : ''}><span class="interruptor__pista"></span></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Mostrar también el precio en dólares<small>Con los precios en pesos, agrega el valor en dólares chico debajo.</small></span>
          <input type="checkbox" name="mostrarUsd" ${a.mostrarUsd ? 'checked' : ''}><span class="interruptor__pista"></span></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Filtro y sección "Entrega inmediata"<small>Apagalos si tienen pocos en stock. Igual se ocultan solos cuando no hay ninguno en stock.</small></span>
          <input type="checkbox" name="filtroInmediata" ${a.filtroInmediata ? 'checked' : ''}><span class="interruptor__pista"></span></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Invitar a crear una cuenta al entrar<small>Un cartel con los beneficios de tener cuenta, a los pocos segundos de entrar. Si lo cierran, vuelve recién a la semana.</small></span>
          <input type="checkbox" name="popupCuentas" ${a.popupCuentas ? 'checked' : ''}><span class="interruptor__pista"></span></label>
      </div>
      <button class="boton boton--lleno" type="submit" style="margin-top:14px">Guardar ajustes</button>
    </form>

    <section class="tarjeta-admin">
      <h2 class="tarjeta-admin__titulo">Copia de seguridad</h2>
      <p class="campo__ayuda">Descargá todos los datos (perfumes, ofertas, pedidos y caja) en un archivo. Hacelo una vez por mes y guardalo en tu Drive.</p>
      <a class="boton boton--contorno" href="/api/admin/respaldo" style="margin-top:12px" download>${icono('bajar')} Descargar copia</a>
    </section>

    <section class="tarjeta-admin">
      <h2 class="tarjeta-admin__titulo">Acceso</h2>
      <p class="campo__ayuda">La contraseña del panel se cambia en Cloudflare: Workers &amp; Pages → essenze → Settings → Variables and Secrets → ADMIN_PASSWORD. Después volvé a entrar.</p>
      <p class="campo__ayuda" style="margin-top:8px">Tip: en el celular, abrí el panel y elegí "Agregar a pantalla de inicio" para usarlo como una app.</p>
      <button class="boton boton--suave" type="button" data-salir style="margin-top:12px">${icono('salir')} Cerrar sesión</button>
    </section>`;

  const form = vista.querySelector('[data-form]');
  const f = form.elements;
  // Con el dólar automático, el valor lo pone DolarApi (no se escribe a mano).
  function modoDolar() {
    const auto = f.dolarAuto.checked;
    f.cotizacion.readOnly = auto;
    form.querySelectorAll('[data-solo-auto]').forEach((el) => { el.hidden = !auto; });
    form.querySelectorAll('[data-solo-mano]').forEach((el) => { el.hidden = auto; });
  }
  f.dolarAuto.addEventListener('change', modoDolar);
  modoDolar();

  form.querySelector('[data-dolar-ahora]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    try {
      const r = await api('/dolar', { metodo: 'POST' });
      f.cotizacion.value = r.cotizacion;
      fijarDolar(r.cotizacion);
      aviso(`Dólar actualizado: ${ars(r.cotizacion)}`);
    } catch (err) {
      avisoError(err);
    }
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(form.querySelector('[type=submit]'), async () => {
      try {
        const r = await api('/ajustes', {
          metodo: 'PUT',
          datos: {
            whatsapp: f.whatsapp.value,
            ciudad: f.ciudad.value,
            instagram: f.instagram.value,
            cotizacion: f.cotizacion.value,
            dolarAuto: f.dolarAuto.checked,
            dolarFuente: f.dolarFuente.value,
            mostrarArs: f.mostrarArs.checked,
            mostrarUsd: f.mostrarUsd.checked,
            filtroInmediata: f.filtroInmediata.checked,
            popupCuentas: f.popupCuentas.checked,
            comision: f.comision.value,
            estiloFotos: f.estiloFotos.value,
          },
        });
        f.cotizacion.value = r.cotizacion || '';
        fijarDolar(r.cotizacion);
        aviso(r.avisoDolar || 'Ajustes guardados', r.avisoDolar ? 'error' : 'ok');
      } catch (err) {
        avisoError(err);
      }
    });
  });
  return undefined;
}
