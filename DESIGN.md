# Design

Sistema visual de Essenze, tomado del sitio construido (`web/css/estilos.css`). El mundo lo fijaron el logo y la referencia del usuario: boutique de perfumería de noche, negro cálido y oro.

## Color (Restrained: neutros + un acento)

| Token | Valor | Uso |
|---|---|---|
| `--negro` | `#0b0a09` | Fondo de página |
| `--superficie` | `#12100e` | Tarjetas, paneles, bandas |
| `--superficie-2` | `#191714` | Reservado |
| `--oro` | `#c9a35c` | Acento: filetes, marca, botón lleno, cifras |
| `--oro-claro` | `#e3c27e` | Hover, texto dorado sobre negro, enlaces |
| `--oro-profundo` | `#8a6a2f` | Barras de desplazamiento |
| `--texto` | `#ede7db` | Texto principal |
| `--texto-2` | `#b5ac9c` | Texto secundario |
| `--texto-3` | `#8f8778` | Metadatos, ayudas (≥4.5:1 sobre negro) |
| `--linea` / `--linea-media` / `--linea-fuerte` | oro al 16 / 30 / 60 % | Filetes de 1px, bordes |
| `--error` | `#e59a7e` | Errores de formulario |

El oro se usa como luz y filete, nunca como relleno de grandes áreas, salvo el botón principal y los sellos de descuento.

## Tipografía

- **Display:** Tenor Sans 400, siempre en mayúsculas con mucho espaciado. Títulos de sección con 0.3em, nombres de perfume con 0.08–0.16em.
- **Texto e interfaz:** Jost 300/400/500. Las etiquetas van en mayúsculas pequeñas con 0.2–0.26em de espaciado.
- Las cifras usan `font-variant-numeric: tabular-nums`.

## Forma y componentes

- Sin esquinas redondeadas. Los contenedores son marcos de filete fino de 1px; las únicas formas circulares son el botón "+" y el sello de oferta.
- **Botones:** `boton--contorno` (borde oro, texto oro claro) y `boton--lleno` (oro, texto negro, peso 500). La altura es de 52px.
- **Tarjeta de producto:** escena oscura con un foco dorado abajo, frasco centrado, y debajo marca en oro, nombre en Tenor y precio con el botón "+". Si el perfume tiene varios tamaños, el "+" abre un selector dentro de la misma tarjeta.
- **Frasco ilustrado** (`js/frasco.js`): SVG con 5 formas, tapa y color de líquido según los datos. La etiqueta gira con el ángulo. Queda reemplazado por fotos 360° o por un `.glb`.
- **Paneles:** bolsa, filtros y búsqueda son `<dialog>` que entran deslizándose (la bolsa desde la derecha, los filtros desde abajo en el celular).

## Movimiento

- Easing de salida `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Momento propio:** un barrido de luz dorada sobre la cartelera al cambiar de oferta, y el frasco que gira al arrastrarlo, con un balanceo corto al cargar la ficha.
- Con movimiento reducido activado, todo queda estático.

## Layout

- Contenedor de 1320px con margen lateral `clamp(16px, 4vw, 48px)`.
- Grillas de 4 columnas en escritorio, 3 en tablet y 2 en el celular.
- El catálogo lleva una barra lateral de 248px, que en el celular se convierte en hoja inferior.
- Por encima de un título siempre hay más espacio que por debajo. Las secciones tienen entre 64 y 128px de separación vertical.

## Panel de administración (modo Operar)

- Mismo mundo (negro cálido y oro), pero priorizando lectura y tareas. Jost a 15px, Tenor Sans solo en títulos de vista, cifras y números de pedido.
- **Celular primero:**
  - Barra inferior de 5 pestañas (Inicio, Perfumes, Pedidos, Caja, Más), con márgenes `safe-area`.
  - Hojas inferiores que se cierran arrastrando.
  - Barra de guardado fija.
  - Entradas de 16px.
- **Escritorio:** lateral de 236px y diálogos centrados.
- **Estados:** nuevo (oro claro), confirmado (azul suave), cobrado y entregado (verde suave), cancelado (gris).
- **Cifras:** grilla de 2 columnas en celular y 4 en escritorio, con el valor en Tenor Sans y cifras tabulares.

## Movimiento (tienda)

- **Curvas:** `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, cajón `cubic-bezier(0.32, 0.72, 0, 1)`.
- **Momento propio:** foto en relieve que se inclina con el puntero o el dedo y un brillo dorado que la recorre. La foto de la tarjeta se transforma en la de la ficha al navegar (View Transitions).
- **Inicio:** títulos que se dibujan de izquierda a derecha, tarjetas que aparecen escalonadas con un destello dorado único, luz que sigue al mouse en la cartelera y cinta de marcas.
- **Al agregar a la bolsa:** el frasco vuela hasta la bolsa, la bolsa late y el celular vibra apenas (Android).
- **Accesibilidad:** con movimiento reducido todo queda estático y la cinta pasa a ser una lista que se desplaza a mano. Los efectos de hover existen solo con mouse.
