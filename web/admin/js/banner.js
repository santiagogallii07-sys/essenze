// Banners de publicidad hechos con IA: el prompt para pedirlos y la carga del archivo.
// También el prompt para pedirle a otra IA un banner con el cocodrilo de la marca.
import { api, subirImagen } from './api.js';
import { procesarBanner, urlTemporal } from './fotos.js';
import { hoja, aviso, avisoError, conCarga, escapar, icono } from './ui.js';

// Los banners van en la mitad derecha de arriba del inicio (en el celular, arriba de todo):
// tienen la misma forma en compu y en celular, así que alcanza con una sola imagen.
export const MEDIDA = { ancho: 1600, alto: 1100, texto: '1600 × 1100 px (proporción 16:11, apenas más ancho que alto)' };

const FORMATO = `FORMATO
- Tamaño exacto: ${MEDIDA.texto}. Sin bordes ni marcos, a sangre.
- Archivo PNG o JPG de buena calidad.
- En el celular se ve chico: letras grandes y pocas palabras, que se lean bien en una pantalla de 10 cm.

ESTILO E IDENTIDAD (respetar siempre)
- Lujo minimalista y nocturno. Fondo negro cálido (#0B0A09) con texturas sutiles de piedra oscura o terciopelo.
- Un haz de luz dorada suave entrando de costado, como en una vidriera de noche.
- Color de acento: dorado (#C9A35C y #E3C27E). Texto claro en marfil (#EDE7DB). Nada de colores saturados, neón ni degradados de colores.
- Tipografía elegante, en MAYÚSCULAS, fina y con mucho espaciado entre letras (estilo Tenor Sans / Didot fino).`;

const MARGENES = '- Dejá un margen libre de 8% en todos los bordes, y la franja de abajo (12% del alto) sin nada importante: ahí van los puntitos que pasan los banners.';

/** Prompt para cualquier IA de imágenes (ChatGPT, Gemini, Midjourney, Ideogram, Canva…). */
export function promptBanner({ titulo = '[TÍTULO]', texto = '[TEXTO CORTO]', sello = '', producto = '[PERFUME O MARCA]' } = {}) {
  return `Creá un banner publicitario para "ESSENZE · Parfum & Decants", una perfumería de lujo de Córdoba, Argentina.

${FORMATO}
- Producto protagonista: ${producto}. Frasco nítido, fotorrealista, apoyado sobre un pedestal de piedra oscura, con reflejo y brillo dorado. Si adjunto una foto del perfume, usá ese frasco tal cual, sin cambiar la etiqueta ni la forma.

COMPOSICIÓN
- Texto a la IZQUIERDA (como máximo la mitad del ancho), producto a la DERECHA.
${MARGENES}

TEXTO (escribirlo EXACTAMENTE así, en español, sin agregar otras palabras)
- Título: "${titulo}"
- Bajada: "${texto}"${sello ? `\n- Sello circular dorado con el texto: "${sello}"` : ''}

NO INCLUIR
- Logos inventados, marcas de agua, precios, direcciones web, personas, manos, flores de colores, ni texto adicional.`;
}

/** Prompt para que otra IA haga un banner con el cocodrilo de Essenze (adjuntando las imágenes de referencia). */
export function promptCocodrilo({ titulo = 'EL LUJO EN CADA NOTA', texto = 'Perfumes árabes, de diseñador y de nicho', escena = 'el cocodrilo elegante, de pie, sosteniendo un frasco de perfume dorado' } = {}) {
  return `Creá un banner para "ESSENZE · Parfum & Decants", una perfumería de lujo de Córdoba, Argentina, con la mascota de la marca: un cocodrilo.

IMPORTANTE: te adjunto imágenes del cocodrilo y del logo. Usá ESE MISMO personaje, con el mismo estilo de dibujo, colores y proporciones. No inventes otro cocodrilo ni cambies el logo.

${FORMATO}

ESCENA
- ${escena}.
- El cocodrilo a la DERECHA, ocupando más o menos la mitad del ancho, bien iluminado con luz dorada.
- El logo de Essenze (el que adjunto) chico y prolijo, arriba del texto o en una esquina, sin deformarlo.

COMPOSICIÓN
- Texto a la IZQUIERDA (como máximo la mitad del ancho).
${MARGENES}

TEXTO (escribirlo EXACTAMENTE así, en español, sin agregar otras palabras)
- Título: "${titulo}"
- Bajada: "${texto}"

NO INCLUIR
- Otros personajes, personas, marcas de agua, precios, direcciones web ni texto adicional.`;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Prompt copiado: pegalo en la IA');
  } catch {
    aviso('No se pudo copiar automático: seleccioná el texto y copialo.', 'error');
  }
}

function proporcionOk(img) {
  const esperado = MEDIDA.ancho / MEDIDA.alto;
  return Math.abs(img.ancho / img.alto - esperado) / esperado < 0.08;
}

// Imágenes del cocodrilo y del logo para adjuntarle a la IA (se descargan con un toque).
const REFERENCIAS = [
  ['/video/cocodrilo-logo-v1.webp', 'El cocodrilo con el logo'],
  ['/img/cocodrilo-bolsas.webp', 'Cocodrilo con bolsas'],
  ['/img/cocodrilo-frasco.webp', 'Cocodrilo con un frasco'],
  ['/img/cocodrilo-sentado.webp', 'Cocodrilo sentado'],
  ['/img/logo-completo.png', 'Logo de Essenze'],
];

/** Hoja con el prompt del banner del cocodrilo para hacerlo en otra IA. */
export function dialogoCocodriloIA() {
  const h = hoja({
    titulo: 'Banner del cocodrilo con IA',
    ancho: 680,
    html: `
      <p class="campo__ayuda">Para hacer un banner con el cocodrilo en ChatGPT, Gemini u otra IA de imágenes:</p>
      <ol class="pasos-import">
        <li><span>Bajá estas imágenes y adjuntáselas a la IA, así dibuja el mismo cocodrilo.</span></li>
        <li><span>Copiá el prompt y pegalo.</span></li>
        <li><span>Cuando la IA lo haga, subilo con <strong>Cargar banner</strong>. Si querés que reemplace al animado, apagá el banner animado del cocodrilo.</span></li>
      </ol>
      <div class="referencias-ia">${REFERENCIAS.map(([src, texto]) => `
        <a class="referencia-ia" href="${src}" download><img src="${src}" alt=""><span>${icono('bajar')} ${texto}</span></a>`).join('')}</div>
      <div class="form-grilla form-grilla--2">
        <label class="campo"><span>Título</span><input data-p="titulo" value="EL LUJO EN CADA NOTA"></label>
        <label class="campo"><span>Bajada</span><input data-p="texto" value="Perfumes árabes, de diseñador y de nicho"></label>
        <label class="campo ancho-total"><span>Qué hace el cocodrilo</span><input data-p="escena" value="el cocodrilo elegante, de pie, sosteniendo un frasco de perfume dorado"></label>
      </div>
      <textarea class="entrada prompt-banner" rows="10" readonly data-prompt></textarea>`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cerrar</button><button class="boton boton--lleno" type="button" data-copiar>${icono('copiar')} Copiar prompt</button>`,
  });
  const d = h.dialogo;
  const pintar = () => {
    const v = (k) => d.querySelector(`[data-p="${k}"]`).value.trim();
    d.querySelector('[data-prompt]').value = promptCocodrilo({ titulo: v('titulo'), texto: v('texto'), escena: v('escena') });
  };
  d.addEventListener('input', (e) => { if (e.target.matches('[data-p]')) pintar(); });
  d.querySelector('[data-copiar]').addEventListener('click', () => copiar(d.querySelector('[data-prompt]').value));
  pintar();
  return h.cerrada;
}

/**
 * Hoja "Cargar banner": prompt para la IA + subida del archivo (una sola imagen 16:11 para compu y celular).
 * @param {object|null} oferta  banner existente para editar
 * @param {Array<[string,string]>} enlaces  opciones de destino [valor, texto]
 */
export async function dialogoBanner(oferta, enlaces) {
  const o = oferta || { titulo: '', texto: '', etiqueta: '', enlace: '/catalogo?oferta=1', imagen: null, activa: true, desde: '', hasta: '' };
  const estado = { imagen: o.imagen };
  const h = hoja({
    titulo: oferta ? 'Editar banner' : 'Cargar banner',
    ancho: 680,
    html: `
      <details class="tarjeta-admin" ${oferta ? '' : 'open'}>
        <summary class="tarjeta-admin__titulo" style="margin:0">1 · Pedirle el banner a la IA ${icono('abajo')}</summary>
        <div style="display:grid;gap:12px;margin-top:12px">
          <p class="campo__ayuda">Completá estos datos, copiá el prompt y pegalo en ChatGPT, Gemini, Ideogram o la IA que uses. Si podés, adjuntale también una foto del perfume. Es <strong>una sola imagen</strong> de 1600 × 1100: se ve igual en la compu y en el celular. Para uno con el cocodrilo, usá "Hacerlo con IA" en la tarjeta del cocodrilo.</p>
          <div class="form-grilla form-grilla--2">
            <label class="campo"><span>Título del banner</span><input data-p="titulo" value="${escapar(o.titulo)}" placeholder="Ej. SEMANA LATTAFA"></label>
            <label class="campo"><span>Sello (opcional)</span><input data-p="sello" value="${escapar(o.etiqueta)}" placeholder="Ej. 20% OFF"></label>
            <label class="campo ancho-total"><span>Bajada</span><input data-p="texto" value="${escapar(o.texto)}" placeholder="Ej. Khamrah, Asad y Yara con precio especial"></label>
            <label class="campo ancho-total"><span>Perfume o marca protagonista</span><input data-p="producto" placeholder="Ej. Lattafa Khamrah, frasco ámbar facetado con tapa dorada"></label>
          </div>
          <textarea class="entrada prompt-banner" rows="9" readonly data-prompt></textarea>
          <button class="boton boton--contorno" type="button" data-copiar>${icono('copiar')} Copiar prompt</button>
        </div>
      </details>

      <section class="tarjeta-admin">
        <h3 class="tarjeta-admin__titulo">2 · Subir lo que hizo la IA</h3>
        <div class="banner-carga">
          <span class="campo__rotulo">Banner (1600 × 1100)</span>
          <div class="banner-vista banner-vista--mitad" data-vista>${estado.imagen ? `<img src="/foto/${estado.imagen}" alt="">` : '<span>1600 × 1100</span>'}</div>
          <label class="boton boton--suave boton--chico">${icono('subir')}<span>Elegir archivo</span><input type="file" accept="image/*" hidden data-archivo></label>
          <p class="campo__ayuda" data-aviso>Se ve igual en la compu y en el celular.</p>
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
  });
  const pintarPrompt = () => { $('[data-prompt]').value = promptBanner(datosPrompt()); };
  d.addEventListener('input', (e) => { if (e.target.matches('[data-p]')) pintarPrompt(); });
  $('[data-copiar]').addEventListener('click', () => copiar($('[data-prompt]').value));
  pintarPrompt();

  $('[data-archivo]').addEventListener('change', async (e) => {
    const input = e.currentTarget;
    const archivo = input.files[0];
    input.value = '';
    if (!archivo) return;
    const vista = $('[data-vista]');
    const avisoEl = $('[data-aviso]');
    vista.innerHTML = '<div class="cargando"><span></span><span></span><span></span></div>';
    try {
      const procesada = await procesarBanner(archivo, { ancho: MEDIDA.ancho });
      vista.innerHTML = `<img src="${urlTemporal(procesada.blob)}" alt="">`;
      avisoEl.textContent = proporcionOk(procesada)
        ? `Listo (${procesada.ancho} × ${procesada.alto}).`
        : `Ojo: mide ${procesada.ancho} × ${procesada.alto}, no tiene la proporción 16:11. Se va a recortar un poco en los bordes; mejor pedile a la IA el tamaño exacto.`;
      estado.imagen = (await subirImagen(procesada)).id;
    } catch (err) {
      vista.innerHTML = '<span>No se pudo cargar</span>';
      avisoError(err);
    }
  });

  $('[data-guardar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    if (!estado.imagen) return aviso('Subí la imagen del banner.', 'error');
    const titulo = $('[data-p="titulo"]').value.trim() || 'Banner';
    const datos = {
      formato: 'banner',
      titulo,
      texto: $('[data-p="texto"]').value.trim(),
      etiqueta: $('[data-p="sello"]').value.trim(),
      boton: 'Ver más',
      enlace: $('[data-enlace]').value,
      imagen: estado.imagen,
      imagen_movil: null,
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
