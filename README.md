# Essenze · Parfum & Decants

La tienda online y el panel de administración de Essenze. Todo corre en Cloudflare, en el plan gratis:
- **Pages** sirve la web.
- **Pages Functions** es la API.
- **D1** es la base de datos, con las fotos incluidas.

Para publicarla, seguí **[GUIA-PUBLICAR.md](GUIA-PUBLICAR.md)**.

## Qué hay

**Tienda** (`/`, `/catalogo`, `/perfume?p=…`)
- Cartelera de ofertas que se arma desde el panel, con cinta de marcas y vidriera de destacados.
- Catálogo con filtros: tipo, marca (con buscador), género, acorde, familia, estación y ocasión. También tiene búsqueda por nota y carga progresiva.
- Buscador de la cabecera con sugerencias mientras se escribe (foto, marca, nombre y precio), navegable con las flechas.
- **El cocodrilo de la marca** (cruza tirando de una cinta dorada que dibuja el logo):
  - Banner animado en la cartelera, con el estilo de los banners de IA (se prende/apaga y se le cambian los textos en Panel → Ofertas; nunca sale primero). También en el pie de página (al llegar al final), la pantalla de "pedido enviado" y el ingreso al panel.
- La cartelera mezcla los banners al azar en cada visita y pasa cada uno a los 3 segundos.
  - Ilustraciones enteras (sin recortar), una por lugar: con dos bolsas en la bolsa vacía, de mozo con la bandeja en la búsqueda sin resultados, abrazado a un frasco en el catálogo sin resultados y sentado sobre un frasco en las páginas de error.
  - Los videos están en `web/video` (copias livianas de los de `banners`) y las ilustraciones en `web/img/cocodrilo-*.webp`. Tienen fondo negro y se funden con el fondo oscuro de la tienda. Con "reducir movimiento" o ahorro de datos se ve solo el logo quieto.
- Franja de confianza bajo la cartelera: perfumes 100% originales, envíos a todo el país o retiro en la ciudad cargada en Ajustes, y medios de pago (transferencia, efectivo, tarjeta con link de Mercado Pago). Para cambiar esos textos hay que editar `garantias()` en `web/js/interfaz.js`. La ficha muestra una versión corta debajo del botón de compra.
- **Favoritos:**
  - El corazón está en cada tarjeta y en la ficha.
  - Los favoritos se guardan en el navegador del cliente, sin cuenta.
  - En la página `/favoritos` se comparan lado a lado: tamaños y precios, familia, acordes, notas y cuándo usarlo. Desde ahí se agregan a la bolsa o se consulta por todos juntos por WhatsApp.
  - En la computadora se llega con el corazón de la cabecera; en el celular, desde el menú.
- Ficha con foto en relieve (se inclina con el dedo o el mouse), giro 360° si tiene fotos y visor 3D si tiene modelo `.glb`. Muestra notas, acordes, cuándo usarlo y perfumes parecidos.
- Bolsa de compras: en el celular se abre como hoja inferior que se cierra deslizando.
- **Stock: entrega inmediata o a pedido.** Todo se puede pedir. Lo que está marcado en stock en el panel sale como "Entrega inmediata" en la tarjeta, la ficha y la bolsa, y se puede filtrar en el catálogo. El filtro no aparece si no hay nada en stock, y se puede apagar en Ajustes (por ejemplo, cuando hay pocos). El resto es "a pedido": lo compran cuando entra el pedido. El mensaje de WhatsApp aclara qué es de entrega inmediata y qué es a pedido.
- El pedido se manda por WhatsApp y además queda guardado en el panel. Para enviarlo hay que tildar que se aceptan los Términos y la Política de privacidad.
- **Términos y condiciones** (`/terminos`) y **Política de privacidad** (`/privacidad`), enlazadas en el pie y en el formulario del pedido. Los textos se editan en `web/terminos.html` y `web/privacidad.html`.
- Precios en dólares, o en pesos si se prende en Ajustes. Con pesos, el valor en dólares queda oculto salvo que se prenda "Mostrar también el precio en dólares".

**Panel** (`/admin`, se instala en el celular como app)
- **Inicio:** pedidos nuevos, ventas, saldo y margen del mes, más vendidos y stock bajo.
- **Perfumes:** búsqueda, filtros (por ejemplo "En stock") y botones rápidos para marcar el stock (ícono de caja: cuántos tienen de cada tamaño), destacar u ocultar. El editor maneja:
  - Fotos con recorte automático del fondo blanco, desde archivo, desde un link o con Ctrl+V.
  - Fotos 360° y modelo 3D.
  - Tamaños con precio, precio anterior, costo, stock (vacío = a pedido; al cobrar una venta se descuenta solo) y margen.
  - Aroma, con la opción de pegar el texto copiado de Fragrantica.
- **Pedidos:** se pasan por nuevo → confirmado → cobrado → entregado, con WhatsApp directo al cliente. También se registran ventas hechas fuera de la web.
  - **Editar** cambia todo de una venta (perfumes, cantidades, precios, costos, cliente, fecha, estado, cobro y comisión); si ya estaba cobrada, la caja y el stock se rehacen con el dólar de esa venta.
  - El costo se carga en dólares (o en pesos, eligiéndolo arriba de los perfumes) y queda en dólares como último costo del perfume: la próxima venta lo trae solo, con su equivalente en la otra moneda.
- **Caja:** ingresos y gastos (en USD o pesos), saldo, margen, gráfico de 6 meses, gastos por categoría y planilla CSV.
- **Ofertas:** diapositivas de la cartelera con fechas de inicio y fin, y descuentos por marca, por tipo o por búsqueda.
- **Importar Excel:** lee el catálogo con sus fotos y muestra qué cambia antes de guardar.
- **Ajustes:** WhatsApp, ciudad, Instagram, valor del dólar, precios en pesos y/o dólares, filtro "Entrega inmediata" y copia de seguridad.

## Estructura

```
web/                  sitio estático (lo que publica Cloudflare Pages)
  index.html, catalogo.html, perfume.html
  css/estilos.css     estilos de la tienda
  js/                 tienda: datos, bolsa, tarjetas, visor, animaciones
  admin/              panel: index.html, admin.css, js/ (vistas, Excel, fotos)
  img/                logo y favicons
  _headers            encabezados de seguridad
functions/            API (Cloudflare Pages Functions)
  api/catalogo.js     catálogo público, guardado en caché por versión
  api/perfumes/[id]   ficha
  api/pedidos.js      guardar pedidos de la web
  api/admin/…         todo lo del panel (requiere sesión)
  foto/[id].js        fotos guardadas en D1
lib/                  código compartido de la API
migraciones/          esquema de la base de datos (SQL)
```

## Probarlo en la compu (opcional)

Necesitás Node.js y la herramienta de Cloudflare (`wrangler`).

> Ojo: en Windows, el "&" del nombre de la carpeta rompe los atajos de npm.
> Si querés probar localmente, renombrá la carpeta a algo como `Essenze Parfum y Decants`.

```bash
npx wrangler d1 migrations apply essenze --local
```

```bash
npx wrangler pages dev --port 8788
```

Abrí http://localhost:8788. El panel queda en http://localhost:8788/admin, con la contraseña de `.dev.vars`.
Para esto se usa un `wrangler.toml` local, que no se sube a GitHub.

## Fotos: cómo mejorarlas

**Fotos en lote (Panel → Importar Excel → Fotos en lote):** se elige una carpeta con fotos que se llaman como el perfume en el link de la tienda (`afnan-9pm-eau-de-parfum.webp`) y cada una va sola a su perfume. Muestra el antes y el después, reemplaza las fotos y borra las viejas que quedan sin uso. Si se corta, se vuelve a elegir la misma carpeta y sigue desde donde quedó.
Cada foto se guarda dos veces: la grande (1100 px) para la ficha y una chica (560 px) para las tarjetas, la bolsa y el panel. Así el catálogo carga liviano en el celular.
La carpeta `PERFUMES/para_la_web` ya tiene las 1201 fotos buenas preparadas así (recortadas, con margen parejo y fondo transparente).

Las fotos que vienen dentro del Excel son chicas (240 px). Al importarlas, el panel les quita el fondo blanco.
Para cambiar fotos de a una:

1. **Desde un link (lo más rápido):** buscá el perfume en la web de la marca o en Google Imágenes, abrí la imagen más grande y copiá su dirección. En el editor tocá **Pegar link**: se recorta sola.
2. **Foto propia:** frasco sobre una hoja blanca, luz de día de costado, celular a la altura del frasco. Subila con **Subir**: el fondo blanco se quita solo.
   Para un recorte perfecto, sacala con la app gratuita **Photoroom** (quita el fondo con IA) y subí el PNG.
3. **Giro 360°** (para los perfumes estrella): entre 24 y 36 fotos girando el frasco sobre un plato giratorio, siempre con la misma luz y el mismo fondo. Subilas todas juntas en **Giro 360° y 3D**.
4. **Modelo 3D (.glb):** se genera con IA desde una foto (Meshy, Tripo) o escaneando con el celular (Polycam, Luma). Pegá el link en el editor.

## Información de aroma (Fragrantica)

Fragrantica no deja que otros sitios lean sus páginas automáticamente, así que el panel lo resuelve en dos toques:
1. **Buscar en Fragrantica:** abre la búsqueda del perfume.
2. **Pegar texto:** pegás lo que copiaste (acordes y pirámide) y completa notas de salida, corazón, fondo y acordes.

Revisá antes de guardar, y si escribís una descripción, que sea con tus palabras.
