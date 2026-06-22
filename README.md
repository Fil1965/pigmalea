# Pigmalea - AI-Assisted Image Enhancer

Pigmalea es una aplicación web moderna diseñada para la carga, visualización y optimización de imágenes de baja calidad o resolución mediante técnicas asistidas por Inteligencia Artificial.

La aplicación utiliza un backend potente construido sobre **Fastify** que coordina la persistencia en **SQLite**, el procesamiento rápido de imágenes a través de **Sharp** y el análisis inteligente de imágenes consultando de forma local al modelo multimodal **llama3.2-vision** gestionado por **Ollama**.

---

## Características Principales

*   **Autenticación de Usuarios:** Sistema de registro e inicio de sesión seguro para gestionar galerías de imágenes privadas de forma independiente.
*   **Zona de Carga Interactiva:** Soporte de arrastrar y soltar (drag & drop) para subir imágenes de forma rápida e intuitiva.
*   **Análisis Multimodal con IA:** Detección de fallos visuales (desenfoque, ruido, bajo contraste) y recomendación de parámetros de mejora mediante Ollama (`llama3.2-vision:latest`).
*   **Ajustes Asistidos y Manuales:** Posibilidad de aplicar las recomendaciones de la IA o realizar ajustes manuales personalizados en tiempo real.
*   **Comparación de Imagenes Split-Screen:** Deslizador (slider) interactivo antes/después para evaluar los resultados visuales de la optimización en paralelo.
*   **Persistencia Robusta:** Historial de cargas e imágenes mejoradas almacenado en SQLite.

---

## Estructura del Proyecto

```text
Pigmalea/
├── db.js                # Inicialización y queries de SQLite (ESM)
├── ollama.js            # Cliente de conexión e integración con Ollama
├── imageProcessor.js    # Utilidades de transformación y escalado con Sharp
├── server.js            # Servidor Fastify principal y enrutado de APIs
├── package.json         # Dependencias y scripts de ejecución
├── pigmalea.db          # Base de datos SQLite (generada al iniciar)
├── uploads/             # Almacenamiento local de archivos (generado al iniciar)
│   ├── originals/       # Imágenes subidas por los usuarios
│   └── enhanced/        # Versiones mejoradas de las imágenes
└── public/              # Archivos estáticos del Frontend
    ├── index.html       # Interfaz de usuario (SPA)
    ├── style.css        # Diseño premium (Glassmorphism dark theme)
    └── app.js           # Lógica cliente, peticiones API e interactividad
```

---

## Requisitos Previos

1.  **Node.js** v18 o superior (Probado en v25.8.1).
2.  **Ollama** instalado y ejecutándose localmente.
3.  **Modelo Llama 3.2 Vision** descargado en Ollama:
    ```bash
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
    PORT=3000
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
5.  Acceder en el navegador a `http://localhost:3000`.

---

## Referencia de la API REST

### Autenticación
*   `POST /api/register` - Registra un nuevo usuario. Body: `{ "username": "...", "password": "..." }`.
*   `POST /api/login` - Inicia sesión. Body: `{ "username": "...", "password": "..." }`.
*   `POST /api/logout` - Cierra la sesión activa.
*   `GET /api/me` - Devuelve la información del usuario de la sesión actual.

### Gestión de Imágenes (Requieren autenticación)
*   `GET /api/images` - Obtiene todas las imágenes subidas por el usuario logueado.
*   `POST /api/upload` - Sube una imagen original en un payload multipart form-data.
*   `POST /api/images/:id/analyze` - Envía la imagen original a Ollama para que la analice y devuelva recomendaciones de mejora estructuradas.
*   `POST /api/images/:id/enhance` - Aplica mejoras de Sharp sobre la imagen original. Si se omite el cuerpo de la petición, se aplican los parámetros recomendados por la IA. Body opcional:
    ```json
    {
      "brightness": 0.15,
      "contrast": 1.2,
      "saturation": 1.1,
      "sharpness": 1.5,
      "denoise": true,
      "upscale": true
    }
    ```
*   `DELETE /api/images/:id` - Elimina el registro de la base de datos y los archivos físicos asociados (original y mejorada).
