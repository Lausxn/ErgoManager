# Task 32 — Usuario base ergonomista (HU-002)

## Base y alcance

Rama de trabajo: `Task32/HU-002-Crear-Usuario-Ergonomista/BrandonGonzalez`.
Base: `origin/development`, commit `6f92c23`, revisado después de actualizar origin.
Destino previsto del PR: `feature/HU-002-InterfazErgonomista`.

La tarea agrega un inicializador opcional para crear el usuario base de pruebas
y posteriormente configurar los datos de Keisy. Reutiliza `User`,
`UserRepository`, las validaciones de `UserRequestDTO`, BCrypt y las reglas de
Spring Security existentes. No implementa el CRUD de usuarios de HU-013 ni
agrega cambios de Task 103.

## Configuración y uso

La creación está **desactivada por defecto**. Configure las siguientes variables
de entorno en la configuración de ejecución del backend antes de arrancarlo:

| Variable | Valor |
| --- | --- |
| `ERGONOMIST_BOOTSTRAP_ENABLED` | `true` para crear la cuenta |
| `ERGONOMIST_FIRST_NAME` | Nombre, obligatorio; máximo 60 caracteres |
| `ERGONOMIST_FIRST_LAST_NAME` | Primer apellido, obligatorio; máximo 60 caracteres |
| `ERGONOMIST_SECOND_LAST_NAME` | Segundo apellido opcional; máximo 60 caracteres |
| `ERGONOMIST_EMAIL` | Correo válido, obligatorio; máximo 120 caracteres |
| `ERGONOMIST_PASSWORD` | Contraseña privada, mínimo 8 caracteres y máximo 72 bytes UTF-8 |

Las variables se pueden introducir en el campo de variables de entorno de la
configuración de ejecución de Java del IDE. No guardar la contraseña en un
archivo versionado ni compartirla en el PR. El backend no carga archivos `.env`
automáticamente.

Arranque el backend con la conexión a la base correspondiente configurada como
indica el README del proyecto. El inicializador guarda una fila en `users`, con
`role=ERGONOMIST`, `active=true` y la contraseña hasheada por el encoder existente.
Luego pruebe el login habitual usando el correo y la contraseña configurados.

Después del primer arranque correcto, desactive `ERGONOMIST_BOOTSTRAP_ENABLED`
y retire la contraseña de la configuración de arranque. La cuenta permanece
en la base de datos.

Si el correo ya existe con rol `ERGONOMIST`, el inicializador no modifica sus
datos, contraseña ni estado activo. Si pertenece a otro rol, el arranque falla
sin modificarlo. Los datos inválidos también impiden la creación. La restricción
única de correo existente evita insertar duplicados; la provisión debe ejecutarse
en una sola instancia a la vez.

Cambiar las variables no edita una cuenta ya creada. Para entregar una cuenta de
prueba a Keisy, use el flujo de edición/cambio de contraseña disponible en la
rama integrada, o configure un correo nuevo para crear una cuenta independiente.

## Permisos

Se conserva la política existente de `SecurityConfig`:

- `ERGONOMIST` puede acceder a `/api/personalized-evaluations/**`.
- `/api/users/**`, `/api/companies/**` y las rutas de administración de formularios
  requieren `ADMIN`.
- Las rutas públicas de formularios y autoevaluación mantienen sus excepciones.
- Las demás rutas conservan el requisito de autenticación de development.

Esta tarea no completa servicios de negocio que aún tienen TODOs. Las pruebas
de permiso positivo comprueban que la petición llega a la validación del
controller, sin simular que el servicio de evaluaciones ya está implementado.

## Pruebas y entrega

Ejecutar desde backend: `./mvnw clean test` (Windows: `.\mvnw.cmd clean test`).
Las pruebas usan H2 y verifican creación al arrancar, hash BCrypt persistido,
login real, permisos, configuración inválida y conservación de cuentas existentes.
El arranque sin activación comprueba que no se registra el inicializador.

Resultado: `Maven clean test` finalizó con **BUILD SUCCESS: 13 pruebas, cero
fallos, cero errores y cero omitidas**.

Verificación manual local: el usuario confirmó la creación de cuentas de prueba
en MySQL con rol `ERGONOMIST` y estado activo, y un login desde Swagger con
respuesta HTTP 200 y rol `ERGONOMIST`. No se incluyen credenciales ni tokens
en esta documentación.

**Comparación del futuro PR:** al revisar, HU-002 seguía en `13c07e6` y solo
contenía README. Por eso el PR hacia esa rama incluirá también los cambios ya
existentes de development. Para revisar solo Task 32, comparar con `6f92c23`;
si el equipo actualiza HU-002 desde esa base primero, el diff del PR se reducirá
a los archivos de esta tarea. No se ha modificado ninguna rama remota.
