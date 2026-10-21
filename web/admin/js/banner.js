// Banners de publicidad hechos con IA: el prompt para pedirlos y la carga del archivo.
import { api, subirImagen } from './api.js';
import { procesarBanner, urlTemporal } from './fotos.js';
import { hoja, aviso, avisoError, conCarga, escapar, icono } from './ui.js';

export const MEDIDAS = {
  escritorio: { ancho: 2400, alto: 1000, texto: '2400 × 1000 px (proporción 12:5, horizontal)' },
  celular: { ancho: 1080, alto: 1350, texto: '1080 × 1350 px (proporción 4:5, vertical)' },
};

/** Prompt para cualquier IA de imágenes (ChatGPT, Gemini, Midjourney, Ideogram, Canva…). */
export function promptBanner({ titulo = '[TÍTULO]', texto = '[TEXTO CORTO]', sello = '', producto = '[PERFUME O MARCA]', formato = 'escritorio' } = {}) {
  const m = MEDIDAS[formato];
  const horizontal = formato === 'escritorio';
  return `Creá un banner publicitario para "ESSENZE · Parfum & Decants", una perfumería de lujo de Córdoba, Argentina.

FORMATO
- Tamaño exacto: ${m.texto}. Imagen ${horizontal ? 'horizontal' : 'vertical'}, sin bordes ni marcos, a sangre.
- Archivo PNG o JPG de buena calidad.

ESTILO E IDENTIDAD (respetar siempre)
- Lujo minimalista y nocturno. Fondo negro cálido (#0B0A09) con texturas sutiles de piedra oscura o terciopelo.
- Un haz de luz dorada suave entrando de costado, como en una vidriera de noche.
- Color de acento: dorado (#C9A35C y #E3C27E). Texto claro en marfil (#EDE7DB). Nada de colores saturados, neón ni degradados de colores.
- Tipografía elegante, en MAYÚSCULAS, fina y con mucho espaciado entre letras (estilo Tenor Sans / Didot fino). Pocas palabras.
- Producto protagonista: ${producto}. Frasco nítido, fotorrealista, apoyado sobre un pedestal de piedra oscura, con reflejo y brillo dorado. Si adjunto una foto del perfume, usá ese frasco tal cual, sin cambiar la etiqueta ni la forma.

COMPOSICIÓN
${horizontal
    ? '- Texto a la IZQUIERDA (ocupando como máximo el 45% del ancho), producto a la DERECHA.\n- Dejá un margen libre de 8% en todos los bordes: nada importante cerca de los bordes.'
    : '- Producto arriba (mitad superior), texto abajo (tercio inferior).\n- Dejá un margen libre de 10% en todos los bordes.'}

TEXTO (escribirlo EXACTAMENTE así, en español, sin agregar otras palabras)
- Título: "${titulo}"
- Bajada: "${texto}"${sello ? `\n- Sello circular dorado con el texto: "${sello}"` : ''}

NO INCLUIR
- Logos inventados, marcas de agua, precios, direcciones web, personas, manos, flores de colores, ni texto adicional.`;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Prompt copiado: pegalo en la IA');
  } catch {
    aviso('No se pudo copiar automático: seleccioná el texto y copialo.', 'error');
  }
}

function proporcionOk(img, formato) {
  const m = MEDIDAS[formato];
  const esperado = m.ancho / m.alto;
  const real = img.ancho / img.alto;
  return Math.abs(real - esperado) / esperado < 0.08;
}

/**
 * Hoja "Cargar banner": prompt para la IA + subida del archivo (escritorio y, opcional, celular).
 * @param {object|null} oferta  banner existente para editar
 * @param {Array<[string,string]>} enlaces  opciones de destino [valor, texto]
 */
export async function dialogoBanner(oferta, enlaces) {
  const o = oferta || { titulo: '', texto: '', etiqueta: '', enlace: '/catalogo?oferta=1', imagen: null, imagen_movil: null, activa: true, desde: '', hasta: '' };
  const estado = { imagen: o.imagen, movil: o.imagen_movil };
  const h = hoja({
    titulo: oferta ? 'Editar banner' : 'Cargar banner',
    ancho: 680,
    html: `
      <details class="tarjeta-admin" ${oferta ? '' : 'open'}>
        <summary class="tarjeta-admin__titulo" style="margin:0">1 · Pedirle el banner a la IA ${icono('abajo')}</summary>
        <div style="display:grid;gap:12px;margin-top:12px">
          <p class="campo__ayuda">Completá estos datos, copiá el prompt y pegalo en ChatGPT, Gemini, Ideogram o la IA que uses. Si podés, adjuntale también una foto del perfume. Pedí <strong>dos versiones</strong>: compu y celular.</p>
          <div class="form-grilla form-grilla--2">
            <label class="campo"><span>Título del banner</span><input data-p="titulo" value="${escapar(o.titulo)}" placeholder="Ej. SEMANA LATTAFA"></label>
            <label class="campo"><span>Sello (opcional)</span><input data-p="sello" value="${escapar(o.etiqueta)}" placeholder="Ej. 20% OFF"></label>
            <label class="campo ancho-total"><span>Bajada</span><input data-p="texto" value="${escapar(o.texto)}" placeholder="Ej. Khamrah, Asad y Yara con precio especial"></label>
            <label class="campo ancho-total"><span>Perfume o marca protagonista</span><input data-p="producto" placeholder="Ej. Lattafa Khamrah, frasco ámbar facetado con tapa dorada"></label>
          </div>
          <div class="segmentado" role="radiogroup" aria-label="Versión del prompt">
            <label><input type="radio" name="version" value="escritorio" checked><span>Para compu (2400×1000)</span></label>
            <label><input type="radio" name="version" value="celular"><span>Para celular (1080×1350)</span></label>
          </div>
          <textarea class="entrada prompt-banner" rows="9" readonly data-prompt></textarea>
          <button class="boton boton--contorno" type="button" data-copiar>${icono('copiar')} Copiar prompt</button>
        </div>
      </details>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">2 · Subir lo que hizo la IA</h3>
        <div class="banner-cargas">
          <div class="banner-carga">
            <span class="campo__rotulo">Versión compu (obligatoria)</span>
            <div class="banner-vista banner-vista--escritorio" data-vista="escritorio">${estado.imagen ? `<img src="/foto/${estado.imagen}" alt="">` : '<span>2400 × 1000</span>'}</div>
            <label class="boton boton--suave boton--chico">${icono('subir')}<span>Elegir archivo</span><input type="file" accept="image/*" hidden data-archivo="escritorio"></label>
            <p class="campo__ayuda" data-aviso="escritorio"></p>
          </div>
          <div class="banner-carga">
            <span class="campo__rotulo">Versión celular (recomendada)</span>
            <div class="banner-vista banner-vista--celular" data-vista="celular">${estado.movil ? `<img src="/foto/${estado.movil}" alt="">` : '<span>1080 × 1350</span>'}</div>
            <label class="boton boton--suave boton--chico">${icono('subir')}<span>Elegir archivo</span><input type="file" accept="image/*" hidden data-archivo="celular"></label>
            <p class="campo__ayuda" data-aviso="celular">Si no la subís, en el celular se muestra la de compu achicada.</p>
          </div>
        </div>
      </section>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">3 · Publicar</h3>
        <div class="form-grilla form-grilla--2">
          <label class="campo ancho-total"><span>Al tocar el banner, lleva a</span>
            <select data-enlace>
              ${enlaces.map(([v, t]) => `<option value="${escapar(v)}" ${o.enlace === v ? 'selected' : ''}>${escapar(t)}</option>`).join('')}
              ${enlaces.some(([v]) => v === o.enlace) ? '' : `<option value="${escapar(o.enlace)}" selected>${escapar(o.enlace)}</option>`}
            </select>
          </label>
          <label class="campo"><span>Desde (opcional)</span><input type="date" data-desde value="${o.desde || ''}"></label>
          <label class="campo"><span>Hasta (opcional)</span><input type="date" data-hasta value="${o.hasta || ''}"></label>
          <label class="interruptor ancho-total"><span class="interruptor__texto">Activo</span><input type="checkbox" data-activa ${o.activa ? 'checked' : ''}><span class="interruptor__pista"></span></label>
        </div>
      </section>`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-guardar>${oferta ? 'Guardar' : 'Publicar banner'}</button>`,
  });
  const d = h.dialogo;
  const $ = (s) => d.querySelector(s);

  const datosPrompt = () => ({
    titulo: $('[data-p="titulo"]').value.trim() || '[TÍTULO]',
    texto: $('[data-p="texto"]').value.trim() || '[TEXTO CORTO]',
    sello: $('[data-p="sello"]').value.trim(),
    producto: $('[data-p="producto"]').value.trim() || '[PERFUME O MARCA]',
    formato: d.querySelector('[name=version]:checked').value,
  });
  const pintarPrompt = () => { $('[data-prompt]').value = promptBanner(datosPrompt()); };
  d.addEventListener('input', (e) => { if (e.target.matches('[data-p]')) pintarPrompt(); });
  d.addEventListener('change', (e) => { if (e.target.name === 'version') pintarPrompt(); });
  $('[data-copiar]').addEventListener('click', () => copiar($('[data-prompt]').value));
  pintarPrompt();

  d.querySelectorAll('[data-archivo]').forEach((input) => input.addEventListener('change', async () => {
    const archivo = input.files[0];
    input.value = '';
    if (!archivo) return;
    const formato = input.dataset.archivo;
    const vista = $(`[data-vista="${formato}"]`);
    const avisoEl = $(`[data-aviso="${formato}"]`);
    vista.innerHTML = '<div class="cargando"><span></span><span></span><span></span></div>';
    try {
      const procesada = await procesarBanner(archivo, { ancho: MEDIDAS[formato].ancho });
      vista.innerHTML = `<img src="${urlTemporal(procesada.blob)}" alt="">`;
      avisoEl.textContent = proporcionOk(procesada, formato)
        ? `Listo (${procesada.ancho} × ${procesada.alto}).`
        : `Ojo: mide ${procesada.ancho} × ${procesada.alto}, no tiene la proporción ${formato === 'escritorio' ? '12:5' : '4:5'}. Se va a ver con bordes; mejor pedile a la IA el tamaño exacto.`;
      const r = await subirImagen(procesada);
      if (formato === 'escritorio') estado.imagen = r.id;
      else estado.movil = r.id;
    } catch (err) {
      vista.innerHTML = '<span>No se pudo cargar</span>';
      avisoError(err);
    }
  }));

  $('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!estado.imagen) return aviso('Subí al menos la versión para compu.', 'error');
    const titulo = $('[data-p="titulo"]').value.trim() || 'Banner';
    const datos = {
      formato: 'banner',
      titulo,
      texto: $('[data-p="texto"]').value.trim(),
      etiqueta: $('[data-p="sello"]').value.trim(),
      boton: 'Ver más',
      enlace: $('[data-enlace]').value,
      imagen: estado.imagen,
      imagen_movil: estado.movil,
      perfume: null,
      desde: $('[data-desde]').value,
      hasta: $('[data-hasta]').value,
      activa: $('[data-activa]').checked,
    };
    try {
      if (oferta) await api(`/ofertas/${oferta.id}`, { metodo: 'PUT', datos });
      else await api('/ofertas', { metodo: 'POST', datos });
      aviso('Banner publicado en la cartelera');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
    return undefined;
  }));
  return h.cerrada.then((v) => v === true);
}
