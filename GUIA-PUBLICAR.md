# Guía para publicar Essenze (paso a paso)

Todo corre en **Cloudflare, plan gratis y sin tarjeta**: la tienda, el panel, la base de datos y las fotos.
No hace falta Supabase. El código vive en **GitHub**: cada cambio que subas se publica solo.

Lleva unos 30 minutos la primera vez.

---

## 1. Subir el proyecto a GitHub

Lo más fácil es con **GitHub Desktop**, que no requiere comandos.

1. Creá una cuenta en https://github.com si no tenés.
2. Instalá **GitHub Desktop** (https://desktop.github.com) e iniciá sesión.
3. Elegí **File → Add local repository…** y seleccioná la carpeta `essenze-github` (está en Documentos → Cosas).
   - Si te dice que no es un repositorio, tocá **create a repository** y confirmá con los valores que trae.
4. Abajo a la izquierda escribí un resumen (por ejemplo "Primera versión") y tocá **Commit to main**.
5. Tocá **Publish repository**, dejá tildado **Keep this code private** y confirmá.

> El Excel, las claves de prueba y la configuración local **no se suben**: lo evita el archivo `.gitignore`.
> El catálogo se carga después desde el panel.

---

## 2. Crear la base de datos en Cloudflare

1. Entrá a https://dash.cloudflare.com y creá una cuenta (gratis).
2. En el menú: **Storage & Databases → D1 SQL Database → Create**.
3. Nombre: `essenze`. Ubicación: la que sugiere. Tocá **Create**.
4. Dentro de la base, abrí la pestaña **Console**.
5. Abrí el archivo `migraciones/0001_inicial.sql` con el Bloc de notas, copiá **todo** el contenido, pegalo en la consola y tocá **Execute**.
   - Tiene que aparecer que se ejecutó sin errores. Si la consola acepta una sola instrucción por vez, pegá cada bloque `CREATE TABLE …;` por separado.

---

## 3. Crear el sitio (Cloudflare Pages)

1. En el menú: **Workers & Pages → Create → Pages → Connect to Git** (o "Import an existing Git repository").
2. Conectá tu cuenta de GitHub y elegí el repositorio `essenze`.
3. Configuración de compilación:
   - **Framework preset:** None
   - **Build command:** dejarlo vacío
   - **Build output directory:** `web`
4. Tocá **Save and Deploy**. En un minuto te da una dirección del estilo `https://essenze.pages.dev`.

---

## 4. Conectar la base y las claves

En el proyecto de Pages, entrá a **Settings**:

1. **Bindings → Add → D1 database**
   - Variable name: `DB` (en mayúsculas, exacto)
   - D1 database: `essenze`
   - Guardá. Si te pregunta por "Production" y "Preview", hacelo en los dos.
2. **Variables and Secrets → Add**, de tipo **Secret**:
   - `ADMIN_PASSWORD`: la contraseña del panel. Que sea larga, de 12 caracteres o más.
   - `SESSION_SECRET`: una frase larga cualquiera, de 40 caracteres o más, que no vas a tener que escribir nunca. Sirve para firmar la sesión. Ejemplo de formato (inventá la tuya): `k9Lq-perfume-dorado-7Tz-noche-cordoba-2026-xR`
3. Volvé a **Deployments**, abrí el último y tocá **Retry deployment**, para que tome la base y las claves.

---

## 5. Cargar el catálogo

1. Entrá a `https://essenze.pages.dev/admin` (o tu dominio + `/admin`).
2. Ingresá con la contraseña `ADMIN_PASSWORD`.
3. Andá a **Más → Importar Excel** y elegí `Catalogo para pagina.xlsx`.
4. Revisá el resumen (nuevos, cambios de precio, para revisar) y tocá **Importar**.
   - Con 1.210 perfumes y sus fotos tarda menos de un minuto. No cierres la pestaña mientras importa.
5. Andá a **Ajustes** y revisá el WhatsApp, la ciudad y el valor del dólar.
6. Andá a **Más → Ofertas** y armá la cartelera del inicio.

**Para actualizar precios:** editá el Excel y volvé a importarlo. Se actualizan los precios y se agregan los perfumes nuevos.
Lo que cambiaste a mano en el panel (stock, costos, descripción, fotos) no se pisa.

---

## 6. Usar el panel desde el celular como una app

Abrí `/admin` en el celular:
- **iPhone (Safari):** Compartir → **Agregar a inicio**.
- **Android (Chrome):** menú ⋮ → **Agregar a la pantalla principal**.

Queda un ícono de Essenze que abre el panel a pantalla completa.

---

## 7. Dominio propio (cuando lo tengas)

En el proyecto de Pages: **Custom domains → Set up a custom domain** y seguí los pasos.
Si comprás el dominio en Cloudflare (Domain Registration), se conecta solo.

---

## 8. Copias de seguridad

- **Panel → Ajustes → Descargar copia** una vez por mes. Guardá el archivo en tu Drive.
- Las fotos están en la base de datos. Si alguna vez hiciera falta, se vuelven a cargar importando el Excel.

---

## Límites del plan gratis (de sobra para la tienda)

| Recurso | Límite gratis | Uso estimado |
|---|---|---|
| Visitas a páginas | Ilimitadas | — |
| Consultas a la API y fotos | 100.000 por día | Cada visita usa entre 1 y 30 |
| Base de datos D1 | 5 GB | Hoy unos 15 MB, con 1.210 fotos |
| Lecturas de la base | 5 millones por día | El catálogo queda en caché |
| Escrituras | 100.000 por día | Una importación completa usa unas 5.000 |

Si algún día el tráfico crece mucho, las fotos se pueden pasar a Cloudflare R2. Eso se prepara en una tarde.

---

## Si algo no funciona

| Síntoma | Solución |
|---|---|
| La tienda dice "No pudimos cargar el catálogo" | Revisá que el binding se llame `DB` y que hayas hecho **Retry deployment**. |
| El panel dice "Falta configurar ADMIN_PASSWORD" | Faltan los secretos del paso 4. |
| Error al importar | Volvé a importar el mismo Excel: sigue desde donde quedó, sin duplicar. |
| Cambié algo y no se ve en la tienda | Esperá 30 segundos y recargá: el catálogo queda guardado en caché unos segundos. |
