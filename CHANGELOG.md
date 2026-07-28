# Changelog - Pigmalea

All notable changes to the Pigmalea project will be documented in this file.

---

## [Unreleased]

## [1.5.0] - 2026-07-28

### Changed
- **Súper-Resolución Delegada al Cliente (`imageProcessor.mjs`, `server.mjs`, `public/`):** El paso de upscaling del pipeline de mejora se ha extraído de `enhanceImage` y se ha delegado al frontend mediante **UpscalerJS** (ESRGAN Slim 2x corriendo sobre TensorFlow.js + WebGL en el navegador). Esto añade detalle real (super-resolution por GAN) en lugar de limitarse a una interpolación Lanczos, manteniendo la filosofía *local-first* (los píxeles nunca salen del dispositivo). El endpoint `POST /api/images/:id/enhance` ya no escala; en su lugar devuelve `ai_upscale_recommendation` y `upscaled_by` para que el frontend decida.

### Added
- **Orquestador de Súper-Resolución en el Frontend (`public/app.js`):** Nueva función `applySuperResolution()` que, tras cada mejora, si el checkbox "Súper-Resolución" está activo, ejecuta ESRGAN 2x en el cliente con `patchSize: 64` y barra de progreso en tiempo real. Si TensorFlow.js no está disponible, el backend no soporta WebGL, o la inferencia falla, se invoca automáticamente el nuevo endpoint `POST /api/images/:id/upscale` como *fallback* clásico Lanczos 2x en el servidor.
- **Endpoint de Fallback de Upscale (`server.mjs`, `imageProcessor.mjs`):** Nuevo `POST /api/images/:id/upscale` que aplica un 2x Lanczos sobre la imagen mejorada (u original si no existe versión mejorada) y persiste el resultado. Utiliza la nueva función exportada `upscaleLanczos()`.
- **Endpoint de Persistencia ESRGAN (`server.mjs`):** Nuevo `POST /api/images/:id/upscale-client` que recibe el blob PNG producido por ESRGAN en el navegador (multipart) y lo persiste como nueva versión mejorada. Esto garantiza que el resultado de la súper-resolución client-side sobreviva a recargas y sea descargable.
- **Scripts UpscalerJS en el Frontend (`public/index.html`):** Carga vía CDN (jsDelivr) de `@tensorflow/tfjs`, `@upscalerjs/esrgan-slim@latest` (modelo 2x) y `upscaler` (UMD), expuestos como globales `tf`, `ESRGANSlim2x` y `Upscaler`.
- **Texto Dinámico del Spinner (`public/index.html`):** El contenedor `enhance-loading` ahora muestra mensajes contextuales según la fase ("Procesando imagen con Sharp...", "Mejorando resolución con IA (ESRGAN 2x)…", "Mejorando resolución (Lanczos en servidor)...").
- **Logging Detallado de SR (`public/app.js`):** Trazas `[SR]` en la consola del navegador para diagnosticar el flujo de súper-resolución: inicialización de TF, backend seleccionado, carga del modelo, progreso por parches, tiempo de ejecución, dimensiones resultantes y persistencia.

### Fixed
- **Feedback Confuso en Súper-Resolución:** El toast "Imagen mejorada correctamente" ya no se muestra dos veces; ahora se muestra una sola vez al final del proceso completo (incluyendo el upscale). El spinner muestra claramente la fase actual con porcentaje de progreso de ESRGAN.
- **Resultado ESRGAN Efímero:** El resultado de ESRGAN (data URL) ahora se persiste al servidor vía `POST /api/images/:id/upscale-client`, de modo que sobrevive a recargas de página y es descargable.
- **Fallback Lanczos No Escalaba Imágenes > 1600px:** El guard `maxWidth: 1600` heredado del pipeline original impedía que el fallback escalara imágenes que ya eran grandes. Ahora `upscaleLanczos()` usa `maxWidth: Infinity` por defecto, por lo que siempre aplica el factor solicitado.

## [1.4.4] - 2026-07-05

### Added
- **IA Sensible al EXIF (`ollama.mjs`):** El análisis de visión ahora inyecta en el prompt un bloque de contexto de captura (`EXIF`) con cámara, lente, apertura, obturación, ISO, focal y flash cuando estén disponibles.
- **Reglas de Priorización Basadas en Captura:** Se añadieron instrucciones explícitas al prompt para que el modelo modere nitidez con ISO alto, trate con cuidado obturaciones lentas y priorice correcciones de temperatura/matiz cuando la captura lo sugiera.
- **Builder Reutilizable de Contexto EXIF (`imageProcessor.mjs`):** Nuevo export `getExifContext(filePath)` para generar un contexto compacto y consistente que puede reutilizarse en futuros flujos de IA.

## [1.4.3] - 2026-07-05

### Added
- **EXIF Técnico en la Mesa de Trabajo:** La tarjeta "Detalles de Imagen" muestra ahora un segundo bloque con los datos de cámara y exposición: marca/modelo del cuerpo, modelo de lente, apertura (f/N), velocidad de obturación (formateada como 1/Xs), ISO, focal (real + equivalente 35mm), flash y software. Cada fila aparece sólo si el EXIF de la foto contiene el dato.
- **Lectura Extendida de EXIF (`imageProcessor.mjs`):** Se amplía `getImageMetadata()` para extraer `Make`, `Model`, `LensModel`, `FNumber`, `ExposureTime`, `ISO`, `FocalLength`, `FocalLengthIn35mmFormat`, `Flash`, `WhiteBalance`, `Software` y `Artist`, además de los campos ya existentes.
- **Formateadores de EXIF (`public/app.js`):** Nuevas utilidades `formatExposureTime()`, `formatFNumber()`, `formatFocalLength()`, `formatFlash()` y `formatCamera()` para presentar los valores numéricos brutos como son legibles por un fotógrafo (p. ej. `f/1.8 · 1/120s · ISO 64 · 6.86mm (≈ 24mm)`).
- **Columnas EXIF en BD (`db.mjs`):** Migración idempotente que añade 11 columnas nuevas a la tabla `images` y extiende el backfill de arranque para extraerlas de las fotos ya existentes.

## [1.4.2] - 2026-07-05

### Added
- **Navegación al Workspace Simplificada:** Toda la tarjeta de vista previa de la imagen (`.card-preview`) ahora es clicable para abrir directamente la mesa de trabajo de optimización, mejorando sustancialmente la usabilidad y evitando tener que hacer clic específicamente sobre el botón flotante de edición.

## [1.4.1] - 2026-07-05

### Added
- **Indicador EXIF en la Galería:** Añadido un pequeño icono de cámara (`📷`) en cada tarjeta de imagen de la galería para identificar visualmente a golpe de vista qué fotos ya subidas contienen información EXIF y cuáles no (ya que muchas imágenes no tienen metadatos originales de GPS o fecha).

## [1.4.0] - 2026-07-05

### Added
- **Soporte de Lectura EXIF (Fecha y Ubicación):** Integración con la librería `exifr` para extraer automáticamente los metadatos de fecha/hora original de toma (`DateTimeOriginal`) y las coordenadas geográficas (latitud/longitud decimales) al subir imágenes.
- **Acceso Directo a Google Maps:** Los metadatos de ubicación se muestran en la Mesa de Trabajo en el frontend con un enlace interactivo (`.map-link`) que abre las coordenadas GPS directamente en Google Maps.
- **Pasada Inicial de Migración EXIF (Backfilling):** En el arranque del servidor, se realiza un proceso automático para recorrer las imágenes ya existentes en la base de datos que no hayan sido procesadas, extrayendo y registrando sus datos de fecha y geolocalización desde sus respectivos archivos originales en disco.

## [1.3.1] - 2026-07-05

### Fixed
- **Persistencia de Ajustes Manuales:** Se añadió la columna `applied_adjustments` a la base de datos para almacenar permanentemente los ajustes exactos de Sharp utilizados al optimizar cada foto.
- **Sincronización del Copiar/Pegar:** Al volver a abrir una imagen optimizada, los deslizadores y selectores de la Mesa de Trabajo ahora cargan los parámetros reales aplicados (en lugar de reiniciarse a los valores por defecto de la IA). Esto permite que el flujo de Copiar y Pegar ajustes funcione correctamente con fotos ya procesadas.

## [1.3.0] - 2026-07-05

### Added
- **Copiar y Pegar Ajustes de Optimización:** Nueva barra de herramientas en la sección de Ajustes Manuales de la Mesa de Trabajo que permite copiar la combinación actual de parámetros (brillo, contraste, saturación, enfoque, temperatura, matiz, rotación, eliminación de ruido y súper-resolución) y pegarla en otra imagen de forma instantánea. Los ajustes copiados se guardan localmente en `localStorage` para persistir entre sesiones o recargas de página.

## [1.2.1] - 2026-07-05

### Changed
- **Formateador de Logs de Consola:** Se configuró un flujo de salida personalizado (`customLoggerStream`) que transforma las líneas de logs JSON predeterminadas de Fastify/Pino en salidas estructuradas y legibles clásicas para el terminal (ej. `[Hora] [Nivel] mensaje`).
- **Almacenamiento de Logs:** Los logs en su formato JSON original (para análisis automatizado) se guardan en el archivo físico `server.log`.

## [1.2.0] - 2026-07-05

### Added
- **Detección de Duplicados en la Subida:** Se implementó el cálculo y guardado de hashes criptográficos (SHA-256) de las fotos subidas. Las fotos idénticas ya subidas por el usuario se rechazan durante el proceso de subida.
- **Modal de Reporte de Duplicados:** Si se detectan imágenes duplicadas al subir (individualmente o en lote), se muestra un diálogo modal glassmorphic en el frontend listando los archivos omitidos.
- **Recalculo de Hashes Retroactivo:** Proceso de migración automática en el arranque del servidor (`initDb()`) que añade la columna `hash` a la tabla `images` y calcula el hash de las imágenes existentes en disco.

## [1.1.1] - 2026-07-05

### Fixed
- **Advertencias de Font Awesome:** Se actualizó el enlace CDN de Font Awesome de v6.4.0 a v6.6.0 para corregir advertencias en la consola del navegador sobre cajas de límites incorrectas de glifos (`Glyph bbox was incorrect`).

## [1.1.0] - 2026-06-22

### Added
- **Preprocesamiento de Imágenes con Sharp (`ollama.mjs`):** Antes de enviar una imagen a Ollama, se normaliza la orientación EXIF, se redimensiona a un máximo de `1024x1024` y se comprime como JPEG calidad `80` para acelerar la inferencia y reducir el tamaño de payload.
- **Balance de Blancos (`imageProcessor.mjs`):** Nuevos ajustes de `temperature` y `tint` aplicados en espacio de color lineal (`scrgb`) mediante `.recomb()` para corregir dominantes cálidas/frías y verdes/magentas.
- **Rotación Manual y EXIF (`imageProcessor.mjs`, frontend):** Añadido parámetro `rotate` (0/90/180/270) y auto-rotación basada en metadatos EXIF antes del procesamiento.
- **Selector de Modelo de Visión (`server.mjs`, `public/app.js`):** Nueva ruta `GET /api/info/model` y desplegable en el workspace para elegir manualmente entre los modelos de visión instalados en Ollama. El modelo elegido se guarda en `localStorage`.
- **Indicador de Versión en la UI (`server.mjs`, `public/index.html`, `public/app.js`):** Nueva ruta `GET /api/info/version` y badge junto al nombre "Pigmalea" en la barra lateral, mostrando la versión de `package.json`.
- **Ajuste Dinámico del Visor de Imágenes (`public/style.css`, `public/app.js`):** El contenedor de comparación ahora adopta la relación de aspecto de la foto cargada (con un límite para fotos muy verticales) y respeta `max-height: 78vh`, evitando que las imágenes verticales se vean diminutas con grandes bandas negras.

### Changed
- **Optimización por Lote (`public/app.js`):** `startBulkOptimization()` ahora exige que cada imagen seleccionada tenga un análisis de IA previo (`ai_analysis.adjustments`). Si ninguna imagen seleccionada cumple la condición, se aborta la acción con un mensaje informativo.
- **Utilidad de Liberación de Puerto (`kill-server.mjs`):** Script multiplataforma para terminar procesos que escuchan en el puerto configurado (`PORT`).
- **Lista de Modelos Verificados (`working-models.json`):** Archivo generado automáticamente por el suite de tests con los modelos de Ollama que completan el análisis con éxito; `ollama.mjs` la utiliza para filtrar modelos confiables.

### Changed
- **Driver SQLite:** Migración de `sqlite3` a `better-sqlite3` (`db.mjs`) para mejor rendimiento, soporte nativo de sincronía y WAL mode. Los helpers `run`, `get` y `all` mantienen su API basada en promesas para compatibilidad con `server.mjs`.
- **Esquema JSON del Prompt de IA:** Ampliado de 6 a 9 parámetros (`brightness`, `contrast`, `saturation`, `sharpness`, `denoise`, `upscale`, `rotate`, `temperature`, `tint`).
- **Prompt de Ollama:** Actualizado para pedir explícitamente detección de problemas de balance de blancos y recomendación de rotación.

### Fixed
- **Documentación desactualizada (`README.md`, `AI_REFERENCE.md`):** Actualizados nombres de archivos a extensión `.mjs`, parámetros de la API, puerto por defecto y descripción del pipeline de IA.
- **Parser de Respuestas de IA (`ollama.mjs`):** Añadida función `parseAIJson()` con limpieza de fences markdown, extracción del primer objeto JSON y reparación de comas faltantes o sobrantes, para tolerar modelos que devuelven JSON casi válido como `minicpm-v4.6`.
- **Imagen Mejorada Totalmente Negra (`imageProcessor.mjs`):** Reordenado el pipeline de Sharp y eliminado el cambio explícito a `pipelineColourspace('scrgb')` durante el balance de blancos, evitando conversiones de espacio de color que producían salidas negras en algunas imágenes.

---

## [1.0.0] - 2026-06-21

### Added
- **Project Scaffold:** Initialized Node.js project structure with dependencies (`fastify`, `sharp`, `better-sqlite3`, `bcryptjs`, `@fastify/static`, etc.).
- **Database Module (`db.mjs`):** Promise-based SQLite helper module wrapping `better-sqlite3` to manage `users` and `images` tables with WAL mode enabled.
- **Ollama Integration (`ollama.mjs`):** Multi-modal image analysis client supporting the `llama3.2-vision:latest` model for structured flaw diagnostics.
- **Image Editing Engine (`imageProcessor.mjs`):** Sharp-based transformations for adjusting brightness, contrast, saturation, sharpening, noise reduction, and upscaling.
- **Server Module (`server.mjs`):** Main Fastify server configuring routes, cookie sessions, multipart upload pipelines, static servers, and API routing.
- **UI Assets (`public/`):**
  - `index.html`: Dashboard SPA structure with auth cards, upload drop zones, image grid, and a split comparison workspace.
  - `style.css`: Glassmorphic dark theme stylesheet with HSL colors, background blobs, custom input range sliders, and comparison slider.
  - `app.js`: SPA visual router, API fetch wrappers, drag & drop handlers, and interactive before/after slider event listeners.
- **Documentation:**
  - `README.md`: High-level guide on architecture, installation, and REST API routes.
  - `AI_REFERENCE.md`: In-depth documentation on the Ollama vision prompts, structured JSON output formats, and their mathematical translation into Sharp parameters.

### Changed
- **Ollama Vision Model Auto-Detection (`ollama.mjs`):** Implemented dynamic model detection mapping available local models on the user's Ollama instance. Added preference list prioritizing the ultra-stable `llava:latest` (clip/llama architecture) over `llama3.2-vision:latest` (mllama architecture) to bypass the `mllama` runner crash in current Ollama builds (e.g. v0.30.10).
- **Port Conflict Resolution:** Switched backend listening port from `3000` to `3001` in the default `.env` to resolve `EADDRINUSE` conflicts.
- **Transition to ESM (`.mjs`):** Renamed all backend scripts to use explicit `.mjs` extensions (`db.mjs`, `ollama.mjs`, `imageProcessor.mjs`, `server.mjs`) and updated file import references to strictly adhere to the requested ES Modules system.
