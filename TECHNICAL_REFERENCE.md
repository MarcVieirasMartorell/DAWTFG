# DAW — Defending a Workstation
## Referencia técnica: instalación, mantenimiento y funcionamiento

---

## Índice

1. [Instalación y arranque local](#1-instalación-y-arranque-local)
2. [Arquitectura general](#2-arquitectura-general)
3. [Escena del menú principal](#3-escena-del-menú-principal)
4. [Sistema de audio y música](#4-sistema-de-audio-y-música)
5. [Secuencia de introducción](#5-secuencia-de-introducción)
6. [Mapa del mundo](#6-mapa-del-mundo)
7. [Sistema de batalla ATB](#7-sistema-de-batalla-atb)
8. [Editor de personajes y sprites (Dev Mode)](#8-editor-de-personajes-y-sprites-dev-mode)
9. [Editor de mapas por nodos (Dev Mode)](#9-editor-de-mapas-por-nodos-dev-mode)
10. [Comunidad: publicación y descubrimiento de mods](#10-comunidad-publicación-y-descubrimiento-de-mods)
11. [Panel de administración](#11-panel-de-administración)
12. [Autenticación y sesión](#12-autenticación-y-sesión)
13. [Guardado automático](#13-guardado-automático)
14. [Sistema de temas visuales (CRT)](#14-sistema-de-temas-visuales-crt)
15. [Variables CSS y paleta de colores](#15-variables-css-y-paleta-de-colores)
16. [Referencia de archivos](#16-referencia-de-archivos)

---

## Inicio rápido: acceso a todas las funcionalidades

Tras instalar y arrancar el proyecto (ver sección 1), sigue estos pasos para desbloquear todas las funcionalidades del juego sin tener que completar los tres mundos.

### 1. Registra una cuenta

Entra en `http://localhost:5173` y crea una cuenta desde la pantalla de login.

### 2. Conviértete en admin (bootstrap vía SQL)

El primer admin no puede crearse desde la interfaz —no hay nadie que lo conceda— así que hay que hacerlo directamente en la base de datos. Ejecuta este comando en phpMyAdmin (**XAMPP → Admin → pestaña SQL**) o en la CLI de MySQL:

```sql
UPDATE dawrpgdb.accounts SET is_admin = 1 WHERE username = 'tu_usuario';
```

Para verificar que ha funcionado:

```sql
SELECT id, username, is_admin FROM dawrpgdb.accounts;
```

A partir de este momento, la opción **ADMIN PANEL** aparece en el menú principal del juego. Los admins adicionales pueden concederse desde **ADMIN PANEL → USERS → GRANT ADMIN**, sin tocar la base de datos.

### 3. Desbloquea todo desde el Admin Panel

**DEV MODE** y **CUSTOM MAPS** solo son visibles para cuentas que han terminado los tres mundos. Para saltarse esto:

1. Ve a **ADMIN PANEL → USERS**
2. Selecciona tu usuario
3. Pulsa **UNLOCK EVERYTHING**

Esto concede todos los héroes, mundos y 99.999 bits al instante. Al volver al menú principal, DEV MODE y CUSTOM MAPS estarán disponibles.

### Resumen de acceso por funcionalidad

| Funcionalidad | Requisito |
|---|---|
| Mapa del mundo, batalla, tienda | Cuenta registrada |
| Dev Mode (editor de mods) | 3 mundos completados **o** UNLOCK EVERYTHING |
| Custom Maps (mods de la comunidad) | 3 mundos completados **o** UNLOCK EVERYTHING |
| Admin Panel | `is_admin = 1` en la tabla `accounts` |
| Editor de sprites global (Admin → Sprites) | Admin Panel |
| Gestión de usuarios (wallets, flags) | Admin Panel |

---

## 1. Instalación y arranque local

### Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 18.x o superior | |
| npm | 9.x o superior | |
| .NET SDK | 9.0 | |
| MySQL | 8.0 | Incluido en XAMPP; recomendado para desarrollo local |
| XAMPP | 8.x | Panel de control que arranca MySQL (y Apache) sin configuración |
| Python | 3.10+ | Solo para regenerar la documentación `.docx` |

### Frontend

```bash
cd dawrpg-frontend
npm install
npm run dev          # servidor en http://localhost:5173
npm run build        # bundle de producción en dist/
npm run preview      # sirve el bundle compilado en localhost:4173
```

### Backend (API REST)

```bash
cd dawrpg-api
dotnet restore
dotnet run           # escucha en http://localhost:5094
```

La API expone Swagger/OpenAPI en `http://localhost:5094/swagger` cuando está en modo desarrollo.

### Base de datos

El entorno recomendado para desarrollo local es **XAMPP**. Basta con abrir el panel de control de XAMPP y arrancar el módulo **MySQL** (puerto 3306 por defecto). No requiere configuración adicional.

Con el servicio activo, importa el esquema:

```bash
mysql -u root -p < dawrpg-frontend/dawrpgdb.sql
```

Esto crea el esquema `dawrpgdb` con las 23 tablas del juego. El usuario de conexión se configura en `dawrpg-api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=dawrpgdb;User=root;Password=tu_contraseña;"
  }
}
```

Con la instalación por defecto de XAMPP el usuario `root` no tiene contraseña, por lo que la cadena queda `Password=;`.

### Variables de entorno importantes

- **CORS**: La API solo acepta peticiones de `localhost:5173` y `localhost:4173`. Si se cambia el puerto del frontend hay que actualizar `Program.cs`.
- **SMTP**: Las credenciales de correo se gestionan mediante User Secrets (ver sección siguiente). `appsettings.json` contiene los valores vacíos como plantilla.
- **BCrypt work factor**: configurado a 12 en `AuthController.cs`.

### Gestión de secretos (SMTP)

`appsettings.json` **no contiene credenciales reales** y está commiteado sin información sensible. Las credenciales se inyectan en tiempo de ejecución mediante el sistema de secretos de ASP.NET Core.

**Desarrollo local — User Secrets**

```bash
cd dawrpg-api
dotnet user-secrets set "Smtp:Username"    "tu-email@gmail.com"
dotnet user-secrets set "Smtp:Password"    "tu-app-password-de-google"
dotnet user-secrets set "Smtp:FromAddress" "tu-email@gmail.com"
```

Los valores se almacenan fuera del repositorio, en `%APPDATA%\Microsoft\UserSecrets\dawtfg-smtp-secrets\secrets.json`. ASP.NET Core los carga automáticamente cuando `ASPNETCORE_ENVIRONMENT=Development` y sobreescriben las claves vacías de `appsettings.json`.

La contraseña de SMTP debe ser una **App Password de Google** (no la contraseña de cuenta), generada en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) con 2FA activado.

**Producción — variables de entorno**

En el servidor de despliegue, configurar las siguientes variables de entorno (el doble guión bajo `__` es el separador de sección de ASP.NET Core):

```
Smtp__Username=tu-email@gmail.com
Smtp__Password=tu-app-password
Smtp__FromAddress=tu-email@gmail.com
```

### Servicio de email (`EmailService.cs`)

El envío de correos está centralizado en `dawrpg-api/Services/EmailService.cs`. Implementa la interfaz `IEmailService` con un único método público:

```csharp
Task SendVerificationEmailAsync(string toEmail, string username, string verifyUrl);
```

Se llama desde `AuthController.cs` en dos puntos: al registrar una cuenta nueva y al reenviar la verificación.

**Claves de configuración relevantes en `appsettings.json` / secrets:**

| Clave | Descripción |
|---|---|
| `Smtp:Host` | Servidor SMTP (`smtp.gmail.com`) |
| `Smtp:Port` | Puerto (`587` para STARTTLS) |
| `Smtp:Username` | Cuenta Gmail usada para autenticarse |
| `Smtp:Password` | App Password de Google |
| `Smtp:FromAddress` | Dirección que aparece en el campo "De:" |
| `Smtp:FromName` | Nombre del remitente que muestra el cliente de correo (actualmente `MIPMIP Company`) |

Para cambiar el nombre del remitente basta con actualizar `Smtp:FromName` en `appsettings.json`. Las credenciales nunca deben commitearse: van en User Secrets (desarrollo) o variables de entorno (producción).

**Plantilla HTML:** el método privado `BuildHtml` en `EmailService.cs` genera el HTML del correo de verificación con estilo retro de terminal (fondo oscuro, tipografía monospace). Para modificar el diseño o el texto del email, editar ese método directamente — no hay sistema de plantillas externo.

---

## 2. Arquitectura general

```

              NAVEGADOR (SPA)                    
                                            
  index.html  ←  Vite dev server (sin build step)  
       │
  daw-app.jsx  ←  root component, router,
       │          estado global, audio
       ├── daw-intro.jsx     (menú + intro)
       ├── daw-map.jsx       (mapa del mundo)
       ├── daw-battle.jsx    (combate ATB)
       ├── daw-shop.jsx      (tienda)
       ├── daw-profile.jsx   (perfil)
       ├── daw-devmode.jsx   (editor de mods)
       ├── daw-mapshare.jsx  (comunidad)
       └── daw-admin.jsx     (panel admin)

                fetch / JSON

         ASP.NET Core 9 Web API

  AuthController  ProgressController
  ModsController  ShopController
  ReferenceController
       │
    Dapper (micro-ORM)

                      
            MySQL 8.0  /  dawrpgdb
  23 tablas: heroes, enemies, worlds, accounts,
  player_progress, community_mods, ...

```

### Cómo funciona el router

`daw-app.jsx` gestiona la navegación mediante un único estado `route` (string). No se usa React Router; cada página es un componente montado condicionalmente con `display:none` cuando no está activa, lo que permite conservar el estado de la cámara en el mapa sin desmontarlo.

```javascript
// Rutas disponibles:
// 'title', 'intro', 'map', 'battle', 'shop',
// 'profile', 'options', 'devmode', 'custommaps', 'admin'
```

---

## 3. Escena del menú principal

**Archivo**: `public/game/core/daw-graphics.jsx`

La pantalla de título es un SVG de **880×240 unidades de viewBox** renderizado con `shapeRendering="crispEdges"` para conseguir el efecto pixelado estilo NES. No utiliza imágenes ni assets externos; todo está generado programáticamente en React.

### Capas (de fondo a frente)

```
1. Cielo gradiente   — tres rectángulos de color apilados
2. Campo de estrellas — 60 estrellas con animación de parpadeo
3. Sol CPU-disco      — círculos concéntricos + rayos + pines IC
4. Antenas de fondo   — dos torres con puntas parpadeantes (efecto parallax)
5. Colina de carpetas — terreno escalonado con "rocas" de carpetas
6. Sprites de héroes  — los tres protagonistas en pixel art
7. Franja de suelo    — barra de 12px que ancla la escena
```

### Campo de estrellas (determinista)

Las 60 estrellas se calculan una única vez con un generador congruencial lineal (LCG) de semilla fija, de modo que el campo siempre es idéntico y no varía entre renders:

```javascript
const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
```

Cada estrella tiene:
- Posición X aleatoria dentro de los 880px de ancho
- Posición Y restringida a la mitad superior del cielo (< 120px)
- Tamaño: 2px (85% de las estrellas) o 3px (15%)
- Un offset de `animationDelay` aleatorio para que el parpadeo CSS esté desincronizado

### Sol CPU-disco (`<Sun>`)

Imita visualmente un chip de circuito integrado (IC):

- **Anillos concéntricos**: círculos alternos en dos colores para simular bandas de disco
- **Rayos de halo**: cuatro pares de rectángulos rotados a 0°, 45°, 90° y 135°
- **Pines**: 12 líneas radiales distribuidas uniformemente usando trigonometría:
  ```javascript
  const a = (i / 12) * Math.PI * 2;
  const x1 = cx + Math.cos(a) * 48;  // radio interior
  const x2 = cx + Math.cos(a) * 56;  // radio exterior
  ```

### Colina de carpetas (`<Hill>`)

Construida con rectángulos apilados que crean un perfil escalonado. Sobre ella se añaden:
- **Seis iconos de carpeta**: cada uno tiene pestaña, cuerpo y línea de luz
- **14 píxeles binarios** (cuadrados 4×4) que representan bits esparcidos: `01010110100110`

### Sprites de héroes (`<BSprite>`)

Los tres héroes de la pantalla de inicio (`CURSOR.EXE`, `GUARD.SYS`, `PURGE.BAT`) se renderizan usando el componente `BSprite`, que convierte una cuadrícula de 16×18 caracteres glífico en SVG de pixel art a escala 4×. Los colores provienen directamente de `HEROES_DEF`, lo que significa que cualquier cambio en el panel de administración se refleja aquí automáticamente.

La posición es centrada como grupo:
```javascript
const groupW = 3 * 64 + 2 * 8;   // 3 sprites × 64px + 2 gaps × 8px
const startX = Math.round((880 - groupW) / 2);
```

---

## 4. Sistema de audio y música

**Archivo**: `public/game/core/daw-audio.jsx`

No se carga ningún archivo de audio. Toda la música y los efectos de sonido se sintetizan en tiempo real mediante la **Web Audio API** del navegador. La función `makeAudio()` crea y devuelve un controlador de audio completo.

### Por qué se inicializa tarde

Los navegadores modernos bloquean el audio hasta que el usuario interactúa con la página (política de autoplay). Por eso `makeAudio()` se llama solo después del primer gesto del usuario, y el contexto tiene un método `resume()` para reactivarlo si el navegador lo suspende.

### Efectos de sonido (blips)

```javascript
blip(freq=660, dur=0.06, type='square', vol=0.18)
```

Cada blip crea un oscilador, aplica un ataque lineal rápido (5ms) y una caída exponencial para evitar clicks audibles. La jerarquía de frecuencias da retroalimentación táctil al usuario:

Frecuencia | Uso 

| 220 Hz | Error / acción imposible
| 360 Hz | Cancelar / cerrar
| 540 Hz | Navegación por menús
| 720 Hz | Confirmar / seleccionar
| 880 Hz | Interacciones de UI
| 960 Hz | Confirmaciones importantes

En el texto del diálogo (intro), los blips tienen un jitter de ±60 Hz aleatorio por carácter para dar sensación orgánica al "tipeo".

### BGM — loop de 8 compases

El bucle musical está compuesto de tres voces que suenan simultáneamente:

**Voz lead (melodía)** — onda cuadrada, escala de La menor:
```
A4 C5 E5 C5 | A4 G4 E4 G4
F4 A4 C5 A4 | F4 E4 D4 C4
A4 C5 E5 G5 | E5 C5 A4 C5
G4 B4 D5 F5 | D5 B4 G4 _
```

**Voz bajo** — onda triangular (más cálida), una octava por debajo de la melodía. El bajo decae 1.4× más lento que el step para que las notas "sangren" y den calidez.

**Hi-hat** — buffer de ruido blanco de 40ms activado en steps alternos (cada medio tiempo). Los valores del buffer son muestras aleatorias en `[-0.5, 0.5]`.

**Tempo**: 210ms por step (~286 BPM en semicorcheas) → el loop completo dura ~8.96 segundos.

El secuenciador funciona con `setInterval` y los sonidos se programan 10ms en el futuro (`ctx.currentTime + 0.01`) para dar margen al hilo de audio.

---

## 5. Secuencia de introducción

**Archivo**: `public/game/pages/daw-intro.jsx`

La intro es una máquina de estados de tres fases que se ejecuta la primera vez que el jugador entra al juego. Se puede omitir en cualquier momento con `ESC`.

### Fase 1 — Lore (text crawl)

Texto animado con CSS que asciende de abajo hacia arriba, estilo Star Wars. Detrás hay un starfield generado con el mismo LCG determinista que la pantalla de título.

- Duración: 28s en escritorio, 40s en móvil (el texto es más largo verticalmente en pantallas estrechas)
- `Enter`/`Space` abre un diálogo de confirmación para saltar
- `ESC` omite directamente

### Fase 2 — Diálogo

Cuatro personajes hablan en secuencia mediante efecto de máquina de escribir (24ms por carácter). El nombre del jugador se interpola en el texto con `{NAME}`.

- **Primer `Enter`**: completa el texto instantáneamente (sin esperar al typewriter)
- **Segundo `Enter`**: avanza al siguiente mensaje
- El retrato de cada personaje se renderiza con `PortraitSprite` — SVG de 24×24px generado desde una cuadrícula de caracteres glífico

### Fase 3 — Depart

Tres tarjetas de título aparecen en fade secuencial (0.8s, 2.4s, 4.2s de delay):

```
A NEW PROCESS HAS BEGUN
YOUR JOURNEY, {NAME}...
...STARTS NOW
```

---

## 6. Mapa del mundo

**Archivo**: `public/game/pages/daw-map.jsx`

El juego tiene tres mundos (sectores) con topología de grafo de nodos. El jugador navega entre nodos usando las teclas de flecha y selecciona encuentros.

### Estructura de un mundo

```javascript
{
  id: 'w1',
  name: 'SECTOR 1 / DESKTOP',
  nodes: [
    { id:'start', x:80,  y:240, type:'save',  label:'/ROOT',   sub:'SAVE POINT' },
    { id:'n1',    x:200, y:200, type:'fight', label:'PROCESS 1', encounter:{...} },
    // ...
    { id:'boss',  x:900, y:240, type:'boss',  label:'ROOTKIT', encounter:{...} }
  ],
  edges: [['start','n1'], ['n1','n2'], ...]
}
```

### Tipos de nodo

| Tipo | Icono | Comportamiento |
|---|---|---|
| `save` | Disquete | Nodo de checkpoint. En la primera visita abre un diálogo obligatorio con efecto typewriter; el jugador debe leer todas las páginas para desbloquear la ruta. Al completarlo se conceden ítems de recompensa y se registra el clear mediante `onClearNode`. En revisita el diálogo es opcional (ESC para cerrar) y no vuelve a dar recompensa. |
| `fight` | Espada | Desencadena una batalla estándar |
| `mini` | Triángulo | Miniboss — enemigo más duro |
| `boss` | Cráneo 9×9 | Jefe final del sector. Desbloquea el siguiente mundo |
| `shop` | `$` | Tienda. Se marca como visitado sin combate |

### Navegación entre nodos (`pickDirectional`)

Al pulsar una tecla de flecha, el motor calcula cuál de los nodos adyacentes está más alineado con esa dirección usando producto escalar:

```
Para cada vecino adyacente:
  vector = vecino.pos - nodo_actual.pos
  normalizar(vector)
  score = dot(vector, dirección_deseada)
  umbral = 0.2  (evita seleccionar nodos casi perpendiculares)
Retorna el vecino con mayor score
```

### Animación de movimiento

`moveTo()` usa `requestAnimationFrame` para mover el token del jugador en 600ms con interpolación lineal. El mapa no se desmonta entre visitas (`display:none`) para conservar el estado. La función guarda también un bloqueo anticipado si hay un diálogo de checkpoint activo (`checkpointNode !== null`), evitando movimientos fantasma mientras el jugador lee un checkpoint.

### Renderizado de aristas

Las aristas se iluminan en color crema cuando al menos un extremo está completado. Las aristas entre nodos no alcanzados se muestran en color oscuro/dim.

### Sistema de checkpoint (nodos `save`)

Los nodos `save` del mapa son **checkpoints narrativos obligatorios**. Cada uno lleva asociado un array `dialogue[]` con páginas de texto y un array `reward[]` con ítems.

**Componentes** (definidos al inicio de `daw-map.jsx` para poder cargarlos antes que `daw-profile.jsx`):

- **`CheckpointPortrait`** — renderiza el retrato del hablante. Si la página tiene `speakerImage.dataUrl` muestra la imagen; si no, muestra la inicial del nombre en una caja pixelada.
- **`CheckpointDialog`** — overlay de pantalla completa que gestiona toda la interacción:
  - Efecto typewriter por página (22 ms/carácter). Usa `cancelTypingRef` para cortar el tick en vuelo cuando el jugador pulsa Enter antes de que termine.
  - `fullRef` y `piRef` dan a los closures de teclado acceso sin stale-capture al estado de "texto completo" y al índice de página actual.
  - Primer Enter/toque: completa el texto instantáneamente. Segundo Enter: avanza a la siguiente página.
  - Al terminar todas las páginas entra en la **fase de recompensa**: muestra los ítems recibidos y un botón CONTINUE.
  - En modo `replay=true` (revisita), ESC cierra sin efectos. En primera visita, ESC no está disponible.

**Flujo en `enterNode` (WorldMap):**
```
Primera visita + tiene dialogue/reward
  → setCheckpointNode({ node, replay: false })  // abre CheckpointDialog
  → onClear(reward) → setCleared + onClearNode(nodeId, worldId, reward)

Primera visita + sin dialogue ni reward
  → marca cleared silenciosamente, llama onClearNode([])

Revisita
  → setCheckpointNode({ node, replay: true })   // diálogo opcional
```

**Datos de cada nodo save:**
```javascript
{
  dialogue: [
    { speakerName: 'ORACLE', speakerImage: null, text: 'TEXTO...' },
    { speakerName: 'CURSOR', speakerImage: null, text: 'TEXTO...' },
  ],
  reward: [
    { itemId: 'patch', qty: 2 },
    { itemId: 'buffer', qty: 1 },
  ]
}
```

**Propagación de recompensas** (`daw-app.jsx`):
```javascript
onClearNode={(nodeId, worldId, reward) => {
  const key = `${worldId}:${nodeId}`;
  setClears(c => c.includes(key) ? c : [...c, key]);
  reward.forEach(r => setShopInv(inv => ({
    ...inv, [r.itemId]: (inv[r.itemId] || 0) + (r.qty || 1)
  })));
}}
```

### Desbloqueo de mundos

- W1: disponible desde el registro
- W2: se desbloquea al derrotar al jefe de W1
- W3: se desbloquea al derrotar al jefe de W2
- Los mundos bloqueados muestran `???` + 🔒 en el selector (Tab/Shift+Tab)

### Tutorial de combate

Antes del primer combate (nodo `w1:n1`) se muestra un overlay de 7 páginas que explica el sistema de batalla. Puede omitirse con `ESC`. El estado se guarda en `localStorage` con la clave `daw.tutorial.done`.

---

## 7. Sistema de batalla ATB

**Archivos**: `public/game/battle/daw-battle.jsx`, `daw-battle-ui.jsx`, `daw-battle-sprites.jsx`

El combate usa un sistema de **Active Time Battle (ATB)**: las barras de tiempo de cada unidad se llenan continuamente según su velocidad. Cuando una barra llega a 100, es el turno de esa unidad.

### Ciclo de juego

```
1. Inicializar unidades (héroes + enemigos del nodo)
2. Tick continuo: cada unidad incrementa su ATB gauge
   atb += speed * turnSpeed  (por frame a ~60fps)
3. Si gauge de héroe ≥ 100 → pausar juego, mostrar menú de acción
4. Si gauge de enemigo ≥ 100 → IA ejecuta acción automáticamente
5. Resolver acción: aplicar daño/curación, efectos de estado, animaciones
6. Comprobar condición de victoria/derrota
7. Volver al paso 2
```

### Escala por tier (1-7)

Los enemigos escalan según el tier del nodo:

```
HP multiplicador  = 1 + (tier - 1) × 0.25
DMG multiplicador = 1 + (tier - 1) × 0.15
SPD multiplicador = 1 + (tier - 1) × 0.04
```

Los jefes (flag `boss: true`) reciben bonus adicionales definidos por las constantes `BOSS_HP_MULT = 1.3` (+30% HP y curación) y `BOSS_DMG_MULT = 1.4` (+40% daño).

### Héroes base

| Nombre | HP | CPU | SPD | Rol | Habilidad especial |
|---|---|---|---|---|---|
| CURSOR.EXE | 220 | 60 | 1.3 | POINTER | `click()` — ataque gratuito |
| GUARD.SYS | 410 | 80 | 0.95 | TANK | `patch.dll()` — curación 60-90 |
| PURGE.BAT | 175 | 100 | 1.1 | PURIFIER | `kill -9` — daño 44-72 |
| PING.DLL | 160 | 70 | 1.5 | SCOUT | `ping()` — daño barato 14-24 |
| ROOT.SH | 280 | 90 | 1.0 | ADMIN | `sudo whoami` — flexible |
| INDEX.LOG | 200 | 85 | 0.85 | ARCHIVIST | `log.write()` — apoyo |

### Acciones del jugador

| Acción | Coste | Efecto |
|---|---|---|
| **EXECUTE** | 0 CPU | Ataque básico (rango `atk`) |
| **SCRIPT** | Variable CPU | Habilidad específica del héroe |
| **ITEM** | — | Consumible del inventario |
| **GUARD** | — | Reduce el daño recibido a la mitad en el siguiente golpe |
| **LIMIT** | Carga especial | Super ataque único por héroe |
| **FLEE** | — | Intento de huida (probabilidad aleatoria) |

### Efectos de estado

| Efecto | Comportamiento |
|---|---|
| `shield` | Reduce el daño N veces (se decrementa por golpe) |
| `taunt` | Los enemigos priorizan atacar a esta unidad |
| `expose` | El próximo ataque contra este objetivo es crítico garantizado |
| `silence` | El enemigo no puede actuar. El contador se decrementa cada tick cuando la barra ATB está a 100; al expirar, la barra se resetea a 0 para evitar un turno gratuito inmediato. |
| `freeze` | La barra ATB de la unidad no avanza durante N ticks |

### Renderizado de sprites en batalla

`BSprite` renderiza SVG de pixel art (16×18 px × escala) usando una cuadrícula de caracteres:

| Carácter | Color |
|---|---|
| `#` | body (color principal) |
| `r` | rim (borde/luz) |
| `k` | dark (sombra) |
| `a` | acc (detalle/arma) |
| `e` | eye (ojos/brillo) |
| `.` | transparente |

---

## 8. Editor de personajes y sprites (Dev Mode)

**Archivo**: `public/game/pages/daw-devmode.jsx`

Dev Mode es el estudio de creación de mods del juego. Se accede desde el menú principal y está actualmente desbloqueado para todos los jugadores (`DEVMODE_FORCE_UNLOCK = true`). La intención es requerir haber derrotado a los tres jefes para acceder.

### Gestión de borradores

Los mods se almacenan como borradores por cuenta en `localStorage`:
- Clave: `daw.devmode.drafts.v2.{account_id}`
- Un mismo usuario puede tener múltiples borradores
- Cada borrador tiene: `draftId`, `title`, `cover`, `intro`, `heroes[]`, `enemies[]`, `map{}`

### Aislamiento de datos por cuenta

Para garantizar que cada usuario vea únicamente sus propios borradores:

- `loadDevDrafts(uid)` y `saveDevDrafts(arr, uid)` devuelven `[]` / no escriben nada si `uid` es falsy (p. ej. mientras la cuenta aún está cargando), evitando que los datos aterricen en la clave compartida `…undefined`.
- La migración de formato antiguo (`migrateLegacyDevProject`) solo importa la clave `daw.devmode.v1` (formato anterior a soporte multi-usuario, pertenece al usuario del dispositivo). La clave intermedia `daw.devmode.drafts.v2` (sin sufijo de uid) **no se migra** porque era global a todos los usuarios y copiarla a cada nuevo usuario supone una fuga de datos.
- El endpoint `GET /api/mods/by-author/{authorId}` filtra por `is_published = 1` en la base de datos, de modo que los mods no publicados de otros usuarios nunca son expuestos a terceros.

### Editor de sprites (`SpriteEditor`)

El editor de pixel art trabaja sobre una cuadrícula de **16 columnas × 18 filas** de caracteres glífico. Cada celda almacena un carácter que representa un slot de paleta.

**Herramientas disponibles**:
- **Transparent** (`.`): borrar pixel
- **Body** (`#`): color principal del personaje
- **Rim** (`r`): borde iluminado
- **Dark** (`k`): sombra
- **Acc** (`a`): detalle o accesorio
- **Eye** (`e`): ojos / brillo especial

**Funcionamiento interno**:
```javascript
// El sprite es un array de strings, una por fila:
sprite = [
  '....######......',   // fila 0
  '...########.....',   // fila 1
  // ...
]

// Pintar un pixel:
function setSpriteCell(sprite, row, col, glyph) {
  const next = sprite.slice();
  next[row] = next[row].substring(0, col) + glyph + next[row].substring(col + 1);
  return next;
}
```

El usuario puede hacer clic y arrastrar para pintar. La última celda pintada se cachea en un `ref` para evitar repintados redundantes en el mismo pixel.

### Paletas predefinidas

Hay 6 paletas de inicio que el editor carga en nuevos personajes:

| Nombre | Uso sugerido |
|---|---|
| CURSOR | Protagonista verde oliva |
| GUARD | Tank azul metálico |
| PURGE | Atacante rosa/magenta |
| WORM | Enemigo marrón terroso |
| GHOUL | Espectro azul pálido |
| SLIME | Criatura dorada/marrón |

### Estadísticas de héroes y enemigos

Además del sprite, cada personaje tiene un bloque de estadísticas editable:

**Héroes**: HP máx, CPU máx, velocidad, rango de ataque `[min, max]`, biografía, rol, nombre y descripción del Limit, array de habilidades.

**Enemigos**: HP, velocidad, XP que otorgan, rango de daño `[min, max]`, array de ataques.

### Habilidades de héroe (`HeroAbilitiesForm`)

Cada héroe puede tener hasta **6 habilidades**. El editor muestra una fila por habilidad con los siguientes campos:

| Campo | Límite | Descripción |
|---|---|---|
| Label | 28 chars | Nombre mostrado en el menú de batalla, p. ej. `ping(target)` |
| Kind | — | Tipo de efecto (ver tabla) |
| CPU Cost | 0–60 | Puntos de CPU que cuesta usar la habilidad |
| DMG min/max | 0–300 | Rango de daño (solo en kinds que lo requieren) |
| HEAL min/max | 0–400 | Rango de curación (solo en kinds que lo requieren) |
| STATUS FX | — | Efecto de estado opcional que aplica al usar la habilidad |
| Description | 80 chars | Tooltip breve visible en el menú de batalla |

**Tipos de habilidad** (`kind`):

| Kind | Necesita | Descripción |
|---|---|---|
| `single` | `dmg` | Daño a un objetivo |
| `aoe` | `dmg` | Daño a todos los enemigos |
| `heal` | `heal` | Curación a un aliado |
| `aoehel` | `heal` | Curación a todo el grupo |
| `buff` | — | Mejora un aliado (efecto de estado) |
| `debuff` | — | Debilita un enemigo (efecto de estado) |

Efectos de estado aplicables: `knockback`, `expose`, `shield`, `taunt`, `silence`, `freeze`, `haste`.

Al cambiar el `kind`, el editor añade automáticamente el campo numérico requerido (`dmg` o `heal`) y elimina el que ya no aplica, para que el objeto inyectado al motor no tenga campos residuales.

### Ataques de enemigo (`EnemyAttacksForm`)

Cada enemigo puede tener hasta **5 movimientos**. El motor elige **uno al azar** cada turno del enemigo, por lo que el orden no importa. Si el array está vacío, el motor utiliza un ataque genérico `BITE` por defecto.

| Campo | Límite | Descripción |
|---|---|---|
| Nombre | 18 chars, UPPERCASE | Aparece en el log de batalla |
| Kind | — | Tipo de movimiento (ver tabla) |
| DMG min/max | 0–300 | Solo si `kind` es `single` o `aoe` |
| HEAL min/max | 0–300 | Solo si `kind` es `heal` |

**Tipos de movimiento** (`kind`):

| Kind | Necesita | Descripción |
|---|---|---|
| `single` | `dmg` | Daño a un único héroe |
| `aoe` | `dmg` | Daño a todo el grupo |
| `heal` | `heal` | El enemigo se cura a sí mismo o a un aliado |
| `shield` | — | El enemigo aplica escudo sobre sí mismo |
| `buff` | — | El enemigo se aplica haste |

En la inyección (`injectProject`), el nombre se trunca a 18 chars y se convierte a mayúsculas. Los campos `dmg`/`heal` se normalizan a entero para evitar que cadenas vacías o `undefined` lleguen al motor de batalla.

**Estructura interna de un ataque:**
```javascript
{ id: 'ax7k2', name: 'CORRUPT', kind: 'single', dmg: [12, 20] }
{ id: 'ax3p9', name: 'SELF REPAIR', kind: 'heal', heal: [30, 50] }
```

### Almacenamiento de borradores y niveles

Los mods se persisten íntegramente en `localStorage` como borradores por cuenta. La clave es `daw.devmode.drafts.v2.{account_id}` y el valor es un objeto JSON con un array `drafts`.

**Estructura completa de un borrador:**
```javascript
{
  draftId:     'dr_lp9z4abc',  // timestamp36 + random suffix
  publishedId: null,            // id de la API una vez publicado, o null
  updatedAt:   1717000000000,  // timestamp Unix (ms)
  cover:       null,            // data-URL de la portada, o null

  title:  'MY DAW MOD',
  author: 'USER',
  intro:  'WELCOME TO MY MOD.\n...',

  heroes:  [ /* array de hasta 3 objetos héroe */ ],
  enemies: [ /* array de hasta 8 objetos enemigo */ ],

  map: {
    nodes: [ /* array de hasta 12 nodos */ ],
    edges: [ /* array de pares de ids */ ]
  }
}
```

**Estructura de un nodo de combate dentro del mapa:**
```javascript
{
  id:    'n1',
  x:     300,           // coordenada X en el viewBox (0–1000)
  y:     200,           // coordenada Y en el viewBox (0–420)
  type:  'fight',       // 'fight' | 'mini' | 'boss' | 'save' | 'shop'
  label: '1-1  FIRST BUG',
  sub:   'TRIVIAL ENCOUNTER',
  encounter: {
    enemies: ['CUSTOM.E.A', 'CUSTOM.E.A'],  // IDs de enemigos del mod
    bg:      'POPUP MOOR',                   // nombre del escenario de batalla
    tier:    1,                              // dificultad 1–7
    boss:    false                           // true solo en nodos boss
  }
}
```

**Aristas**: array de pares `[idOrigen, idDestino]` que definen la topología del grafo. Las aristas son bidireccionales a efectos de navegación; el motor construye la lista de adyacencia en tiempo de ejecución al cargar el mundo.

```javascript
edges: [['start','n1'], ['n1','n2'], ['n2','boss']]
```

**Migración de formatos antiguos**: `migrateProject()` rellena `abilities` y `attacks` en proyectos guardados antes de que esos campos existieran. `migrateLegacyDevProject()` copia la clave de formato v1 (`daw.devmode.v1`) a la clave por uid la primera vez que un usuario hace login, garantizando que los borradores previos al soporte multi-usuario no se pierdan.

---

## 9. Editor de mapas por nodos (Dev Mode)

**Archivo**: `public/game/pages/daw-devmode.jsx` — sección `MapEditor`

El editor de mapas es un canvas SVG interactivo de **1000×420 unidades de viewBox** donde el creador coloca nodos y los conecta con aristas para definir el recorrido del jugador.

### Límites

| Parámetro | Límite |
|---|---|
| Nodos máximos por mapa | 12 |
| Héroes en el party | 3 |
| Héroes en el mod | 3 |
| Enemigos en el mod | 8 |

### Modos del editor

| Modo | Acción |
|---|---|
| **MOVE** | Arrastrar nodos para reposicionarlos |
| **ADD** | Clic en el canvas vacío para crear un nodo |
| **EDGE** | Primer clic selecciona origen; segundo clic crea la arista |
| **ERASE** | Clic en un nodo lo elimina junto con sus aristas |

### Tipos de nodo en el editor

| Tipo | Color | Glifo |
|---|---|---|
| `fight` | Rojo oscuro | ⚔ |
| `mini` | Púrpura | ☠ |
| `boss` | Rojo vivo | ☣ |
| `save` | Verde | ⚑ |
| `shop` | Azul | $ |

### Editor de nodos save (checkpoint)

Cuando se selecciona un nodo de tipo `save`, el panel lateral muestra el `CheckpointNodeEditor`, compuesto por:

- **Sección DIALOGUE** — hasta 8 entradas. Cada entrada (`CheckpointEntryEditor`) permite:
  - Elegir la imagen del hablante mediante `window.AvatarEditorModal` (el mismo editor de imagen de perfil), con preview vía `window.AvatarDisplay`.
  - Escribir el nombre del hablante.
  - Redactar el texto de la página en un textarea con resize vertical.
- **Sección REWARD ITEMS** — hasta 6 filas. Cada fila elige un ítem del catálogo (8 ítems disponibles) y una cantidad (1–9).

> `window.AvatarEditorModal` y `window.AvatarDisplay` se acceden en tiempo de render (no en parse time) porque `daw-devmode.jsx` carga después de `daw-profile.jsx`, que es quien los expone en `window`.

### Arrastre de nodos — implementación

El modo **MOVE** usa listeners globales en `window` montados una sola vez (array de dependencias vacío en el `useEffect`). Los valores de `map` y `onMap` que necesita el handler se mantienen actualizados mediante dos refs sincronizadas:

```javascript
const mapRef   = useRefD(map);
const onMapRef = useRefD(onMap);
useEffectD(() => { mapRef.current = map; }, [map]);
useEffectD(() => { onMapRef.current = onMap; }, [onMap]);

useEffectD(() => {
  function move(e) {
    if (!draggingRef.current) return;
    const p = svgPoint(e);
    const cur = mapRef.current;
    onMapRef.current({ ...cur, nodes: cur.nodes.map(n =>
      n.id === draggingRef.current.id ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n
    )});
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', () => { draggingRef.current = null; });
  // …cleanup
}, []); // ← nunca se re-suscribe; no hay gap entre renders donde se pierda el evento
```

El SVG tiene `touch-action: none; user-select: none` en CSS y `onNodeMouseDown` llama a `e.preventDefault()` para impedir que el scroll de página compita con el arrastre.

### Propiedades de un nodo de combate

Cuando se selecciona un nodo de tipo `fight`, `mini` o `boss`, aparece un panel lateral para configurar:
- **Label**: nombre visible en el mapa
- **Subtitle**: texto descriptivo
- **Enemies**: lista de IDs de enemigos del mod que aparecen en ese encuentro
- **Background**: nombre del escenario de batalla
- **Tier**: escala de dificultad (1-7)

Los IDs de enemigos en un encuentro de mod siguen el formato `CUSTOM.E.A`, `CUSTOM.E.B`, etc.

### Coordenadas en viewBox

Las posiciones de los nodos se almacenan en coordenadas del viewBox (0–1000 horizontal, 0–420 vertical). La función `svgPoint()` convierte eventos de ratón a estas coordenadas:

```javascript
function svgPoint(e) {
  const rect = svgRef.current.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 1000;
  const y = ((e.clientY - rect.top) / rect.height) * 420;
  return { x: clamp(x, 40, 960), y: clamp(y, 40, 380) };  // margen de 40px
}
```

### Inyección en el motor de juego (`injectProject`)

Cuando el jugador pulsa **PLAYTEST**, `injectProject()` escribe el mod directamente en los globales del motor:

```javascript
// Héroes → window.HEROES_DEF
HEROES_DEF[hero.id] = { sprite, palette, stats, scripts };

// Enemigos → window.ENEMY_KINDS
ENEMY_KINDS[enemy.id] = { grid, hp, dmg, spd, xp, attacks };

// Mapa → window.WORLDS (añade/reemplaza mundo 'wDEV')
WORLDS.push({ id:'wDEV', name:'DEV / TÍTULO', nodes, edges });
```

Esto permite probar el mod en el mapa y la batalla sin recargar la página. Al salir del playtest, `daw-app.jsx` restaura el snapshot del estado real del jugador.

---

## 10. Comunidad: publicación y descubrimiento de mods

**Archivo**: `public/game/pages/daw-mapshare.jsx`

La página de comunidad permite publicar mods propios y jugar los de otros usuarios.

### Publicación

Desde **Dev Mode → MY MODS → PUBLISH**, el mod se serializa en un blob JSON:

```javascript
const dataBlob = JSON.stringify({
  intro, heroes, enemies,
  map: { nodes, edges },
  cover,          // avatar opcional del mod
});
```

Este blob se envía a la API (`POST /api/mods`) y se almacena en la columna `mod_data` (tipo `MEDIUMTEXT`) de la tabla `community_mods`.

### Datos del listado vs datos completos

La lista de mods (`GET /api/mods`) no devuelve el blob completo para mantener la respuesta ligera. El blob solo se descarga cuando el jugador selecciona un mod (`GET /api/mods/{id}`). La página cachea los covers ya cargados en un `ref` para no repetir peticiones.

### Ordenación

| Criterio | Comportamiento |
|---|---|
| NEW | Por fecha de actualización, más reciente primero |
| MOST PLAYED | Por `play_count` descendente |
| TOP LIKED | Por número de valoraciones descendente |
| FOLLOWING | Mods de autores seguidos primero, luego por fecha |

### Sistema de likes

Un like en la UI envía una valoración de 5 estrellas a la API (`POST /api/mods/{id}/ratings`). El estado local de "me gusta" se persiste en `localStorage` bajo `daw.liked.{account_id}` para que sea inmediato y no dependa de round-trips.

### Sistema de seguimiento de autores

El sistema de follow es completamente funcional y opera en dos niveles:

**Botón inline en el panel de detalle** — visible cuando el jugador está autenticado y visualiza el mod de otro usuario. Llama directamente a la API sin abrir ningún modal:

```javascript
async function handleFollowToggle(authorId, authorName) {
  if (followingIds.has(authorId)) {
    await DAW_API.unfollow(account.id, authorId);
    setFollowingIds(s => { const n = new Set(s); n.delete(authorId); return n; });
  } else {
    await DAW_API.follow(account.id, authorId);
    setFollowingIds(s => new Set([...s, authorId]));
  }
}
```

El botón muestra `+ FOLLOW` / `✓ FOLLOWING` según el estado, y `· · ·` durante la petición en vuelo.

**Indicador en las filas de la lista** — cada mod cuyo autor ya se sigue muestra una etiqueta "FOLLOWING" en verde junto al título, para identificar rápidamente el contenido de personas seguidas.

**`AuthorFollowOverlay`** — modal que sigue abriéndose al hacer clic en el nombre del autor; útil para ver el nombre completo y follow/unfollow sin entrar en el detalle del mod.

**Endpoints de la API social:**

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/social/follow?followerId={id}&targetId={id}` | Crear seguimiento |
| `DELETE` | `/api/social/unfollow?followerId={id}&targetId={id}` | Eliminar seguimiento |
| `GET` | `/api/social/following/{accountId}` | Perfiles completos de seguidos |
| `GET` | `/api/social/following-ids/{accountId}` | Solo IDs (payload ligero) |
| `GET` | `/api/social/is-following?followerId={id}&targetId={id}` | Comprobación booleana |

Al cargar la página se llama a `getFollowingIds` para poblar el `Set` local que alimenta tanto el filtro "FOLLOWING" como los indicadores visuales, sin necesidad de una petición por mod.

### Play count

Cada vez que un jugador pulsa **INSTALL & PLAY**, se registra un play (`POST /api/mods/{id}/play`) antes de cargar el mod. Los errores en este registro se ignoran para no bloquear la jugabilidad.

---

## 11. Panel de administración

**Archivo**: `public/game/pages/daw-admin.jsx`

Accesible solo para cuentas con `is_admin = true`. Tiene dos pestañas.

### Pestaña USERS

- Lista de todos los usuarios con buscador por nombre o email
- Al seleccionar un usuario se muestra:
  - Identidad (email, fecha de creación, último login)
  - Estadísticas: cartera, clears, héroes, mundos
  - Party actual e inventario
- **Acciones disponibles**:
  - **SET WALLET**: editar el balance de bits manualmente
  - **GRANT/REVOKE ADMIN**: alternar flag de administrador
  - **UNLOCK EVERYTHING**: conceder todos los héroes, todos los mundos y 99.999 bits

### Pestaña SPRITES

Editor de sobreescritura global de sprites y estadísticas de héroes y enemigos. Los cambios aplicados aquí afectan a **todos los jugadores** sin excepción.

**Flujo de trabajo**:
1. Seleccionar héroe o enemigo de la lista
2. Editar sprite en el canvas de pixel art
3. Modificar paleta de colores (5 inputs de color)
4. Ajustar estadísticas (HP, CPU, SPD, ATK, scripts)
5. **HOT-APPLY**: aplica los cambios en la sesión actual llamando `window.applySprites()` para preview inmediato
6. **PUSH ALL CHANGES**: envía el objeto `overrides` completo a la API

**Sincronización con el código fuente**: los overrides guardados aquí se almacenan en `game_settings.sprite_overrides` y se aplican sobre los valores hardcodeados en `daw-battle.jsx` (`HEROES_DEF`) y `daw-battle-sprites.jsx` (`ENEMY_KINDS`) al arrancar la app. Cuando el diseño de una unidad quede definitivo, copiar los valores del override al código fuente para que sean los defaults reales. Esto garantiza que una instalación desde cero con base de datos vacía también muestre los valores correctos.

**Estructura del objeto de overrides**:
```javascript
overrides: {
  heroes: {
    "CURSOR.EXE": { grid, body, rim, dark, acc, eye, hpMax, cpuMax, spd, atk, scripts }
  },
  enemies: {
    "POPUP.IMP": { grid, body, rim, dark, acc, eye, hp, spd, xp, dmg, attacks }
  }
}
```

---

## 12. Autenticación y sesión

### Registro

1. El usuario envía nombre, email y contraseña
2. La API hashea la contraseña con BCrypt (work factor 12)
3. Se genera un token UUID de verificación y se envía por email vía MailKit/SMTP
4. La cuenta queda con `is_verified = false` hasta que el usuario hace clic en el enlace
5. Si no llega el email, se puede reenviar desde la pantalla de login

El formulario de registro valida el email con la expresión regular `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` para rechazar formatos claramente inválidos como `a@b.` antes de enviarlos al servidor. Los inputs tienen los atributos `autoComplete="username"`, `autoComplete="new-password"` y `autoComplete="current-password"` para integración correcta con gestores de contraseñas.

### Login

1. El usuario envía email + contraseña
2. La API verifica BCrypt y comprueba `is_verified`
3. Si todo es correcto, devuelve un token de sesión que el frontend almacena en `localStorage`
4. En cada recarga, el frontend valida el token contra la API y rehidrata el estado del jugador

### Seguridad

- Contraseñas: nunca se almacenan en texto plano; solo el hash BCrypt
- CORS: solo `localhost:5173` y `localhost:4173` pueden llamar a la API
- Las rutas de admin validan el flag `is_admin` en la base de datos, no solo en el frontend

---

## 13. Guardado automático

`daw-app.jsx` implementa un guardado automático con **debounce de 3 segundos**. Siempre que cambia el estado del jugador (cartera, inventario, progreso, party), se programa una llamada a la API que se ejecuta 3 segundos después si no hay más cambios. Esto evita spam de peticiones durante navegación rápida.

### Datos que se guardan

```javascript
{
  wallet,         // bits del jugador
  party,          // array de 3 nombres de héroe
  heroes,         // héroes desbloqueados
  worlds,         // mundos desbloqueados
  clears,         // nodos completados ['w1:n1', 'w1:boss', ...]
  inventory,      // { patch, restore, buffer, rootkit, ... }
  playtime,       // segundos totales jugados
}
```

El guardado está bloqueado (`skipSaveRef`) durante la carga inicial de sesión para evitar sobreescribir datos reales con los valores por defecto.

### Transacción en la API

El endpoint `POST /api/progress/save` escribe en 6 tablas de forma atómica usando `IDbTransaction`. Si cualquier escritura falla, toda la operación se revierte:

```
player_progress       → estadísticas generales
player_party          → composición del grupo
player_inventory      → consumibles
player_clears         → nodos completados
player_worlds_unlocked → mundos desbloqueados
player_unlocked_heroes → héroes desbloqueados
```

---

## 14. Sistema de temas visuales (CRT y paletas de mundo)

### Aplicación sin flash de primer frame

El tema se aplica con `useLayoutEffect` (no `useEffect`) para garantizar que las variables CSS estén correctas antes de que el navegador pinte el primer frame tras el login o la restauración de sesión. Usar `useEffect` causaba un flash de un frame con los colores por defecto del Mundo 1 (definidos en el `:root` de `index.html`) antes de que la paleta correcta del mundo del jugador se aplicase.

```javascript
useLayoutEffect(() => {
  applyTheme(currentWorldId, settings.mode, route);
}, [currentWorldId, settings.mode, route]);
```

`applyTheme` escribe en el `:root` del documento mediante `style.setProperty`, por lo que el cambio es síncrono y el navegador lo recoge en el mismo frame de layout.



El juego tiene tres modos de visualización configurables desde Options:

| Modo | Efecto |
|---|---|
| **CRT OFF** | Pantalla limpia sin efectos |
| **CRT ON** | Scanlines con `repeating-linear-gradient` + viñeta de fósforo |
| **CRT CURVE** | Todo lo anterior + curvatura 3D con `perspective(1400px) rotateX(0.6deg)` |

Los scanlines se implementan en CSS puro con `::before` y `::after` sobre el elemento `.crt`:

```css
.crt::before {
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px,
    rgba(0,0,0,.32) 3px, rgba(0,0,0,.32) 3px
  );
  mix-blend-mode: multiply;
}
```

La viñeta imita el oscurecimiento de los bordes de un tubo de rayos catódicos con `radial-gradient`.

---

## 15. Variables CSS y paleta de colores

Definidas en `index.html` bajo `:root`. El tema por defecto es **PHOSPHOR** (verde fósforo):

```css
:root {
  --bg-0:      #06150c;   /* negro profundo — fondo base */
  --bg-1:      #0d2818;   /* verde muy oscuro */
  --bg-2:      #143a25;   /* verde oscuro — terreno, paneles */
  --fg-dim:    #5a8a3a;   /* texto secundario / apagado */
  --fg:        #a5b985;   /* texto principal */
  --fg-bright: #d4f4a3;   /* texto resaltado / activo */
  --hl:        #d4a373;   /* naranja ámbar — acento cálido */
  --cream:     #fefae0;   /* blanco crema — texto de diálogo */
  --jrpg-blue: #101a6e;   /* azul JRPG — cuadros de diálogo */
  --dmg:       #ff8a3a;   /* daño recibido */
  --crit:      #ffdc4a;   /* golpe crítico */
  --heal:      #a5e58a;   /* curación */
  --block:     #9bc4ff;   /* bloqueo / escudo */
  --bad:       #ff6ec7;   /* estado negativo */
}
```

Todos los componentes del juego usan estas variables, de modo que cambiar el tema reemplaza la paleta completa sin tocar el código de render.

---

## 16. Referencia de archivos

| Archivo | Descripción | Líneas aprox. |
|---|---|---|
| `public/game/core/daw-app.jsx` | Raíz de la app, router, estado global, audio | ~1170 |
| `public/game/pages/daw-intro.jsx` | Menú principal y secuencia de intro | ~540 |
| `public/game/core/daw-graphics.jsx` | Escena SVG del menú principal | ~194 |
| `public/game/pages/daw-map.jsx` | Mapa del mundo por nodos | ~870 |
| `public/game/battle/daw-battle.jsx` | Motor de combate ATB | ~800 |
| `public/game/battle/daw-battle-ui.jsx` | Interfaz del combate | ~500 |
| `public/game/battle/daw-battle-sprites.jsx` | Renderizado de sprites en batalla | ~200 |
| `public/game/battle/daw-battle-bg.jsx` | Fondos animados de batalla | — |
| `public/game/core/daw-audio.jsx` | Síntesis de audio (BGM + blips) | ~169 |
| `public/game/api/daw-api.jsx` | Capa HTTP de la API. La URL base es relativa en producción (`''`) y `http://localhost:5094` en desarrollo local (detección automática por `location.hostname`). | ~90 |
| `public/game/pages/daw-admin.jsx` | Panel de administración | ~960 |
| `public/game/pages/daw-devmode.jsx` | Editor de mods (sprites + mapa) | ~1700 |
| `public/game/pages/daw-mapshare.jsx` | Comunidad de mapas | ~612 |
| `public/game/pages/daw-shop.jsx` | Tienda de ítems | — |
| `public/game/pages/daw-profile.jsx` | Perfil del jugador | — |
| `public/game/pages/daw-options.jsx` | Opciones (volumen, CRT, tema) | — |
| `public/game/pages/daw-login.jsx` | Login y registro | — |
| `public/game/core/tweaks-panel.jsx` | Panel de tweaks de desarrollo | — |
| `dawrpg-frontend/dawrpgdb.sql` | Esquema completo de la base de datos | — |
| `dawrpg-api/` | Proyecto ASP.NET Core 9 (API REST) | — |

---

---

## Changelog v1.05

Cambios aplicados tras las pruebas funcionales:

| Área | Cambio |
|---|---|
| **Login** | Regex de email más estricta: rechaza `a@b.` y formatos sin TLD |
| **Login** | Atributos `autoComplete` en todos los inputs del formulario |
| **Batalla** | Bug: el estado `silence` en enemigos nunca expiraba — corregido con decremento por tick y reset de ATB al expirar |
| **Batalla** | Constantes `BOSS_HP_MULT = 1.3` y `BOSS_DMG_MULT = 1.4` extraídas para facilitar el balanceo |
| **Mapa** | `moveTo()` guarda bloqueo adicional cuando hay un checkpoint activo |
| **Perfil** | Achievement "FIRST SECTOR" ya no se desbloquea con entradas de tipo `:start` |
| **Tienda** | Ítems de precio 0 solo pueden comprarse de uno en uno |
| **UI** | Flash de tema W1 en login eliminado (`useEffect` → `useLayoutEffect`) |
| **API** | URL base ahora relativa en producción; `localhost:5094` solo en desarrollo local |
| **SEO** | `<meta name="description">`, Open Graph tags y `<meta name="theme-color">` añadidos |
| **General** | Constante `DAW_VERSION = '1.05'` extraída en `daw-app.jsx` |

*Este documento describe el estado del código tal como está en la rama `main`. Para añadir nuevas funcionalidades, consultar los comentarios en cabecera de cada archivo `.jsx` que detallan su arquitectura interna.*
