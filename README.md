# Matesito

Aplicación Express + PostgreSQL + Socket.IO, con interfaz web sin compilación.

## Ejecutar

1. Usar Node.js 22 o posterior y ejecutar `npm ci`.
2. Copiar `.env.example` a `.env` y completar la conexión a la base existente, `JWT_SECRET` y `TURNSTILE_SECRET`.
3. Ejecutar `npm start`.

En producción, configurar `NODE_ENV=production`, un secreto JWT propio y los orígenes permitidos. La conexión a PostgreSQL usa TLS en producción; `DB_SSL=false` permite configurar explícitamente una base local sin TLS. No se incluyen credenciales ni cambios automáticos de esquema.

## Verificación

`npm test` ejecuta pruebas del servidor HTTP y la interfaz. Se usa `pg-mem` con un esquema de prueba inferido del SQL de la aplicación y JSDOM para los flujos del navegador. Las pruebas no acceden a producción. Los bloqueos de PostgreSQL se simulan; no prueban la concurrencia ni las restricciones reales del esquema desplegado.

`node test/preview.cjs` abre un servidor de revisión visual en `http://127.0.0.1:3100`. La ruta `/__preview/login` inicia una cuenta ficticia en una base descartable. Este servidor está limitado a loopback, no se usa con `npm start` y no debe desplegarse. Sus datos se pierden al cerrarlo.

## Cambios corregidos

- Publicación: booleanos compatibles con el backend, validación HTTP, borradores conservados ante errores, adjuntos comprobados, bloqueo de doble envío y recarga explícita sin depender del socket.
- Listas: renderizado independiente del último elemento, filtrado antes del límite, estados vacíos y de error, protección contra respuestas atrasadas y ordenamiento sin depender de reacciones cuando no se utilizan.
- Sesiones y cuenta: sesión autenticada al registrarse, recuperación desde cookie HttpOnly, cierre de sesión real, errores de perfil visibles y conservación de publicaciones al cambiar el nombre.
- Foros y grupos: membresía del creador, compatibilidad con propietarios antiguos, listados independientes, eliminación transaccional de dependencias y códigos de invitación restringidos a miembros y propietarios.
- Chats y avisos: bandeja de conversaciones, destinos y nombres correctos en notificaciones.
- Reacciones: IDs exactos, cambios y eliminación coherentes, operaciones transaccionales, cliente del mismo origen y eventos limitados al post correspondiente.
- Interfaz: integración del diseño v2 guardado en `index.css` y `res/`, barra lateral, temas persistentes, adaptación móvil, cuenta renovada y mensajes/confirmaciones sin `alert` ni `confirm` del navegador.
- Otros: escape de datos en menús y dashboard UPS, estados sin conexión, iconos de instalación y rutas de imágenes corregidas.

El mantenimiento del cliente queda desactivado en `public/scripts.js`. La validación de despliegue requiere probar con la base y las claves reales: persistencia después de reiniciar, restricciones del esquema, Turnstile, Cloudinary, Socket.IO detrás del proxy y el dispositivo UPS. Esos servicios no se reemplazan con los dobles de prueba en el servidor normal.
