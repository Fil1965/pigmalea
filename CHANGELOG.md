# Changelog - Pigmalea

All notable changes to the Pigmalea project will be documented in this file.

---

## [Unreleased] - 2026-06-22

### Added
- **Preprocesamiento de Imágenes con Sharp (`ollama.mjs`):** Antes de enviar una imagen a Ollama, se normaliza la orientación EXIF, se redimensiona a un máximo de `1024x1024` y se comprime como JPEG calidad `80` para acelerar la inferencia y reducir el tamaño de payload.
- **Balance de Blancos (`imageProcessor.mjs`):** Nuevos ajustes de `temperature` y `tint` aplicados en espacio de color lineal (`scrgb`) mediante `.recomb()` para corregir dominantes cálidas/frías y verdes/magentas.
- **Rotación Manual y EXIF (`imageProcessor.mjs`, frontend):** Añadido parámetro `rotate` (0/90/180/270) y auto-rotación basada en metadatos EXIF antes del procesamiento.
- **Selector de Modelo de Visión (`server.mjs`, `public/app.js`):** Nueva ruta `GET /api/info/model` y desplegable en el workspace para elegir manualmente entre los modelos de visión instalados en Ollama. El modelo elegido se guarda en `localStorage`.
- **Utilidad de Liberación de Puerto (`kill-server.mjs`):** Script multiplataforma para terminar procesos que escuchan en el puerto configurado (`PORT`).
- **Lista de Modelos Verificados (`working-models.json`):** Archivo generado automáticamente por el suite de tests con los modelos de Ollama que completan el análisis con éxito; `ollama.mjs` la utiliza para filtrar modelos confiables.

### Changed
- **Driver SQLite:** Migración de `sqlite3` a `better-sqlite3` (`db.mjs`) para mejor rendimiento, soporte nativo de sincronía y WAL mode. Los helpers `run`, `get` y `all` mantienen su API basada en promesas para compatibilidad con `server.mjs`.
- **Esquema JSON del Prompt de IA:** Ampliado de 6 a 9 parámetros (`brightness`, `contrast`, `saturation`, `sharpness`, `denoise`, `upscale`, `rotate`, `temperature`, `tint`).
- **Prompt de Ollama:** Actualizado para pedir explícitamente detección de problemas de balance de blancos y recomendación de rotación.

### Fixed
- **Documentación desactualizada (`README.md`, `AI_REFERENCE.md`):** Actualizados nombres de archivos a extensión `.mjs`, parámetros de la API, puerto por defecto y descripción del pipeline de IA.

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
