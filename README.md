# Pigmalea - AI-Assisted Image Enhancer

Pigmalea es una aplicación web moderna diseñada para la carga, visualización y optimización de imágenes de baja calidad o resolución mediante técnicas asistidas por Inteligencia Artificial.

La aplicación utiliza un backend potente construido sobre **Fastify** que coordina la persistencia en **SQLite**, el procesamiento rápido de imágenes a través de **Sharp** y el análisis inteligente de imágenes consultando de forma local a modelos de visión gestionados por **Ollama**.

---

## Características Principales

*   **Autenticación de Usuarios:** Sistema de registro e inicio de sesión seguro para gestionar galerías de imágenes privadas de forma independiente.
*   **Zona de Carga Interactiva:** Soporte de arrastrar y soltar (drag & drop) para subir una o varias imágenes de forma rápida e intuitiva.
*   **Análisis Multimodal con IA:** Detección de fallos visuales (desenfoque, ruido, bajo contraste, balance de blancos incorrecto) y recomendación de parámetros de mejora mediante Ollama.
*   **Selección de Modelo de Visión:** El backend auto-detecta los modelos de visión instalados y permite elegir manualmente entre ellos.
*   **Ajustes Asistidos y Manuales:** Posibilidad de aplicar las recomendaciones de la IA o realizar ajustes manuales personalizados en tiempo real.
*   **Comparación de Imagenes Split-Screen:** Deslizador (slider) interactivo antes/después para evaluar los resultados visuales de la optimización en paralelo.
*   **Persistencia Robusta:** Historial de cargas e imágenes mejoradas almacenado en SQLite.

---

## Estructura del Proyecto

```text
Pigmalea/
├── db.mjs                    # Inicialización y queries de SQLite (ESM, better-sqlite3)
├── ollama.mjs                # Cliente de conexión, auto-detección e integración con Ollama
├── imageProcessor.mjs        # Utilidades de transformación, balance de blancos y escalado con Sharp
├── server.mjs                # Servidor Fastify principal y enrutado de APIs
├── kill-server.mjs           # Utilidad para liberar el puerto en Windows / Unix
├── package.json              # Dependencias y scripts de ejecución
├── pigmalea.db               # Base de datos SQLite (generada al iniciar)
├── working-models.json       # Modelos de visión verificados por el suite de tests
├── uploads/                  # Almacenamiento local de archivos (generado al iniciar)
│   ├── originals/            # Imágenes subidas por los usuarios
│   └── enhanced/             # Versiones mejoradas de las imágenes
├── public/                   # Archivos estáticos del Frontend
│   ├── index.html            # Interfaz de usuario (SPA)
│   ├── style.css             # Diseño premium (Glassmorphism dark theme)
│   └── app.js                # Lógica cliente, peticiones API e interactividad
└── tests/
    ├── ollama-models.test.mjs # Suite de tests para evaluar modelos de visión disponibles
    ├── generate-summary.mjs   # Generador de resumen markdown a partir de resultados de tests
    └── test.jpg               # Imagen de prueba para los tests
```

---

## Requisitos Previos

1.  **Node.js** v18 o superior (Probado en v25.8.1).
2.  **Ollama** instalado y ejecutándose localmente.
3.  Al menos un modelo de visión descargado en Ollama, por ejemplo:
    ```bash
    ollama pull llava:latest
    # o alternativamente
    ollama pull llama3.2-vision:latest
    ```

---

## Instalación y Configuración

1.  Clonar o mover los archivos al directorio del proyecto.
2.  Instalar las dependencias de Node.js:
    ```bash
    npm install
    ```
3.  *(Opcional)* Configurar un archivo `.env` en la raíz del proyecto para anular variables por defecto:
    ```ini
    PORT=3001
    OLLAMA_HOST=http://localhost:11434
    SESSION_SECRET=un_secreto_muy_seguro_y_largo_para_firmar_sesiones
    ```
4.  Iniciar el servidor en modo desarrollo:
    ```bash
    npm run dev
    ```
    O en producción:
    ```bash
    npm start
    ```
    En caso de que el puerto esté ocupado, se puede ejecutar primero:
    ```bash
    npm run kill
    ```
5.  Acceder en el navegador a `http://localhost:3001` (o el `PORT` configurado).

---

## Referencia de la API REST

### Autenticación
*   `POST /api/register` - Registra un nuevo usuario. Body: `{ "username": "...", "password": "..." }`.
*   `POST /api/login` - Inicia sesión. Body: `{ "username": "...", "password": "..." }`.
*   `POST /api/logout` - Cierra la sesión activa.
*   `GET /api/me` - Devuelve la información del usuario de la sesión actual.

### Información del Sistema
*   `GET /api/info/model` - Devuelve el modelo de visión activo y la lista de modelos de visión instalados en Ollama.
*   `GET /api/info/version` - Devuelve la versión de la aplicación definida en `package.json`.

### Gestión de Imágenes (Requieren autenticación)
*   `GET /api/images` - Obtiene todas las imágenes subidas por el usuario logueado.
*   `POST /api/upload` - Sube una o varias imágenes originales en un payload multipart form-data. Campo esperado: `image`.
*   `POST /api/images/:id/analyze` - Envía la imagen original a Ollama para que la analice y devuelva recomendaciones de mejora estructuradas. Body opcional: `{ "model": "nombre:tag" }`.
*   `POST /api/images/:id/enhance` - Aplica mejoras de Sharp sobre la imagen original. Si se omite el cuerpo de la petición, se aplican los parámetros recomendados por la IA. Body opcional:
    ```json
    {
      "brightness": 0.15,
      "contrast": 1.2,
      "saturation": 1.1,
      "sharpness": 1.5,
      "denoise": true,
      "upscale": true,
      "rotate": 90,
      "temperature": 0.95,
      "tint": 1.05
    }
    ```
*   `DELETE /api/images/:id` - Elimina el registro de la base de datos y los archivos físicos asociados (original y mejorada).

---

## Tests de Modelos de Visión

El proyecto incluye un suite de tests que evalúa cada modelo de visión disponible en Ollama usando una imagen de prueba y genera un informe comparativo.

```bash
npm test
```

Para probar un modelo específico:

```bash
node --test tests/ollama-models.test.mjs llava:latest
```

Los resultados se guardan en `tests/results/` y el resumen en `tests/results/summary.md`. El archivo `working-models.json` se actualiza automáticamente con los modelos que completaron el análisis con éxito.
