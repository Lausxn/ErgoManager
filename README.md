# ErgoManager

Sistema web de gestion ergonomica para las empresas cliente de MGS. Administra
empresas y usuarios, publica formularios de autoevaluacion, calcula el nivel de
riesgo, agenda citas con el ergonomista, registra evaluaciones personalizadas,
genera reportes en PDF y conserva el historial de evaluaciones.

El proyecto esta formado por dos aplicaciones independientes que se comunican
exclusivamente por API REST con JSON.

```
ErgoManager/
├── Backend/        API REST en Spring Boot + MySQL
├── Frontend/       Aplicacion Angular (Sakai + PrimeNG) con la identidad MGS
├── FrontendOld/    Primera version del frontend, solo como referencia
└── Documentation/
    ├── Files/      MGS_Libro_de_Marca_2026.pdf (manual de identidad visual)
    └── BrandLogo/  Copia de respaldo de los logos (los que usa la app estan
                    en Frontend/public/brand)
```

## Regla de nomenclatura

Todo el codigo (paquetes, clases, metodos, variables, carpetas, tablas y
columnas) esta escrito en **ingles**, sin excepcion. La documentacion funcional
y esta guia estan en espanol.

| Concepto del negocio | Termino en el codigo |
|---|---|
| Empresa cliente | `Company` |
| Usuario (Admin / Ergonomista) | `User` |
| Formulario de autoevaluacion | `Form` |
| Pregunta | `Question` |
| Respuesta | `Answer` |
| Disponibilidad del ergonomista | `Availability` |
| Autoevaluacion | `SelfEvaluation` |
| Cita / Agenda | `Appointment` |
| Evaluacion personalizada | `PersonalizedEvaluation` |
| Historial | `History` |

Los dos roles del sistema son `ADMIN` y `ERGONOMIST` (el termino en ingles de
"ergonomista", para cumplir la regla anterior).

## Stack

| Capa | Tecnologia |
|---|---|
| Backend | Java 25, Spring Boot 4.1.1, Spring Security 7, Spring Data JPA (Hibernate 7) |
| Base de datos | MySQL, esquema `ergo_manager_db` |
| Autenticacion | JWT (JJWT 0.13.0) |
| Documentacion API | springdoc-openapi 3.1.1 (Swagger UI) |
| Frontend | Angular 19, PrimeNG 19 (plantilla Sakai), Tailwind CSS, componentes standalone |

## Requisitos previos

- **JDK 25 o superior** (probado con JDK 25). Es necesario definir la variable
  de entorno `JAVA_HOME` apuntando a la carpeta del JDK; el wrapper de Maven no
  arranca sin ella.
- **Node.js 22 o superior** con npm, para el frontend.
- **MySQL 8 o superior** corriendo en `localhost:3306`.

No hace falta instalar Maven ni Angular CLI: el backend incluye el wrapper
(`mvnw`) y el frontend usa el CLI declarado en `package.json`.

## Backend

```bash
cd Backend
./mvnw spring-boot:run      # Windows: .\mvnw.cmd spring-boot:run
```

La API queda en `http://localhost:8080` y la documentacion interactiva en
`http://localhost:8080/swagger-ui.html`.

El perfil por defecto es `dev`, que crea el esquema `ergo_manager_db` si no
existe y mantiene las tablas sincronizadas con las entidades
(`spring.jpa.hibernate.ddl-auto=update`). Las credenciales se pueden cambiar por
variables de entorno: `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` y
`CORS_ALLOWED_ORIGINS`.

Para ejecutar las pruebas, que usan una base H2 en memoria y no necesitan MySQL:

```bash
./mvnw test
```

### Estructura

```
Backend/src/main/java/com/mgs/ergomanager/
├── config/       CORS y OpenAPI
├── controller/   Controllers REST, uno por modulo funcional
├── dto/          Request y response, un subpaquete por dominio
├── exception/    Excepciones propias y @RestControllerAdvice
├── model/        Entidades JPA (+ model/enums)
├── repository/   Interfaces JpaRepository, una por entidad
├── security/     JWT, filtro de autenticacion y control de acceso por rol
└── service/      Interfaces de negocio (+ service/impl)
```

Cada entidad declara explicitamente su tabla en `snake_case` y plural
(`@Table(name = "companies")`), sus columnas en `snake_case`
(`@Column(name = "first_last_name")`), su clave primaria `id` y sus claves
foraneas con el patron `tabla_singular_id` (`@JoinColumn(name = "company_id")`).

### Estado actual

Los controllers, servicios y repositorios ya estan cableados, pero la logica de
negocio todavia no esta escrita: cada metodo de `service/impl` lanza
`UnsupportedOperationException` con un `// TODO` que describe lo que falta. La
unica excepcion es el login, que ya funciona de punta a punta.

## Frontend

```bash
cd Frontend
npm install
npm start
```

La aplicacion queda en `http://localhost:4200` y apunta al backend segun
`src/environments/`: `environment.development.ts` para desarrollo
(`http://localhost:8080/api`) y `environment.ts` para produccion.

### Estructura

```
Frontend/src/app/
├── core/        AuthService, guards (sesion, rol, invitado) e interceptores HTTP
├── layout/      Shell de Sakai (topbar, menu, footer), preferencias y tema MGS
├── shared/      components/ reutilizables, models/ que reflejan los DTO y utils/
└── pages/       auth, companies, users, forms, self-evaluation,
                 appointment-scheduling, personalized-evaluation, history
```

La interfaz usa PrimeNG con el preset `layout/theme/mgs-preset.ts`, construido
segun el Libro de Marca MGS 2026 (`Documentation/Files/`): paleta oficial,
Aptos con Arial como sustituto y logotipos maestros en `Frontend/public/brand/`. El tema (oscuro por
defecto, o claro) y el tamano de pagina que elige el usuario se guardan en
`localStorage` bajo la clave `ergomanager.preferences`.

### Convencion de componentes y servicios

Se usa la convencion **clasica**, no la que Angular genera por defecto en sus
versiones recientes:

- Selector en kebab-case con prefijo `app-` (`app-company-form`).
- Clase en PascalCase con sufijo `Component` (`CompanyFormComponent`).
- Archivos `nombre-en-kebab-case.component.ts` / `.html` / `.css`.
- Servicios en `nombre.service.ts` con clase `NombreService`.

`angular.json` ya deja configurados los schematics para que `ng generate`
respete esta convencion:

```bash
ng generate component features/companies/company-detail
# genera company-detail.component.ts con la clase CompanyDetailComponent
```

## Convenciones generales

- Variables y atributos en `camelCase`, en plural solo las colecciones
  (`riskLevel`, `employeeList`), entre 3 y 30 caracteres.
- Clases en `PascalCase` y singular, con el sufijo de su capa (`Controller`,
  `Service`, `Repository`, `Request`, `Response`).
- Metodos en `camelCase` empezando por un verbo (`calculateRiskLevel`); los que
  devuelven booleano empiezan por `is`, `has` o `can` (`isTokenValid`).
- Constantes en `UPPER_SNAKE_CASE`.
- Javadoc en las clases y metodos publicos de Java, JSDoc en los servicios y
  componentes de Angular.
- Maximo 120 caracteres por linea y metodos de 30 a 40 lineas como tope.
- El backend no genera ninguna vista HTML: solo responde JSON.
