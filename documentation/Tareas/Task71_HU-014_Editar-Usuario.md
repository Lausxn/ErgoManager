# Task 71 · HU-014 · Diseñar interfaz de edición de usuario (Frontend)

| Dato | Valor |
|---|---|
| Tarea | Task 71 · Diseñar interfaz de edición de usuario (FE) |
| Historia de usuario | HU-014 · Editar usuario |
| Responsable | Marvin González Rojas |
| Sprint | Grupo07-Scrum \ Sprint 1 |
| Tipo | Frontend (Angular 19 + PrimeNG 19) |
| Rama | `Task71/HU-014-(Editar-Usuario)/MarvinGonzalez` |
| Commit | `fe4377c` |
| Depende de | Task 67 (HU-013), que aporta el dashboard de Gestión de usuarios y el formulario de creación |
| Backend | No se modificó ningún archivo del backend |

---

## 1. Objetivo

Descripción de la tarea:

> Diseño de opción dentro del Dashboard de Gestión de Usuarios del Administrador, en el cual se dé la opción de editar un usuario, que lo lleve a este Dashboard donde aparezca toda la información del usuario y su rol para poderse editar.

En la tabla de Gestión de usuarios, el botón **Editar** (ícono de lápiz) de cada fila abre un **dashboard de edición propio**. En él se ve toda la información guardada del usuario junto al formulario para cambiar sus datos, su acceso y su rol.

Se sigue el Libro de Marca MGS 2026 y se usan solo componentes de PrimeNG.

---

## 2. Resumen de cambios

1. **Nuevo componente `UserEditComponent`** (`/users/{id}`): el dashboard de edición.
2. **La ruta `/users/{id}`** ahora abre `UserEditComponent`. Antes reutilizaba el formulario de creación, que obligaba a escribir una contraseña para poder editar.
3. **`UserFormComponent` queda solo para creación:** se eliminó su modo edición, que ya no usa ninguna ruta.
4. **Modelo `UserRequest`:** `password` pasa a ser opcional, para poder editar sin cambiar la contraseña.

---

## 3. Dashboard "Editar usuario"

**Ruta:** `/users/{id}`, a la que se llega desde el botón **Editar** de la tabla. Solo pueden entrar los usuarios con rol `ADMIN`.

### 3.1 Estados de la pantalla

| Estado | Qué se muestra |
|---|---|
| Cargando | Esqueletos de PrimeNG con la forma de las tarjetas |
| Error al cargar | "No se pudo cargar el usuario", con los botones **Volver a usuarios** y **Reintentar** |
| Cargado | Columna de información a la izquierda y formulario a la derecha |

### 3.2 Columna izquierda: información del usuario

**Tarjeta "Usuario actual"**, con los datos tal como están guardados:
- Avatar con las iniciales. Es vino si el usuario está activo y gris si está inactivo.
- Nombre completo, con "(usted)" si es la propia cuenta.
- Correo electrónico.
- Etiquetas de **rol** y de **estado**.
- Detalle: identificador (`#id`), rol, estado y fecha de registro (`dd/MM/yyyy HH:mm`).
- Si el usuario está inactivo: "Este usuario está inactivo y no puede iniciar sesión."

**Tarjeta "Cambios pendientes":**
- Lista en vivo cada campo modificado con el formato **antes → después**. Por ejemplo, "Rol: Ergonomista → Administrador".
- Si se activa el cambio de contraseña, lo muestra sin revelarla ("•••••••• → Nueva contraseña").
- Sin cambios muestra: "Todavía no hay cambios. Modifique cualquier campo para verlo aquí."
- Usa `aria-live="polite"`, así que los lectores de pantalla anuncian los cambios.

En pantallas grandes, esta columna queda fija al hacer scroll.

### 3.3 Columna derecha: formulario

| Sección | Campo | Obligatorio | Validación | Mensaje de error |
|---|---|---|---|---|
| 1. Datos personales | Nombre | Sí | Máx. 60 | "El nombre es obligatorio." |
| 1. Datos personales | Primer apellido | Sí | Máx. 60 | "El primer apellido es obligatorio." |
| 1. Datos personales | Segundo apellido | No | Máx. 60 | — |
| 2. Acceso | Correo electrónico | Sí | Formato de correo, máx. 120 | "Escriba un correo válido." |
| 2. Acceso | Interruptor **Cambiar contraseña** | — | Apagado por defecto | — |
| 2. Acceso | Nueva contraseña (solo con el interruptor encendido) | Sí | Entre 8 y 100 caracteres | "La contraseña debe tener al menos 8 caracteres." |
| 2. Acceso | Confirmar contraseña (solo con el interruptor encendido) | Sí | Igual a la nueva | "Confirme la contraseña." / "Las contraseñas no coinciden." |
| 3. Rol | Administrador / Ergonomista | Sí | La tarjeta del rol actual dice "(actual)" | — |

- Con el interruptor apagado se muestra "La contraseña actual se mantiene si no la cambia." y los campos de contraseña no aparecen.
- Al apagar el interruptor se borran las contraseñas que se habían escrito.
- **Protección de la propia cuenta:** si el administrador se edita a sí mismo, las tarjetas de rol quedan deshabilitadas y se muestra "No puede cambiar su propio rol." Así no puede quitarse el acceso por error.

### 3.4 Botones

| Botón | Acción |
|---|---|
| **Guardar cambios** | Deshabilitado mientras no haya cambios. Si el formulario es inválido, marca los errores y **no** llama al backend. Si es válido, envía `PUT /api/users/{id}` y muestra un indicador de carga. |
| **Descartar cambios** | Deshabilitado sin cambios. Devuelve el formulario a los datos guardados sin llamar al backend. |
| **Cancelar** | Vuelve a `/users` sin guardar. |
| **Volver a usuarios** | Vuelve a `/users` sin guardar. |
| **Reintentar** | Solo en el estado de error. Vuelve a pedir el usuario. |

- **Si el backend responde bien:** muestra el toast "Usuario actualizado" con el correo y vuelve a la lista.
- **Si el backend falla:** muestra el toast "No se pudo guardar" y la pantalla no cambia.

### 3.5 Contrato con el backend

| Momento | Endpoint |
|---|---|
| Abrir la pantalla | `GET /api/users/{id}` |
| Guardar | `PUT /api/users/{id}` |

Cuerpo que se envía al guardar:

```json
{
  "firstName": "Carlos Alberto",
  "firstLastName": "Mora",
  "secondLastName": "Jiménez",
  "email": "carlos@empresa.com",
  "role": "ADMIN"
}
```

- Los textos se envían sin espacios al inicio ni al final.
- `password` se agrega **solo** si se activó **Cambiar contraseña**.
- `secondLastName` se omite si el campo quedó vacío.

---

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/pages/users/user-edit/user-edit.component.ts` | **Nuevo.** Carga del usuario, formulario reactivo, lista de cambios pendientes calculada con signals, interruptor de contraseña, protección del propio rol y guardado. |
| `frontend/src/app/pages/users/user-edit/user-edit.component.html` | **Nuevo.** Estados de carga y de error, columna de información, formulario en tres secciones y botones. |
| `frontend/src/app/pages/users/users.routes.ts` | `/users/:id` apunta a `UserEditComponent`. |
| `frontend/src/app/pages/users/user-form/user-form.component.ts` | Se elimina el modo edición (`id`, `isEditing`, `findById`, `update`). Queda solo creación. |
| `frontend/src/app/pages/users/user-form/user-form.component.html` | El título, el botón y el aviso de cuenta activa quedan fijos para creación. |
| `frontend/src/app/shared/models/user.model.ts` | `UserRequest.password` pasa a ser opcional. |

Componentes de PrimeNG usados: `Card`, `Avatar`, `Tag`, `Skeleton`, `InputText`, `IconField`, `Password`, `ToggleSwitch`, `RadioButton`, `Message`, `Divider` y `Button`.

---

## 5. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| `ng build` (producción) en `fe4377c` | Compila sin errores ni advertencias |
| Dashboard de edición (20 casos) | 16 correctos, 4 fallidos (ver abajo) |
| Formulario de creación, versión solo creación (11 casos) | 11 de 11 |
| Dashboard de Gestión de usuarios (8 casos) | 8 de 8 en comportamiento* |

\* Una prueba falló por cómo estaba escrita (esperaba un espacio entre la etiqueta y el número); los valores mostrados eran los correctos.

**Casos correctos en el dashboard de edición:**
- La carga pide el usuario de la URL y llena el formulario.
- La columna de información es correcta.
- **Reintentar** funciona.
- **Guardar cambios** está deshabilitado sin cambios.
- Se envía `PUT` sin contraseña y se vuelve a la lista.
- Se envía el rol elegido.
- No se llama al backend si el formulario es inválido.
- El interruptor muestra y oculta los campos de contraseña.
- Se envía la nueva contraseña cuando ambas coinciden.
- Se bloquean las contraseñas cortas o que no coinciden.
- **Descartar cambios** restaura los datos guardados.
- **Cancelar** y **Volver a usuarios** vuelven a la lista.
- El propio rol queda bloqueado.
- El botón **Editar** de cada fila abre el usuario correcto.

**Los 4 casos fallidos corresponden a los puntos de la sección 6:**
- El mensaje de error específico para un correo duplicado.
- El mensaje de error específico para el único administrador activo.
- El envío doble al presionar Enter.
- El cierre de sesión al cambiar el propio correo.

Las pruebas usaron un servicio simulado en lugar del backend real y no se agregaron al repositorio.

### Cómo probarlo manualmente

```bash
cd frontend
npm install
npm start          # http://localhost:4200/users → botón Editar
```

En desarrollo, `previewMode: true` permite abrir las pantallas sin iniciar sesión. Como `findById` todavía no está implementado en el backend de esta rama, la pantalla mostrará el estado de error con **Reintentar**.

---

## 6. Limitaciones y pendientes

1. **"Cambiar contraseña" no es compatible con el backend de la Task 72.**
   - El endpoint `PUT` implementado en la Task 72 (rama `feature/HU-014-EditarUsuario`) usa `UserUpdateRequestDTO`, que **no tiene** el campo `password`.
   - El backend ignora la contraseña y responde "Usuario actualizado", pero la contraseña no cambia.
   - Hay que decidir entre quitar la opción o agregar `password` opcional al DTO.
2. **Envío doble:** presionar Enter en un campo mientras se guarda envía el `PUT` otra vez. Se corrige revisando `isSubmitting()` al inicio de `submit()`.
3. **Mensaje de error genérico:** no se distingue un correo duplicado (409) del caso del único administrador activo (400). Los dos muestran el mismo texto, que habla del correo.
4. **Cambio del propio correo:** el token de sesión está ligado al correo. Si el administrador cambia el suyo, las siguientes peticiones fallan. Habría que cerrar la sesión y pedir que inicie sesión con el nuevo correo.
5. **Backend de esta rama:** `UserServiceImpl.findById` y `update` están en `TODO`. `update` ya está implementado en la Task 72 y `findById` sigue pendiente.
