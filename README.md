# Matesito

Aplicación Express + PostgreSQL + Socket.IO, con interfaz web sin compilación.

## Ejecutar

1. Usar Node.js 22 o posterior y ejecutar `npm ci`.
2. Copiar `.env.example` a `.env` y completar la conexión a la base existente, `JWT_SECRET` y `TURNSTILE_SECRET`. `JWT_SECRET` es obligatorio también en desarrollo.
3. Aplicar `schema.sql` siguiendo las instrucciones de actualización de abajo.
4. Ejecutar `npm start`.

En producción, configurar `NODE_ENV=production`, un secreto JWT propio y los orígenes permitidos. La conexión a PostgreSQL usa TLS en producción; `DB_SSL=false` permite configurar explícitamente una base local sin TLS. No se incluyen credenciales ni cambios automáticos de esquema.

## Actualizar a 1.3.0

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

El mantenimiento del cliente queda desactivado en `public/scripts.js`. Para verificar el despliegue, comprobar la persistencia después de reiniciar, Turnstile, Cloudinary, Socket.IO detrás del proxy y el dispositivo UPS con la configuración real.

Las novedades de esta versión se encuentran en la pestaña Versiones (`public/versiones.html`).
