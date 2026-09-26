# Task 100 — Cambio de rol (HU-014)

## Base y alcance

- Rama: `Task100/HU-014-Cambio-Rol/BrandonGonzalez`.
- Base: `origin/feature/HU-014-EditarUsuario`, commit `f05ec60`, actualizado
  mediante fetch antes de trabajar. Incluye Task 72 de Fabricio.
- Destino previsto del PR: `feature/HU-014-EditarUsuario`.
- Solo backend. No se implementa un endpoint paralelo ni se incorpora toda HU-019.

Task 72 ya permite actualizar el rol mediante `PUT /api/users/{id}` y rechaza
la degradación del único administrador activo. Se conserva ese contrato y las
validaciones existentes.

## Comportamiento

Al cambiar `ADMIN` por `ERGONOMIST`, o viceversa, la misma transacción guarda el
rol e incrementa `users.token_version`. Los tokens anteriores del usuario dejan
de autenticar peticiones protegidas (401); el usuario debe iniciar sesión de
nuevo. El login devuelve el rol actual y un JWT con la versión vigente.

La seguridad sigue tomando los permisos desde el usuario de la base de datos,
sin confiar en un rol enviado por el cliente. Solo `ADMIN` puede editar usuarios.
La nueva sesión conserva las restricciones de rutas ya definidas en HU-014.

- Editar datos manteniendo el mismo rol no incrementa la versión.
- Volver al rol original no reactiva tokens anteriores.
- El cambio no modifica la contraseña ni reactiva cuentas desactivadas.
- Si un administrador cambia su propio rol y queda otro administrador activo,
  su petición termina correctamente y su siguiente petición requiere nuevo login.
- Se bloquea la fila editada durante la actualización para no perder incrementos
  de versión ante ediciones simultáneas del mismo usuario.

El mecanismo de sesión (`UserPrincipal`, `tokenVersion` y validación JWT) se
reutiliza de Task 103, commit `0711cd0`, porque HU-014 aún no lo incluía. Esto
mantiene el mismo nombre de columna y claim para la futura integración con HU-019.
El filtro trata tokens de usuarios eliminados o con correo cambiado como no
autenticados, en vez de propagar un error del servidor.

## Base de datos

Se añade `users.token_version`, `BIGINT NOT NULL DEFAULT 0`. El perfil de
desarrollo usa Hibernate `update`. En entornos con esquema gestionado manualmente,
si la columna aún no existe, aplicar antes del despliegue:

```sql
ALTER TABLE users ADD COLUMN token_version BIGINT NOT NULL DEFAULT 0;
```

No repetir si Task 103 ya agregó la columna. Los tokens sin versión se consideran
versión cero y dejan de funcionar después del primer cambio de rol.

## Verificación

Desde backend: `.\mvnw.cmd clean test`.

Resultado: **BUILD SUCCESS**, 19 pruebas aprobadas, cero fallos, cero errores
y cero omitidas (8 casos nuevos, 10 de Task 72 y la prueba de contexto).

Las pruebas nuevas usan H2, login real, BCrypt y JWT para comprobar los cambios
en ambos sentidos, revocación persistente incluso al revertir el rol, permisos
tras volver a entrar, edición sin cambiar rol, autoedición, último administrador,
rechazo de autoascenso, cuentas desactivadas y tokens anteriores sin versión.

Las comprobaciones de acceso a evaluaciones llegan a la validación de su
controller sin ejecutar servicios de negocio que todavía no están implementados.
Se ejecutan también las pruebas existentes de Task 72. Las pruebas automatizadas
usan H2 y no modifican MySQL.

En la comprobación manual local, el usuario confirmó la actualización por
Swagger con HTTP 200, el rol `ERGONOMIST` persistido en MySQL y HTTP 401 al
reutilizar el token anterior al cambio. No se incluyen credenciales ni tokens.
