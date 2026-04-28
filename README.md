# V-NYCH 🪲

Una infraestructura de productividad integral, multiplataforma y de alto rendimiento desarrollada desde cero. V-NYCH toma su identidad del manuscrito de Voynich y reemplaza la dependencia de servicios de terceros (Google Calendar, Notion, Google Tasks) mediante una arquitectura de microservicios soberana, diseñada para la eficiencia extrema en hardware local (**Raspberry Pi 5 / CapiOS**).

---

## 🎯 Core Features & Multi-Platform

* **📅 Calendar Engine (Rust):** Implementación nativa de lógica de eventos y recurrencias (RFC 5545) con sistema de notificaciones push asíncronas.
* **📝 Block-Based Notes (Rust):** Motor de notas estilo Notion con soporte para tipos de datos complejos y persistencia en tiempo real.
* **✅ Task Orchestrator (Rust):** Gestión de tareas con prioridades, estados de ciclo de vida y sincronización multi-dispositivo.
* **📱 Mobile App (React Native):** Aplicación móvil nativa con notificaciones de eventos en tiempo real y modo offline.
* **💻 Desktop Client (Tauri/Rust):** Cliente de escritorio ultra-ligero que aprovecha el backend en Rust para un consumo mínimo de recursos.
* **📟 Terminal UI - Lite Version (Rust/TUI):** Versión de terminal optimizada para **CapiOS**. Diseñada para consumir el mínimo de energía y CPU, ideal para gestión rápida vía SSH o local.
* **🐳 Infra-Controller (Go):** Gestor de infraestructura que interactúa con el Docker SDK para el despliegue automático y monitoreo de salud de los servicios.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Rol / Implementación |
| :--- | :--- | :--- |
| **Backend Core** | **Rust** (Axum/Tokio) | Lógica de negocio con seguridad de memoria y alta concurrencia. |
| **Orquestación** | **Go** | Scripts de gestión para Docker Engine y automatización de la infra. |
| **Mobile App** | **React Native** | Interfaz móvil multiplataforma con integración de notificaciones push. |
| **Desktop / TUI** | **Tauri / Ratatui** | Clientes livianos enfocados en performance y bajo consumo. |
| **Database** | PostgreSQL | Persistencia relacional robusta para datos estructurados. |
| **Cache** | Redis | Gestión de sesiones y colas de tareas rápidas. |
| **Runtime** | Docker / Debian | Aislamiento de servicios en arquitectura ARM64 (**CapiOS**). |

---

## 🏗️ Arquitectura del Sistema

```text
[ Mobile App ] <───┐          [ Desktop / TUI ]
           │                 │
           ▼                 ▼
    [ Reverse Proxy: Nginx/Traefik ]
           │
   ├─► [ Service: Notes & Calendar (Rust) ] ──► [ PostgreSQL ]
   │
   ├─► [ Infra-Controller (Go) ] ────────────► [ Docker SDK ]
   │
   └─► [ Auth & Session (Redis) ]
```

---

## Origen Del Nombre

`V-NYCH` está inspirado en el **manuscrito de Voynich**: una referencia a conocimiento cifrado, privado y difícil de exponer sin contexto. El nombre refleja la idea central del proyecto: datos personales bajo control del usuario, sin depender de plataformas externas.

## Estado Actual Del Proyecto

Actualmente el repositorio incluye:

- **Autenticación JWT** (registro/login) con protección por usuario.
- **Notas tipo bloques** con contenido JSON y soporte de jerarquía (`parent_id`).
- **Calendario** con CRUD de eventos, colores y filtros por rango de fechas.
- **Tareas y listas** con estados, prioridad, subtareas y elementos destacados.
- **Adjuntos en tareas**: subir, listar, descargar y eliminar archivos por tarea.
- **Health checks** para backend, PostgreSQL y Redis.
- **Infra local con Docker Compose** para DB + caché.

## Stack Tecnologico

- **Backend**: Rust, Axum, Tokio, SQLx
- **Frontend**: React + TypeScript + Vite
- **Base de datos**: PostgreSQL
- **Cache / sesiones**: Redis
- **Infra**: Docker Compose

## Arquitectura (Resumen)

```text
Web (React + Vite)
       |
       v
API REST (Rust / Axum)
   |                 |
   v                 v
PostgreSQL         Redis
```

## Endpoints Principales

- `GET /health`
- `GET /api/status`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET|POST /api/notes`
- `GET|PATCH|DELETE /api/notes/:id`
- `GET|POST /api/calendar/events`
- `GET|PATCH|DELETE /api/calendar/events/:id`
- `GET|POST /api/tasks`
- `PATCH|DELETE /api/tasks/:id`
- `GET|POST /api/tasks/:id/attachments`
- `GET|DELETE /api/tasks/:id/attachments/:attachment_id`

## Puesta En Marcha

### Inicio Rapido (1 comando)

Desde la raiz del proyecto:

```powershell
pwsh -File .\dev-up.ps1
```

Esto levanta contenedores, valida/crea la DB `v_nych`, reinicia backend y arranca el frontend en modo desarrollo.

### Apagar Servicios

```powershell
pwsh -File .\dev-down.ps1
```

Si tambien quieres borrar los datos locales de Docker (volumenes):

```powershell
pwsh -File .\dev-down.ps1 -PruneData
```

### 1. Levantar infraestructura

Desde la raiz del proyecto:

```bash
docker-compose up -d
```

### 2. Ejecutar backend

```bash
cd backend
cargo run
```

Backend disponible en `http://localhost:3000`.

### 3. Ejecutar frontend

```bash
cd web
npm install
npm run dev
```

Frontend disponible en `http://localhost:5173`.

## Estructura Del Repositorio

- `backend/`: API en Rust (modulos de usuarios, notas, calendario y tareas).
- `backend/migrations/`: migraciones SQL de la base de datos.
- `web/`: aplicacion web en React + TypeScript.
- `docker-compose.yml`: servicios locales (PostgreSQL, Redis, backend).
