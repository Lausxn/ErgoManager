# Task 103 — Actualización de contraseña

## Base y alcance

- Rama: `Task103/HU-019-Actualizar-Contrasena/BrandonGonzalez`.
- Base revisada tras `git fetch origin`: `origin/feature/HU-019-Login`, commit
  `08998ba` (incluye el merge de Task 77).
- Contrato contrastado con
  `origin/Task102/HU-019-Interfaz-Actualizar-Contraseña/LausenPaniagua`.
- Cambios exclusivamente en backend. No se incorporan ni modifican archivos
  del frontend ni ramas de otros integrantes.

## Contrato

`PUT /api/auth/password`, con `Authorization: Bearer <token>`:

```json
{
  "currentPassword": "Original1!",
  "newPassword": "Replacement2!"
}
```

El usuario se obtiene del principal autenticado; el cliente no elige un ID ni
un correo de destino. El endpoint admite ambos roles: `ADMIN` y `ERGONOMIST`.

- **200:** devuelve el mismo `LoginResponseDTO` del login: `token`, `tokenType`,
  `expiresAtMs`, `userId`, `fullName` y `role`. Task 102 guarda esta nueva sesión.
- **400:** contraseña actual incorrecta, nueva contraseña igual a la anterior,
  campos ausentes/vacíos o contraseña que incumple las reglas. Se conserva el
  formato `ErrorResponse` existente y la sesión sigue siendo válida.
- **401:** sesión ausente, inválida, expirada, revocada o usuario desactivado.

La nueva contraseña requiere ocho caracteres como mínimo, mayúscula,
minúscula, número y símbolo, siguiendo las reglas de Task 102, incluidas las
letras españolas. Se limita además a **72 bytes UTF-8**, por BCrypt; este límite
puede alcanzarse antes de 72 caracteres si se usan tildes u otros caracteres
multibyte. El backend informa ese caso con 400; el frontend no anticipa todavía
ese límite.

## Persistencia y sesiones

Se reutiliza el bean `PasswordEncoder` existente. La contraseña actual se
comprueba con `matches` y la nueva se almacena con `encode`. La actualización
es transaccional y bloquea la fila del usuario durante el cambio.

Se agrega `users.token_version` (`BIGINT NOT NULL DEFAULT 0`). Cada cambio de
contraseña incrementa esta versión y el nuevo JWT incluye `tokenVersion`.
Spring Security compara el token con la versión persistida en cada petición:
los tokens anteriores dejan de funcionar, incluidas otras sesiones del mismo
usuario. Los tokens de Task 77 sin versión se interpretan como versión cero,
por lo que se conservan hasta el primer cambio de contraseña.

El proyecto mantiene su gestión de esquema existente con Hibernate. En los
entornos configurados con `ddl-auto=update`, Hibernate agrega la columna. Si un
entorno gestiona el esquema manualmente, debe aplicar antes:

```sql
ALTER TABLE users ADD COLUMN token_version BIGINT NOT NULL DEFAULT 0;
```

No se ha ejecutado este SQL manualmente ni se ha modificado una base MySQL.

## Verificación

Desde `backend`:

```powershell
.\mvnw.cmd clean test
```

Resultado: **BUILD SUCCESS**, 23 pruebas, cero fallos, cero errores y cero
omitidas (22 casos de integración nuevos y la prueba de contexto existente).

Las pruebas de integración usan H2, la cadena real de Spring Security, JWT y
BCrypt. Recargan el usuario después de la transacción del endpoint para comprobar
el hash persistido; también verifican credenciales, ambos roles, renovación y
revocación de tokens, compatibilidad con Task 77, aislamiento entre usuarios,
validaciones y límites UTF-8. No requieren levantar MySQL ni el frontend.
