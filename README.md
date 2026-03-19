# 🌌 Chaja Mesh: Productivity Suite

## 🚀 Getting Started

Este proyecto consta de 3 partes principales:
1. **Infraestructura**: Base de datos (PostgreSQL) y Caché (Redis) corriendo en Docker.
2. **Backend**: API escrita en Rust (Axum).
3. **Web**: Frontend escrito en React + TypeScript.

### 📋 Prerrequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js & npm](https://nodejs.org/)

### 🛠️ Instrucciones de Ejecución

#### 1. Iniciar Infraestructura (Postgres & Redis)
Ejecuta esto en la raíz del proyecto para levantar la base de datos y cache:

```bash
docker-compose up -d
```

#### 2. Iniciar Backend (Rust)
Abre una nueva terminal:

```bash
cd backend
cargo run
```

El servidor estará corriendo en `http://localhost:3000`.

#### 3. Iniciar Frontend Web (React)
Abre otra terminal:

```bash
cd web
npm install
npm run dev
```

La web estará disponible en `http://localhost:5173`.

### 🧪 Verificar Conexión
Una vez que todo esté corriendo, abre la web. Deberías ver el estado "Connected" para Database y Redis en el panel de control.

## 🏗️ Estructura del Proyecto

- `backend/`: Código fuente del servidor Rust.
- `web/`: Código fuente del cliente web React.
- `docker-compose.yml`: Definición de servicios de infraestructura.
