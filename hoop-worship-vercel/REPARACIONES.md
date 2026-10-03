# Hoop Worship: importación, fotos y transposición

Fecha de revisión: 2 de octubre de 2026.

## Estado y alcance

La corrección está implementada en el proyecto local y preparada para el Worker existente `hidden-base-256e`. No se ha publicado en la cuenta: Wrangler informa que no hay una sesión autenticada. La página pública conserva su versión anterior.

Se revisaron la aplicación, sus plantillas, estilos, datos iniciales, almacenamiento y el recorrido real de añadir, editar, guardar, abrir y transponer. El proyecto no tenía una suite de pruebas. Se añadieron pruebas del motor, del estado de la aplicación, del servicio y del lector HTML en un navegador real.

La nueva publicación conserva solo los ejemplos **Sin Reservas** y **Hay Momentos**, tomados del paquete anterior. El archivo histórico `data.js` del repositorio se conserva. No se borran canciones, fotos, favoritos, grupos ni registros de papelera del navegador. Las pruebas de interfaz se hicieron en un origen local separado de producción.

## Diagnóstico y correcciones

| Fallo | Causa concreta | Corrección |
| --- | --- | --- |
| Un enlace no añadía letra ni acordes | El flujo anterior deducía título y artista del enlace, sin descargar la canción | Botón de importación, servicio de lectura y extracción del bloque musical; errores explícitos |
| La Cuerda podía devolver contenido incompleto | Su enlace principal contiene varias vistas previas truncadas | El servicio sigue un enlace real de «Letra y Acordes», elige la versión canónica si aparece en la lista y guarda su dirección; informa que existen otras versiones |
| Se perdían espacios o aparecían notas distintas al abrir | La detección dependía de tokens ambiguos y la presentación volvía a interpretar el texto | Motor común para importación, destinos de fotos y lectura; columnas derivadas del original y espacios/tabulaciones normalizados de manera consistente |
| Los acordes se desplazaban al transponer | Sustituir un acorde por otro más largo movía las columnas posteriores | Cada acorde tiene una posición visual fija; se transpone desde el original y se reserva el ancho necesario para todas las tonalidades |
| Bajos alternativos y símbolos fallaban | Reconocimiento parcial, notas enarmónicas incompletas y sufijos interpretados como parte de la raíz | Lectura separada de raíz, cualidad/extensiones y bajo; desplazamiento cromático independiente de raíz y bajo |
| Las fotos no tenían destino musical | Solo existía una imagen general de la canción y su lectura OCR | Campo adicional de fotos por aparición del acorde, con selección, pegado, subida y reasignación explícita |
| La lectura de una foto o una importación podía reemplazar una corrección manual | La respuesta asíncrona escribía directamente en el editor | Vista previa cuando ya hay texto o cuando se escribió mientras llegaba la respuesta; respuestas tardías descartadas al cerrar o cambiar el enlace |
| Editar un ejemplo podía fallar o duplicarlo al recargar | Se editaba solo la lista de canciones guardadas y luego se concatenaba con los ejemplos | Una edición crea una versión guardada con el mismo identificador y esta prevalece sobre el ejemplo; se conservan campos desconocidos |

## Flujo completo

1. El usuario pega un enlace y pulsa **Importar canción**. No se guarda ningún ítem por esa acción sola.
2. Se comprueba la dirección. Cifra Club y La Cuerda se leen mediante `POST /api/import-song` del mismo sitio. Otros enlaces HTML/texto usan lectura directa del navegador y pueden estar bloqueados por CORS.
3. El servicio acepta únicamente los hosts previstos, HTTP/HTTPS sin credenciales ni puertos especiales, y una ruta de canción. Normaliza a HTTPS y revisa cada redirección. No reenvía cookies, claves ni datos de las canciones guardadas.
4. La respuesta se limita a 2 MB, se comprueba su tipo y se decodifica sin sustituir caracteres ilegibles. Se admiten UTF-8 y Latin1/Windows-1252. El tiempo máximo de la fuente es 12 segundos; la interfaz espera como máximo 15.
5. El lector HTML trabaja en un documento separado. No inserta HTML remoto en la página. Extrae los bloques musicales y metadatos; excluye scripts, estilos e iframes. Si omite bloques secundarios, encuentra marcas no reconocidas o no puede asociar acordes marcados, lo informa.
6. Se preservan líneas y espacios. Se admiten acordes encima de la letra y formato ChordPro como `[Am7]Hoy [C/G]canto`. En este último, los acordes aparecen sobre las sílabas correspondientes.
7. Un editor vacío recibe el resultado. Un editor con contenido muestra una vista previa que exige **Usar contenido importado** antes de reemplazarlo. Descartar la importación conserva el texto anterior.
8. **Add Item / Save Changes** guarda el original. Un error de almacenamiento revierte la operación y conserva los datos anteriores.
9. Al abrir la canción, el mismo motor reconoce las posiciones. Los botones de semitono mantienen un desplazamiento acumulado aplicado al original. No modifican el contenido almacenado.

## Acordes y transposición

Raíz y bajo se representan como alturas cromáticas de 0 a 11. Cada clic suma o resta exactamente uno a ambos. El sufijo se conserva literalmente. La elección entre sostenidos y bemoles sigue la tonalidad declarada o la escritura del acorde; puede producir una escritura enarmónica equivalente. No es un generador de armonización por grados.

| Familia | Ejemplos cubiertos |
| --- | --- |
| Mayores, menores y otras formas de menor | `C`, `Am`, `Cmin7`, `CmMaj7` |
| Sostenidos, bemoles y dobles alteraciones | `F#`, `Bb`, `F♯`, `B#`, `Cb`, `F𝄪`, `Cbb` |
| Séptimas y extensiones | `Am7`, `Cmaj7`, `Dbmaj9`, `C6/9`, `C13` |
| Disminuidos y semidisminuidos | `Bdim7`, `C°7`, `Cø7`, `Cm7b5` |
| Suspendidos y aumentados | `Csus4`, `C7sus4`, `D4`, `Caug`, `C+` |
| Tensiones y alteraciones | `C(add9)`, `C7(b9,#11)`, `Calt` |
| Inversiones y bajos alternativos | `C/G`, `B/Eb`, `C7/Gb`, `F♯m7/B` |
| Solfeo | `Do`, `Lam7`, `Do/Re` |

Por ejemplo, `Am7` pasa a `A#m7`, y `C/G` pasa a `C#/G#` al subir un semitono con escritura de sostenidos. `Bb` pasa a `B`. Subir y después bajar desde los controles devuelve también la escritura original, incluidas sus alteraciones.

Las indicaciones de cejilla como `{capo: 2}` se conservan. La cejilla física no se modifica automáticamente. Una foto de digitación mantiene su forma original y su leyenda lo indica; no se presenta como una digitación nueva del acorde transpuesto.

Los nombres cercanos se distribuyen en filas visuales adicionales cuando hace falta espacio. Se reserva ese espacio desde el principio para que la altura, el ancho y los destinos no cambien al transponer. La letra original y las columnas de entrada se conservan.

## Fotos y compatibilidad de datos

Se añaden campos opcionales `schemaVersion: 2` y `chordImages`. Cada foto contiene `id`, `line`, `column`, `chord`, `sourceLine` y `dataUrl`. `line` y `column` usan índices desde cero; las opciones de interfaz muestran índices desde uno. Las columnas de una línea con tabulaciones se calculan expandiéndolas cada ocho espacios.

La foto se asocia a una aparición concreta, no a todas las apariciones del mismo acorde. Se muestra debajo de su línea de letra correspondiente para mantener juntos los acordes y la letra. No tapa ni sustituye notas. En formato ChordPro se guarda la columna del texto original y se calcula por separado la columna visual de la sílaba.

Si se inserta una línea y la antigua línea musical aparece una sola vez, el destino se puede conservar. Si se cambia el acorde, se cambia su línea o hay varios destinos posibles, la foto permanece guardada con **Destino pendiente**. El usuario selecciona el nuevo acorde y pulsa **Mover al destino seleccionado**. No se adivina otra asociación.

La imagen general anterior permanece en `originalImageData`. El OCR sigue disponible como transcripción aproximada, separado de las fotos por acorde. Se admiten JPG, PNG, BMP y WebP de hasta 3 MB; las imágenes no se envían al servicio de importación. Si el navegador agota su almacenamiento, la aplicación informa el fallo y revierte el guardado.

No se ejecuta una migración destructiva. Los campos nuevos son opcionales, los identificadores se conservan, se respeta la organización existente y se mantienen campos desconocidos al editar. La inicialización no reescribe la biblioteca.

## Pruebas ejecutadas

### Automatizadas: 65 pasan, 0 fallan

`node --test tests/*.test.mjs`

- 33 ejemplos explícitos de un semitono, más comprobación de cada uno desde −24 hasta +24 semitonos: cualidad y bajo conservados, distancia exacta.
- Unicode, solfeo, alteraciones dobles, acordes inválidos, reset, lectura de extensiones sin retroceso excesivo, preferencia de alteraciones por tonalidad, barras, repeticiones, tabulaciones y espacios no separables.
- Acordes en líneas separadas, ChordPro, nombres largos cercanos, columnas y alturas visuales estables.
- Fotos conservadas, líneas insertadas, destinos ambiguos, reasignación, pegado desde el portapapeles y rechazo de SVG.
- Guardado, recarga, edición de ejemplos, campos anteriores conservados, registros de purga respetados y reversión ante almacenamiento lleno.
- Importación en un editor vacío, vista previa, edición concurrente, respuestas tardías, servicio ausente o bloqueado y OCR sin sobrescritura manual.
- Validación de enlaces, redirecciones, tamaños, tipos, codificación, origen de solicitudes, JSON inválido, HTTP de error y tiempo máximo.
- Respuestas simuladas representativas de una lista de versiones de La Cuerda y su canción completa.

### Navegador: 8 pasan, 0 fallan

Con el servidor local: abrir `/tests/browser.html`. Incluye HTML representativo, varios bloques, seguridad del texto, metadatos, ChordPro y las dos lecturas reales descritas a continuación. Las lecturas reales dependen de la disponibilidad futura de las fuentes y se identifican como tales.

### Lecturas externas reales

| Entorno | Cifra Club: Hay Momentos | La Cuerda: Hay Momentos |
| --- | --- | --- |
| Servicio Node local | Importación completa: título, artista, tono C, 34 posiciones y 17 acordes distintos; último verso presente | Importación completa desde una versión `.shtml`: 30 posiciones, 14 acordes distintos, título/artista y último verso presentes |
| Entorno local de Cloudflare con Wrangler/workerd | **Bloqueo HTTP 403 de la fuente**; el servicio devuelve un error claro | HTTP 200 y versión completa `hay_momentos.shtml` |
| Producción en la cuenta del usuario | Pendiente de publicar y verificar | Pendiente de publicar y verificar |

Fuentes comprobadas: [Cifra Club](https://www.cifraclub.com/danilo-montero/hay-momentos/?instrument=keyboard) y [La Cuerda](https://acordes.lacuerda.net/danilo_montero/hay_momentos).

### Interfaz real

Se comprobó: pegar el enlace, importar, elegir el destino `B/Eb`, subir una imagen, guardar, recargar y abrir. Después de subir un semitono se contaron 34 acordes; `G` pasó a `G#` y `B/Eb` a `C/E`. Se compararon las columnas, filas visuales, texto de letra e imagen: permanecieron iguales. Bajar recuperó los nombres y posiciones originales.

También se comprobó pantalla completa, ajuste automático, reducción de 17 a 16, conservación de letra/foto y salida. Un enlace incompleto mostró su error y conservó los 677 caracteres de la canción. Pegar una imagen en el editor creó una segunda vista previa en el destino elegido; cancelar dejó intacta la canción guardada.

`wrangler deploy --dry-run` compiló correctamente el Worker y reconoció el enlace `ASSETS`. `wrangler dev --local` sirvió la interfaz y el servicio con la misma configuración. Su observador de archivos mostró una advertencia local; se reconstruyeron los archivos y se reinició el entorno para comprobar la versión final.

## Archivos afectados

| Archivo | Función |
| --- | --- |
| `song-engine.js` | Análisis, importación de texto/HTML, transposición, posiciones y asociación de fotos |
| `app.js` | Importación asíncrona, vistas previas, fotos, OCR, guardado compatible y datos para presentación |
| `index.html` | Botón de importar, vista previa, elección de foto y presentación de acordes por columnas |
| `styles/style.css` | Filas de acordes, fotos y vista previa |
| `server/import-service.mjs` | Servicio de importación y entrada del Worker con archivos estáticos |
| `wrangler.jsonc` | Configuración del Worker existente y ruta de importación |
| `scripts/build.mjs`, `scripts/dev-server.mjs` | Generación de la publicación y servidor local |
| `sample-data.js` | Las dos muestras de la publicación anterior, sin cambiar sus letras |
| `package.json`, `package-lock.json`, `.gitignore` | Comandos reproducibles, Wrangler fijado y exclusión de archivos generados |
| `tests/engine.test.mjs`, `tests/app.test.mjs`, `tests/service.test.mjs` | Pruebas automatizadas |
| `tests/browser.html`, `tests/browser-tests.js` | Pruebas del importador HTML con un navegador real |
| `REPARACIONES.md` | Diagnóstico, decisiones, resultados y límites |

Los archivos de interfaz ya incluían modificaciones del trabajo anterior. Se conservaron; esta revisión se limita a importación, fotos, presentación musical y transposición.

## Publicación en Cloudflare

El paquete contiene el proyecto, su servicio y la carpeta `dist` con los archivos públicos. **Subir solo `dist` mediante arrastrar archivos no instala el servicio**. Debe publicarse el proyecto como Worker usando su configuración. Cloudflare admite archivos estáticos y lógica de servicio en el mismo Worker: [documentación de configuración y enlaces](https://developers.cloudflare.com/workers/static-assets/binding/).

En un equipo con Node.js y npm, desde la carpeta del proyecto:

```sh
npm ci
npm test
npx wrangler login
npm run deploy
```

Antes de publicar, comprobar que la cuenta seleccionada contiene `hidden-base-256e`. El inicio de sesión de Wrangler debe completarlo el titular en Cloudflare. El nombre del Worker se conserva para actualizar la dirección actual. No hacen falta base de datos ni migraciones para esta corrección.

Después de publicar, probar ambas fuentes en la dirección pública. El resultado local de workerd no garantiza que Cifra Club permita solicitudes desde la infraestructura de producción. La cuenta no estaba autenticada durante esta revisión y no se publicó una versión temporal en otra cuenta.

## Limitaciones restantes

- Cifra Club bloqueó la solicitud en workerd con 403. No se intentó eludir ese bloqueo. Se puede copiar su letra y acordes en el editor. La importación automática de esa fuente en producción permanece sin verificar.
- Las fuentes pueden cambiar HTML, requerir acceso o devolver CAPTCHA. Se informa el error y se conserva la canción; no se garantiza contenido que la fuente no permite leer.
- El servicio automático se limita a Cifra Club y La Cuerda. Otros enlaces dependen de los permisos de lectura del navegador. No se importan PDF, audio ni capturas como si fueran HTML.
- Una línea formada solo por `A`, `Do` u otra nota puede ser letra o acorde. Se mantiene la convención de líneas de acordes; `[A]` permite marcar explícitamente una nota. Los formatos no reconocidos se conservan y se señalan cuando se detecta incertidumbre. Se limita cada nombre de acorde a 128 caracteres para evitar entradas patológicas.
- El OCR puede equivocar notas y posiciones. Se mantiene la foto original y una advertencia de revisión; no se afirma exactitud de una transcripción automática de imagen.
- Las fotos no generan nuevas digitaciones al transponer. Se conserva su contenido original. Una edición ambigua requiere reasignación.
- El texto exportado por `transposeText` puede requerir espacio adicional si dos nombres crecientes no caben juntos. La presentación usa columnas fijas y filas reservadas para impedir solapamientos y cambios de ubicación.
- Canciones y fotos siguen guardadas por navegador/origen; esta corrección no introduce sincronización entre usuarios o dispositivos. Cambiar de dominio no traslada esos datos automáticamente.
- Permanecen los recursos externos anteriores de estilo y OCR. El OCR requiere descargar su biblioteca/modelo y el almacenamiento del navegador tiene un límite.

## Versión preparada para Vercel

`vercel.json` ejecuta el mismo armado de archivos públicos en `dist`. La función `api/import-song.mjs` reutiliza `server/import-service.mjs`, por lo que la interfaz llama a la misma ruta `/api/import-song` sin cambios. Se puede subir la carpeta completa del proyecto o conectarla a un repositorio en Vercel. Para usar la función, hace falta publicar el proyecto completo: la carpeta `dist` por sí sola contiene únicamente la interfaz.

Vercel asignará una dirección `*.vercel.app` al proyecto una vez publicado. Las canciones y fotos se guardan en el navegador y están asociadas a la dirección de cada sitio; visitar la nueva dirección no copia los datos del sitio de Cloudflare. Las dos canciones de muestra sí vienen en la publicación.

El cambio de alojamiento no garantiza acceso automático a Cifra Club. Esa fuente ha respondido HTTP 403 a la lectura del servicio en Cloudflare. La versión en Vercel debe comprobarse con un enlace real después de publicarse; si la fuente también lo bloquea, el usuario puede pegar la letra y los acordes en el editor.

## Efectos posteriores

Una fuente nueva o un cambio de su estructura debe incorporarse con una prueba específica antes de afirmar compatibilidad. Las fotos mantienen su identidad musical de origen, por lo que el músico debe distinguir el nombre transpuesto de la digitación fotografiada. La conservación del texto original permite volver al estado inicial sin acumular errores de transposición.
