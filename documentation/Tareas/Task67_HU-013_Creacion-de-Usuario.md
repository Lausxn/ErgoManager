# Task 67 · HU-013 · Creación de usuario (Frontend)

| Dato | Valor |
|---|---|
| Tarea | Task 67 |
| Historia de usuario | HU-013 · Creación de usuario |
| Responsable | Marvin González Rojas |
| Tipo | Frontend (Angular 19 + PrimeNG 19) |
| Rama | `Task67/HU-013-(Creación-de-Usuario)/MarvinGonzalez` |
| Commit | `fd75275` |
| Backend | No se modificó ningún archivo del backend |

---

## 1. Objetivo

Diseñar la interfaz con la que el **administrador** registra nuevos usuarios de ErgoManager (administradores y ergonomistas), y el **dashboard de Gestión de usuarios** desde el que se accede a esa pantalla.

La interfaz sigue el Libro de Marca MGS 2026 (`documentation/Files/MGS_Libro_de_Marca_2026.pdf`): el vino se usa solo como acento, los títulos van en negro y el texto secundario en gris.

---

## 2. Resumen de cambios

1. **Pantalla "Creación de usuario"** (`/users/new`): el formulario está dividido en tres secciones (datos personales, acceso y rol), con validaciones, mensajes en español y una tarjeta de resumen que se actualiza mientras se escribe.
2. **Dashboard "Gestión de usuarios"** (`/users`): indicadores, búsqueda, filtros por rol y estado, y una tabla con las acciones de cada usuario.
3. **Corrección de la estructura del frontend:** se agregaron los archivos del layout y las páginas base que faltaban en la rama. Sin ellos la aplicación **no compilaba** (ver sección 6).
4. **Estilos de marca** nuevos en `_mgs.scss` para las tarjetas, los avatares y las opciones de rol.

---

## 3. Pantalla "Creación de usuario"

**Ruta:** `/users/new`. Solo pueden entrar los usuarios con rol `ADMIN` (`roleGuard(['ADMIN'])`).

### 3.1 Estructura

- **Encabezado:** etiqueta "Gestión de usuarios", título "Creación de usuario" y botón **Volver a usuarios**.
- **Tarjeta principal** con el formulario:
  1. **Datos personales**
  2. **Acceso**
  3. **Rol**
- **Tarjeta lateral "Resumen":** muestra las iniciales, el nombre completo, el correo y el rol mientras se llenan los campos. En pantallas grandes queda fija al hacer scroll.
- **Pie del formulario:** la leyenda "* Campos obligatorios" y los botones **Cancelar** y **Crear usuario**.

### 3.2 Campos y validaciones

Los límites coinciden con `UserRequestDTO` del backend.

| Sección | Campo | Obligatorio | Validación | Mensaje de error |
|---|---|---|---|---|
| Datos personales | Nombre | Sí | Máx. 60 caracteres | "El nombre es obligatorio." |
| Datos personales | Primer apellido | Sí | Máx. 60 caracteres | "El primer apellido es obligatorio." |
| Datos personales | Segundo apellido | No | Máx. 60 caracteres | — |
| Acceso | Correo electrónico | Sí | Formato de correo, máx. 120 | "Escriba un correo válido." |
| Acceso | Contraseña | Sí | Entre 8 y 100 caracteres, con medidor de seguridad | "La contraseña debe tener al menos 8 caracteres." |
| Acceso | Confirmar contraseña | Sí | Igual a la contraseña | "Confirme la contraseña." / "Las contraseñas no coinciden." |
| Rol | Administrador / Ergonomista | Sí | Por defecto **Ergonomista** | — |

- Los errores aparecen cuando el usuario ya tocó el campo, o todos a la vez al intentar guardar.
- Cada opción de rol es una tarjeta con su descripción:
  - **Administrador:** "Gestiona empresas, usuarios y formularios."
  - **Ergonomista:** "Realiza evaluaciones personalizadas y gestiona su agenda."

### 3.3 Comportamiento de los botones

| Botón | Acción |
|---|---|
| **Crear usuario** | Si el formulario es inválido, marca los errores y **no** llama al backend. Si es válido, envía `POST /api/users`. |
| **Cancelar** | Vuelve a `/users` sin guardar. |
| **Volver a usuarios** | Vuelve a `/users` sin guardar. |

- **Si el backend responde bien:** muestra el toast "Usuario creado" con el correo y vuelve a la lista.
- **Si el backend falla:** muestra el toast "No se pudo guardar" y la pantalla no cambia, para que se puedan corregir los datos.

### 3.4 Contrato con el backend

`POST /api/users`, con el cuerpo:

```json
{
  "firstName": "María José",
  "firstLastName": "Rodríguez",
  "secondLastName": "Vargas",
  "email": "maria@empresa.com",
  "password": "clave-segura-1",
  "role": "ERGONOMIST"
}
```

`secondLastName` no se envía si el campo quedó vacío.

---

## 4. Dashboard "Gestión de usuarios"

**Ruta:** `/users`. Solo pueden entrar los usuarios con rol `ADMIN`.

| Elemento | Detalle |
|---|---|
| Botón **Creación de usuario** | En el encabezado. Lleva a `/users/new`. |
| Indicadores | Usuarios registrados, Activos, Administradores y Ergonomistas, con esqueletos de carga mientras llegan los datos. |
| Búsqueda | Por nombre o correo. Ignora tildes y mayúsculas ("jose" encuentra "José"). |
| Filtro de rol | Todos / Administrador / Ergonomista. |
| Filtro de estado | Todos / Activos / Inactivos. |
| Contador | "X de Y usuarios". |
| Tabla | Usuario (avatar con iniciales, nombre, correo y "(usted)" en la cuenta propia), Rol, Estado, fecha de registro y acciones. Se puede ordenar y paginar (10, 25 o 50 filas). |
| Acción **Editar** | Lleva a `/users/{id}`. |
| Acción **Desactivar** | Pide confirmación y luego llama a `DELETE /api/users/{id}`. No aparece en la cuenta propia ni en usuarios inactivos. |
| Estados vacíos | "Todavía no hay usuarios registrados." (con botón para crear) o "Ningún usuario coincide con la búsqueda." (con botón **Limpiar filtros**). |

---

## 5. Archivos modificados

### Funcionalidad de la tarea

| Archivo | Cambio |
|---|---|
| `frontend/src/app/pages/users/user-form/user-form.component.ts` | Formulario reactivo con validaciones, verificación de que las contraseñas coinciden, resumen calculado con signals y envío al backend. |
| `frontend/src/app/pages/users/user-form/user-form.component.html` | Diseño en tres secciones, tarjetas de rol, resumen lateral y botones. |
| `frontend/src/app/pages/users/user-list/user-list.component.ts` | Indicadores, búsqueda sin tildes, filtros por rol y estado, y desactivación con confirmación. |
| `frontend/src/app/pages/users/user-list/user-list.component.html` | Dashboard con indicadores, barra de herramientas, filtros, tabla y estados vacíos. |
| `frontend/src/assets/layout/_mgs.scss` | Clases de marca: `mgs-stat-icon`, `mgs-table-card`, `mgs-user-avatar`, `mgs-summary-avatar`, `mgs-section-hint`, `mgs-required`, `mgs-role-option`. |

### Estructura necesaria para compilar

| Archivo | Cambio |
|---|---|
| `frontend/src/app/layout/component/*.ts` (8 archivos) | Layout de la aplicación: menú lateral por rol, barra superior con usuario y cierre de sesión, pie de página y preferencias. |
| `frontend/src/app/pages/auth/access.ts` | Página de acceso denegado. |
| `frontend/src/app/pages/auth/error.ts` | Página de error. |
| `frontend/src/app/pages/notfound/notfound.ts` | Página "no encontrada". |
| `frontend/src/app.routes.ts` | Corrige el import `home.redirect`, que no existía, por `redirect-to-home`. |

---

## 6. Nota sobre la estructura del frontend

En la rama base (`08998ba`, después del merge de la Task 77), el frontend **no compilaba** por dos motivos:

- `app.routes.ts` importaba `./app/core/guards/home.redirect`, que no existe.
- Faltaban `app/layout/component/app.layout.ts` y las páginas `notfound`, `access` y `error`, que ya estaban referenciadas en el código.

Esos archivos nunca se habían subido al repositorio; no estaban ignorados ni borrados. Se agregaron en esta tarea porque sin ellos no era posible probar la pantalla. **Este cambio está fuera del alcance de la HU-013, por eso se deja documentado.**

---

## 7. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| `ng build` (producción) en `fd75275` | Compila sin errores ni advertencias |
| `ng build` en la base `08998ba` | No compila (confirma el punto 6) |
| Pruebas funcionales del formulario (10 casos) | 10 de 10 correctas |
| Pruebas funcionales del dashboard (8 casos) | 8 de 8 en comportamiento* |

\* Una de las pruebas del dashboard falló por la forma en que se escribió la prueba (esperaba un espacio entre la etiqueta y el número); los valores mostrados eran los correctos.

**Casos verificados en el formulario:**
- Título, botón y rol por defecto.
- Formulario vacío.
- Correo inválido.
- Contraseña corta.
- Contraseñas distintas.
- Resumen en vivo.
- Envío de `POST` con los datos correctos, tanto con segundo apellido como sin él.
- Error del backend.
- Botones **Cancelar** y **Volver a usuarios**.

**Casos verificados en el dashboard:**
- Carga e indicadores.
- Búsqueda sin tildes.
- Filtros de rol y de estado.
- Limpiar filtros.
- Navegación a creación y a edición de cada fila.
- Visibilidad de **Desactivar**.
- Confirmación y llamada a `deactivate` con el id correcto.

Las pruebas usaron un servicio simulado en lugar del backend real y no se agregaron al repositorio.

### Cómo probarlo manualmente

```bash
cd frontend
npm install
npm start          # http://localhost:4200/users/new
```

En desarrollo, `environment.development.ts` tiene `previewMode: true`, que permite abrir las pantallas sin iniciar sesión. Como el backend todavía no crea usuarios, al guardar se mostrará el toast de error.

---

## 8. Limitaciones y pendientes

- **Backend:** `UserServiceImpl.create` todavía lanza `UnsupportedOperationException` (está en `TODO`). La pantalla está lista, pero no crea usuarios hasta que se implemente la parte de backend de la HU-013.
- **Desactivar:** `UserServiceImpl.deactivate` también está en `TODO` (HU-015).
- **Edición:** en esta rama, la ruta `/users/{id}` reutiliza este mismo formulario y exige contraseña. Esto se reemplazó en la **Task 71 (HU-014)** con un dashboard de edición propio.
- **Mensaje de error genérico:** al fallar el guardado no se distingue la causa. Por ejemplo, un correo duplicado (HTTP 409) muestra el mismo texto que cualquier otro error.
