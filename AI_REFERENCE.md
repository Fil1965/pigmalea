# AI Reference - Integración de Modelos de Lenguaje Visual (Ollama)

Este documento detalla el diseño de las interacciones de Inteligencia Artificial dentro de la aplicación **Pigmalea**, explicando cómo el backend consume modelos multimodales a través de **Ollama** y traduce sus respuestas de alto nivel en operaciones exactas de procesamiento de imágenes con **Sharp**.

---

## Modelo Utilizado

*   **Identificador:** `llama3.2-vision:latest` (Ollama)
*   **Tipo de Modelo:** Vision-Language Model (VLM)
*   **Tamaño:** ~7.8 GB (Versión de 11 billones de parámetros)
*   **Rol en Pigmalea:** Recibe imágenes codificadas en Base64 junto a instrucciones de evaluación de calidad, emitiendo un diagnóstico visual estructurado en JSON.

---

## Pipeline de Análisis e Inteligencia Visual

El flujo de procesamiento de IA se inicia cuando el cliente llama a la ruta `POST /api/images/:id/analyze`. El backend sigue los siguientes pasos:

1.  **Lectura y Codificación:** Se abre la imagen desde el sistema de archivos (`uploads/originals/`) y se codifica en Base64.
2.  **Preparación de Parámetros:** Se define una llamada HTTP hacia la API REST de Ollama (`/api/chat`) con:
    *   `model`: `"llama3.2-vision:latest"`
    *   `format`: `"json"` (fuerza al modelo a validar y asegurar una salida con formato JSON sintácticamente correcto).
    *   `temperature`: `0.1` (asegura mayor consistencia y reproducibilidad en los diagnósticos y valores numéricos).
3.  **Lanzamiento del Prompt:** Se envía un prompt diseñado para evaluar y proponer correcciones.

---

## Prompt de Análisis y Estructura JSON

El prompt instruido al modelo es el siguiente:

```text
Analyze this image (which might be low resolution, blurry, or poor quality) and suggest numerical adjustment values to enhance it.
    
You must return a JSON object. The response must follow this EXACT schema:
{
  "description": "A concise description of the scene and main objects depicted.",
  "flaws": [
    "List of visual quality issues found (e.g., 'low contrast', 'blurry', 'noise', 'chromatic aberration')"
  ],
  "adjustments": {
    "brightness": 0.0,  // Suggested brightness modifier. Range: -0.5 to 0.5 (0.0 is no change)
    "contrast": 1.0,    // Suggested contrast multiplier. Range: 0.5 to 2.0 (1.0 is no change)
    "saturation": 1.0,  // Suggested saturation multiplier. Range: 0.0 to 2.0 (1.0 is no change)
    "sharpness": 0.0,   // Suggested sharpening amount. Range: 0.0 to 5.0 (0.0 is no change)
    "denoise": false,   // Whether a denoise/blur operation is recommended
    "upscale": true     // Whether upscaling is recommended
  },
  "explanation": "A very brief explanation of why you recommended these specific parameters."
}

Do not include any text outside the JSON object. Do not include markdown code block syntax (like ```json).
```

### Respuesta del Modelo (Ejemplo)

```json
{
  "description": "Una foto en exteriores de un gato sentado en un jardín, con luz solar directa.",
  "flaws": [
    "contraste ligeramente elevado",
    "falta de nitidez en los bordes",
    "ligero ruido digital en las sombras"
  ],
  "adjustments": {
    "brightness": 0.05,
    "contrast": 0.95,
    "saturation": 1.0,
    "sharpness": 1.8,
    "denoise": true,
    "upscale": true
  },
  "explanation": "Se ha incrementado ligeramente la nitidez por el desenfoque en bordes, reducido el contraste para recuperar detalle en sombras y activado la reducción de ruido."
}
```

---

## Traducción de Recomendaciones a Parámetros de Sharp

Una vez obtenidas las directrices de la IA (o personalizadas por el usuario), el motor de procesamiento `imageProcessor.js` mapea estas propiedades numéricas a operaciones de manipulación de píxeles:

### 1. Brillo (Brightness)
*   **Parámetro IA:** `adjustments.brightness` (rango: `-0.5` a `0.5`)
*   **Mapeo Sharp:** Se utiliza el método `.modulate()` ajustando el factor multiplicativo a `1.0 + brightness`.
*   **Código:**
    ```javascript
    pipeline = pipeline.modulate({ brightness: 1.0 + brightness });
    ```

### 2. Saturación (Saturation)
*   **Parámetro IA:** `adjustments.saturation` (rango: `0.0` a `2.0`, donde `1.0` es neutro)
*   **Mapeo Sharp:** Método `.modulate()` aplicando directamente el factor como multiplicador de saturación.
*   **Código:**
    ```javascript
    pipeline = pipeline.modulate({ saturation: saturation });
    ```

### 3. Contraste (Contrast)
*   **Parámetro IA:** `adjustments.contrast` (rango: `0.5` a `2.0`, donde `1.0` es neutro)
*   **Mapeo Sharp:** Se implementa una transformación lineal alrededor de gris medio (128) con el método `.linear(a, b)` para estirar o comprimir los valores cromáticos.
    *   Fórmula: $f(x) = a \cdot x + b$ donde $a = \text{contrast}$ y $b = 128 \cdot (1.0 - \text{contrast})$.
*   **Código:**
    ```javascript
    pipeline = pipeline.linear(contrast, 128 * (1.0 - contrast));
    ```

### 4. Nitidez (Sharpness)
*   **Parámetro IA:** `adjustments.sharpness` (rango: `0.0` a `5.0`)
*   **Mapeo Sharp:** Se aplica un filtro de nitidez convolucional (`.sharpen()`). El nivel se mapea al radio `sigma` de la máscara de desenfoque.
*   **Código:**
    ```javascript
    const sigma = 0.5 + (sharpness * 0.5);
    pipeline = pipeline.sharpen({ sigma: sigma });
    ```

### 5. Reducción de Ruido (Denoise)
*   **Parámetro IA:** `adjustments.denoise` (booleano)
*   **Mapeo Sharp:** Si es verdadero, se aplica un filtro de mediana con un radio de `3px` para filtrar el ruido conservando la definición geométrica general.
*   **Código:**
    ```javascript
    pipeline = pipeline.median(3);
    ```

### 6. Superresolución / Redimensionamiento (Upscale)
*   **Parámetro IA:** `adjustments.upscale` (booleano)
*   **Mapeo Sharp:** Si está activo y el ancho de la imagen original es inferior a `1600px`, se duplica el ancho de la imagen manteniendo su proporción nativa y aplicando el algoritmo de interpolación **Lanczos** (ideal para conservar el detalle sin emborronar).
*   **Código:**
    ```javascript
    pipeline = pipeline.resize({
      width: originalWidth * 2,
      kernel: sharp.kernel.lanczos
    });
    ```
