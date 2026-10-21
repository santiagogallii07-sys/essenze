// Ajustes de la tienda, copia de seguridad y sesión.
import { api } from '../api.js';
import { icono, escapar, ars, aviso, avisoError, conCarga, fijarDolar } from '../ui.js';

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
        <label class="campo"><span>Dólar (pesos por USD)</span><input name="cotizacion" type="number" inputmode="decimal" step="0.01" min="0" value="${a.cotizacion || ''}">
          <small class="campo__ayuda">Convierte los precios del catálogo (en dólares) a pesos en la tienda y en el panel. Cambialo cuando se mueva el dólar.</small></label>
        <label class="campo"><span>Comisión del pasante por perfume (USD)</span><input name="comision" type="number" inputmode="decimal" step="0.01" min="0" value="${a.comision ?? 3}">
          <small class="campo__ayuda">Se registra sola como gasto por cada perfume que cobrás (${ars((a.comision ?? 3) * (a.cotizacion || 0))} al dólar de hoy).</small></label>
        <label class="interruptor ancho-total"><span class="interruptor__texto">Mostrar precios en pesos en la tienda<small>El precio en pesos va grande y el de dólares chico debajo (USD 100 = ${ars(100 * (a.cotizacion || 0))})</small></span>
          <input type="checkbox" name="mostrarArs" ${a.mostrarArs ? 'checked' : ''}><span class="interruptor__pista"></span></label>
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

  vista.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget.elements;
    conCarga(e.currentTarget.querySelector('[type=submit]'), async () => {
      try {
        const r = await api('/ajustes', { metodo: 'PUT', datos: { whatsapp: f.whatsapp.value, ciudad: f.ciudad.value, instagram: f.instagram.value, cotizacion: f.cotizacion.value, mostrarArs: f.mostrarArs.checked, comision: f.comision.value } });
        fijarDolar(r.cotizacion);
        aviso('Ajustes guardados');
      } catch (err) {
        avisoError(err);
      }
    });
  });
  return undefined;
}
