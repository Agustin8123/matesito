# Matesito

Aplicación Express + PostgreSQL + Socket.IO, con interfaz web sin compilación.

## Ejecutar

1. Usar Node.js 22 o posterior y ejecutar `npm ci`.
2. Copiar `.env.example` a `.env` y completar la conexión a la base existente, `JWT_SECRET` y `TURNSTILE_SECRET`. `JWT_SECRET` es obligatorio también en desarrollo.
3. Aplicar `schema.sql` siguiendo las instrucciones de actualización de abajo.
4. Ejecutar `npm start`.

En producción, configurar `NODE_ENV=production`, un secreto JWT propio y los orígenes permitidos. La conexión a PostgreSQL usa TLS en producción; `DB_SSL=false` permite configurar explícitamente una base local sin TLS. No se incluyen credenciales ni cambios automáticos de esquema.

## Actualizar a 1.3.7 (incluye 1.3.3–1.3.6)

Esta actualización necesita **aplicar schema.sql con la app detenida antes de arrancar**, también al actualizar desde 1.3.6: incorpora publication_has_media para los permisos y la limpieza de adjuntos múltiples. Para habilitar el buscador nuevo, configurar GIPHY_API_KEY y reiniciar. Agrega bloqueos, denuncias, notificaciones por reacciones, registro de adjuntos e identificadores de envío; amplía el campo de contraseña sin borrar las existentes.

1. Detener el servicio real de Matesito y respaldar PostgreSQL y UPLOAD_DIR mientras no haya escrituras.
2. Instalar FFmpeg con el gestor de paquetes del servidor (en Debian/Ubuntu: `sudo apt install ffmpeg`). Comprobar `ffprobe -version`. Los nuevos audios y videos necesitan este ejecutable; FFPROBE_PATH permite indicar su ruta.
3. Actualizar el código y ejecutar `npm ci --omit=dev`. Sharp instala el procesador de imágenes correspondiente al sistema; no copiar node_modules de Windows a Linux.
4. Aplicar `psql -X --set ON_ERROR_STOP=on --dbname matesito_8s --file schema.sql` con las credenciales reales del servidor.
5. Configurar ADMIN_USER_IDS con los IDs numéricos de las cuentas administradoras. Los propietarios de foros moderan sus propios foros; las denuncias de Inicio requieren un administrador.
6. Si hay un proxy local, configurar TRUST_PROXY=loopback solo cuando ese sea el proxy real. No confiar indiscriminadamente en encabezados de Internet.
7. Reiniciar el servicio. Confirmar /health/live y /health/ready, y recorrer las comprobaciones de abajo.

Las versiones 1.3.3 a 1.3.7 están separadas en el changelog. La versión de instalación es 1.3.7. Las páginas HTML se componen al arrancar: reiniciar después de actualizar plantillas o Versiones.

### Archivos nuevos y privacidad

Los adjuntos nuevos quedan registrados por propietario. Antes de publicarlos solo su propietario puede descargarlos; una referencia pública los hace públicos. Los adjuntos usados únicamente en chats o grupos se entregan a participantes autorizados, respetando el seguimiento mutuo de los grupos. Se sirven sin caché compartida. Los archivos locales anteriores y los enlaces de Cloudinary conservan su comportamiento previo; no se migran ni se descargan.

Las imágenes se decodifican y recodifican sin metadatos personales, con hasta 40 millones de píxeles y 300 cuadros. Las imágenes estáticas tienen variantes de 384 y 960 píxeles. Los audios y videos se inspeccionan con ffprobe, con hasta una hora y 16 millones de píxeles por cuadro; la grabadora sigue limitada a cinco minutos o 10 MB. Los límites por tamaño de subida también se siguen aplicando. Esta inspección no equivale a un antivirus ni garantiza la reproducción en todos los navegadores.

El buscador de GIFs usa GIPHY. Crear una aplicación web/API en https://developers.giphy.com/dashboard/ y configurar GIPHY_API_KEY en .env; reiniciar Node. La clave web se entrega al navegador, que consulta directamente api.giphy.com siguiendo la integración del proveedor; no usar una credencial privada de otro servicio. Revisar los límites y la habilitación para producción en GIPHY. Sin clave se informa que la búsqueda no está configurada; se pueden seguir adjuntando GIFs desde archivos. Los GIFs del catálogo no se presentan como dominio público ni CC0. Los adjuntos anteriores de Wikimedia siguen funcionando.

Los borradores se guardan en memoria por cuenta y destino mientras la página está abierta. Se limpian al cerrar sesión; no se almacenan mensajes privados en el service worker. La pantalla sin conexión y un grupo reducido de recursos públicos sí pueden conservarse.

### Limpieza del almacenamiento

`npm run maintenance` muestra hasta 1.000 archivos registrados sin referencias y con más de siete días. **No borra nada por defecto.** Revisar el listado y el respaldo antes de ejecutar `npm run maintenance -- --apply`. El modo de aplicación vuelve a comprobar las referencias bajo bloqueo, elimina únicamente esos archivos y sus miniaturas, y retira identificadores de envío de más de treinta días. No limpia Cloudinary, archivos antiguos sin registro ni carpetas enteras. Repetir el comando si hay más de 1.000 candidatos.

### Comprobaciones después de desplegar

- Entrar como invitado: Inicio, foro público, reacciones consultables y enlace /p/ID. Publicar y reaccionar deben pedir sesión.
- Iniciar sesión con una cuenta existente, cerrar sesión y cambiar de cuenta. Confirmar que las listas y borradores privados se limpien.
- Publicar texto, imagen, GIF online, audio y video; cancelar una subida y reintentar un envío. Confirmar que no aparezcan duplicados.
- Cargar más de doce posts, cambiar el orden y simular una desconexión. Las novedades deben recuperarse sin vaciar lo leído.
- Reaccionar desde otra cuenta, cambiar la reacción y retirarla. Revisar el aviso del autor y confirmar que no se avise a sí mismo.
- Editar y eliminar una publicación propia; una petición equivalente de otra cuenta debe devolver 403. Revisar también los enlaces compartidos.
- Denunciar un post público y resolverlo desde su administrador; bloquear y desbloquear una cuenta. El bloqueo no elimina el historial de conversaciones.
- Subir un archivo a un chat y comprobar su URL con participante, tercero e invitado. Los dos últimos no deben poder leerlo. Repetir con un grupo y seguidores mutuos.
- Comprobar el editor a 320 y 360 px, los diálogos con teclado y la navegación de las páginas secundarias.

### Respaldo y recuperación

Con el servicio detenido, usar `pg_dump -Fc --dbname matesito_8s --file matesito-backup.dump` y archivar el UPLOAD_DIR real en un respaldo separado. El SQL no contiene las imágenes, audios ni videos. Probar la recuperación en una base distinta, por ejemplo creando una base vacía y ejecutando `pg_restore --exit-on-error --dbname matesito_restore matesito-backup.dump`; copiar los adjuntos a un directorio separado y arrancar una instancia de comprobación contra ambos. No sobrescribir producción durante la prueba.

Después de migrar contraseñas a scrypt, una versión antigua que solo entienda bcrypt no puede autenticar esas cuentas. Para volver a una versión anterior hace falta restaurar el respaldo coherente de código, base y adjuntos, o mantener un lector compatible con scrypt. No basta con hacer checkout del código anterior.

El acceso al panel interno y /api/ups requiere una sesión cuyo ID figure en ADMIN_USER_IDS. No se publica información de ese panel en el changelog. El servidor atiende SIGTERM/SIGINT para cerrar conexiones y drenar peticiones; el proxy o supervisor debe conceder al menos quince segundos.

Los límites de solicitudes están en memoria por proceso. Si se escala a varias instancias, complementarlos en el proxy o con un almacén compartido. Las consultas de búsqueda y orden por reacciones deben medirse con EXPLAIN ANALYZE sobre una copia representativa antes de añadir índices específicos; los resultados de una base vacía no sustituyen esa medición.

## Actualizar desde versiones anteriores a 1.3.0

Detener la aplicación, respaldar la base existente y aplicar **schema.sql antes de arrancar el código 1.3.0**. El nuevo campo `users.auth_version` es necesario para validar sesiones. Usar el nombre real de la base y los parámetros de conexión de tu servidor; estos ejemplos usan `matesito_8s`:

```sh
pg_dump -Fc --dbname matesito_8s --file matesito-pre-1.3.0.dump
psql -X --set ON_ERROR_STOP=on --dbname matesito_8s --file schema.sql
npm ci
npm start
```

El archivo sirve para crear el esquema vacío y para actualizar el esquema usado por esta aplicación. Se ejecuta dentro de una transacción y admite reaplicación. Convierte flags antiguos 0/1 a booleanos, ajusta la secuencia de IDs de mensajes textuales y las secuencias numéricas, incorpora membresías de propietarios e índices para paginación. Conserva cuentas, posts, mensajes y reacciones. No crea usuarios de PostgreSQL ni cambia claves de acceso.

Las fechas históricas nulas se representan con `1970-01-01 UTC` para poder paginar sin perder filas; no se inventa una fecha de publicación reciente. Las claves foráneas nuevas usan `NOT VALID`: protegen nuevas escrituras y permiten conservar registros históricos huérfanos. `posts.username` no añade una clave foránea, para conservar publicaciones de autores antiguos. Los IDs F-/C-/G- y el seguimiento mutuo se validan en el servidor.

Las secuencias de PostgreSQL pueden avanzar aunque una transacción falle: pueden quedar saltos entre IDs, pero no se reutilizan IDs ni se eliminan filas. El esquema no modifica claves foráneas personalizadas que ya existan; una estructura distinta de la usada por la aplicación requiere revisar su volcado antes de migrar.

Si existen duplicados en nombres únicos, membresías, pares de chat o selecciones de reacciones, o tipos incompatibles no contemplados, la migración aborta sin borrar datos. Revisar el error antes de reiniciar; no continuar sin `ON_ERROR_STOP` ni eliminar registros a ciegas. El script se probó contra un esquema vacío y variantes antiguas representativas, no contra un volcado de tu base real. Para volver al código anterior después de una migración fallida, ejecutar `ROLLBACK` si la sesión SQL quedó abierta; el respaldo permite recuperar cambios posteriores si fuera necesario.

Después de arrancar, comprobar login, publicación, la segunda tanda de 12, reacciones, un chat privado y un grupo entre seguidores mutuos. Cambiar la contraseña invalida las cookies/tokens anteriores; la sesión que realiza el cambio recibe una cookie renovada.

El mantenimiento del cliente queda desactivado en `public/scripts/scripts.js`. Para verificar el despliegue, comprobar la persistencia después de reiniciar, Turnstile, la carga de archivos locales y la lectura de adjuntos antiguos de Cloudinary, Socket.IO detrás del proxy y el dispositivo UPS con la configuración real.

Las novedades de esta versión se encuentran en la pestaña Versiones (`public/html/versiones.html`).

## Almacenamiento de archivos

Las nuevas imágenes, audios y videos se guardan en el servidor. Las URLs existentes de Cloudinary y otros adjuntos externos siguen funcionando: no se descargan, reescriben ni eliminan. Las rutas /uploads/ siguen en los campos existentes; desde 1.3.4 también se registra la propiedad de cada archivo nuevo en media_assets. Aplicar schema.sql antes de arrancar esta versión.

Definir UPLOAD_DIR en .env con una ruta absoluta persistente, fuera del repositorio, y dar permiso de lectura y escritura al usuario que ejecuta Node. Por ejemplo, si el servicio corre como agustin:

```sh
sudo install -d -o agustin -g agustin -m 750 /var/lib/matesito/uploads
```

```dotenv
UPLOAD_DIR=/var/lib/matesito/uploads
UPLOAD_MAX_MB=50
```

Sin UPLOAD_DIR se usa la carpeta uploads del proyecto, excluida de Git. No eliminar esa carpeta al desplegar. En contenedores, montar un volumen persistente. Respaldar UPLOAD_DIR junto con PostgreSQL: el respaldo SQL contiene las rutas, no los archivos. Si se cambia de carpeta después de subir archivos, copiar su contenido conservando los nombres antes de arrancar con la ruta nueva.

El límite predeterminado es 50 MB por archivo y 10 MB para imágenes. Las subidas requieren sesión, se escriben por partes en disco y se validan por firma de formato; no se permiten SVG ni HTML. Se eliminan archivos parciales ante errores normales o desconexiones. Tras un cierre forzado pueden quedar archivos ocultos .part, que se pueden retirar con la app detenida. Ese comportamiento se conserva para archivos anteriores. Los archivos registrados desde 1.3.4 tienen control de acceso según las referencias que los usan, como se describe arriba. No se borran automáticamente archivos al eliminar publicaciones, para evitar romper referencias compartidas.

Si usás Nginx, configurar en el bloque server existente client_max_body_size 50m (o el límite elegido), mantener /api/uploads y /uploads/ dirigidos al proceso Node, y permitir hasta 120 segundos para las subidas. Express sirve los archivos con soporte de rangos para audio y video. El directorio debe existir en un disco con espacio suficiente. Reiniciar el servicio después de cambiar .env.
## Métricas del servidor

El panel de estado muestra CPU total, uso por hilo y promedio por núcleo, RAM usada/disponible y sensores de temperatura, además del UPS. Se actualiza cada 5 segundos mediante el mismo canal de eventos. El uso de CPU se calcula entre muestras; la primera lectura aparece como «Calculando…». En Linux, la RAM disponible incluye la caché que el sistema puede recuperar.

CPU y RAM se obtienen del sistema operativo. En Linux, la topología y las temperaturas se leen de /sys y /proc, sin ejecutar comandos como root ni instalar dependencias adicionales. Si el hardware, la máquina virtual o los permisos del servicio no exponen sensores, el panel indica que no hay temperatura disponible. Las etiquetas de sensores permiten distinguir CPU, discos y otros dispositivos; no todas las temperaturas pertenecen al procesador. En contenedores, las métricas pueden corresponder al host y no a los límites asignados al contenedor.

La caída del UPS no interrumpe las métricas del servidor. Si se corta el canal de eventos, la página identifica los valores como últimas lecturas recibidas. Reiniciar Node después de actualizar para activar el muestreo nuevo.

## Enlaces públicos y sitemap

El botón Compartir copia /p/ID para publicaciones y /p/F-ID para mensajes de foros públicos. Cada enlace devuelve HTML con el contenido de una sola publicación, metadatos Open Graph y URL canónica, sin necesitar sesión o JavaScript para leer el texto. Los archivos antiguos de Cloudinary también funcionan en estas páginas. Los contenidos sensibles mantienen su aviso y usan noindex. Los IDs de chats y grupos no admiten enlaces públicos.

PUBLIC_URL define el origen canónico (por defecto https://matesito.com.ar). /sitemap.xml es un índice dinámico con páginas públicas y tandas de 1.000 publicaciones de la base; /robots.txt lo anuncia. Reemplaza al XML estático anterior y no requiere cambios SQL. Se puede enviar https://matesito.com.ar/sitemap.xml a Search Console. El descubrimiento no garantiza la indexación por los buscadores.

La grabadora del editor requiere HTTPS (o localhost), permiso de micrófono y MediaRecorder compatible. Permite escuchar y adjuntar hasta 5 minutos o 10 MB; no publica automáticamente. En navegadores sin soporte se puede seguir adjuntando audio desde un archivo.

## Organización y despliegue

Las dependencias no se versionan: instalar con npm ci --omit=dev. Los assets estáticos usan ETag y revalidación HTTP; el navegador comprueba si cambiaron antes de descargarlos otra vez. Los datos privados mantienen sus restricciones de caché.

La cuenta usa public/scripts/account.js; los controles compartidos están en public/scripts/utils.js, los paneles en public/scripts/modern.js y la carga de archivos en public/scripts/feedback.js. Las reacciones integradas reutilizan la conexión de la página. Las carpetas appAndroid y cssViejo conservan el proyecto Android y la referencia histórica de diseño; uploads contiene datos persistentes y no se limpia al actualizar.

## Archivos públicos

public/html contiene las páginas, public/css los estilos, public/scripts el JavaScript y public/json el manifiesto. res y resources conservan los recursos gráficos existentes. Express conserva las URLs originales: /index.html, /scripts.js, /modern.css, /manifest.json y /sw.js siguen funcionando sin redirecciones. Las páginas sin extensión, los enlaces /p/ID y las rutas de archivos subidos también mantienen sus direcciones. El service worker continúa sirviéndose en /sw.js para conservar su alcance.

## Adjuntos múltiples

Cada publicación o mensaje admite hasta 10 imágenes, GIFs o videos y un audio. El editor limita cada imagen y audio a 10 MB y cada video a 20 MB. La galería se guarda como una lista JSON en el campo media, identificada por application/vnd.matesito.gallery+json; los adjuntos individuales anteriores mantienen su formato. Aplicar nuevamente schema.sql antes de arrancar: la función publication_has_media permite verificar los permisos de todos los archivos y evita que la limpieza retire adjuntos de una galería. El carrusel funciona también en los enlaces compartidos.
