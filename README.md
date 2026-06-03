# DAW — Defending a Workstation

Un RPG por turnos de estética retro que transcurre dentro de un sistema operativo infectado. El jugador forma un equipo de procesos del sistema —`CURSOR.EXE`, `GUARD.SYS`, `PURGE.BAT` y otros— y combate a lo largo de tres mundos contra amenazas inspiradas en malware real.

Funciona íntegramente en el navegador, sin instalación ni paso de compilación.

---

## Características

- **Combate ATB** — sistema de turnos por velocidad (Active Time Battle) con habilidades, efectos de estado y super ataques Limit
- **Tres mundos** — 31 nodos de combate, checkpoints narrativos, tienda y jefes finales
- **Creador de mods** — cualquier jugador puede diseñar su propio mundo con editor de sprites pixel art, editor de personajes y editor de mapas por nodos
- **Comunidad** — publica tus mods, valóralos, sigue a autores y filtra por popularidad
- **Sin instalación** — React 18 y Babel se cargan desde CDN; los archivos JSX se sirven tal cual
- **Progreso en la nube** — guardado automático con debounce en una API REST propia

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Babel Standalone (JSX sin build step) |
| Backend | ASP.NET Core 9 / C# + Dapper |
| Base de datos | MySQL 8 |
| Servidor de desarrollo | Vite |

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18.x |
| .NET SDK | 9.0 |
| MySQL | 8.0 |

---

## Instalación y arranque

### 1. Base de datos

```bash
mysql -u root -p < dawrpg-frontend/dawrpgdb.sql
```

Crea el esquema `dawrpgdb` con todas las tablas necesarias.

### 2. Backend

Edita `dawrpg-api/appsettings.json` con tus credenciales:

```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=dawrpgdb;User=root;Password=tu_contraseña;"
  },
  "Mail": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "User": "tu_correo@gmail.com",
    "Password": "tu_app_password"
  }
}
```

Arranca la API:

```bash
cd dawrpg-api
dotnet restore
dotnet run
```

La API escucha en `http://localhost:5094`. Swagger disponible en `http://localhost:5094/swagger`.

### 3. Frontend

```bash
cd dawrpg-frontend
npm install
npm run dev
```

Abre el juego en `http://localhost:5173`.

---

## Estructura del proyecto

```
DAWTFG/
├── dawrpg-api/              # API REST (.NET 9 / C#)
│   ├── Controllers/
│   ├── Repositories/
│   └── Models/
├── dawrpg-frontend/
│   ├── public/game/
│   │   ├── core/            # App root, audio, gráficos del menú
│   │   ├── pages/           # Mapa, batalla, tienda, perfil, dev mode
│   │   └── battle/          # Motor de combate ATB
│   ├── dawrpgdb.sql         # Esquema completo de la base de datos
│   └── index.html
└── TECHNICAL_REFERENCE.md  # Referencia técnica detallada
```

---

## Crear y publicar un mod

1. Inicia sesión y accede a **DEV MODE** desde el menú principal
2. Crea un nuevo borrador y diseña tus personajes con el editor de pixel art
3. Define los ataques de los enemigos y las habilidades de los héroes
4. Coloca nodos en el editor de mapas y conecta con aristas
5. Pulsa **PLAYTEST** para probar el mod en el motor real sin recargar la página
6. Cuando esté listo, publícalo desde **MY MODS → PUBLISH**

---

## Documentación técnica

Para detalles de arquitectura, referencia de endpoints, formato de datos y funcionamiento interno de cada módulo consulta [`TECHNICAL_REFERENCE.md`](TECHNICAL_REFERENCE.md).
