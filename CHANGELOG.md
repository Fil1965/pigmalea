# Changelog - Pigmalea

All notable changes to the Pigmalea project will be documented in this file.

---

## [1.0.0] - 2026-06-21

### Added
- **Project Scaffold:** Initialized Node.js project structure with dependencies (`fastify`, `sharp`, `sqlite3`, `bcryptjs`, `@fastify/static`, etc.).
- **Database Module (`db.mjs`):** Promise-based SQLite helper module to manage `users` and `images` tables.
- **Ollama Integration (`ollama.mjs`):** Multi-modal image analysis client leveraging the `llama3.2-vision:latest` model for structured flaw diagnostics.
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
