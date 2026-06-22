# AI Reference - Integración de Modelos de Lenguaje Visual (Ollama)

Este documento detalla el diseño de las interacciones de Inteligencia Artificial dentro de la aplicación **Pigmalea**, explicando cómo el backend consume modelos multimodales a través de **Ollama** y traduce sus respuestas de alto nivel en operaciones exactas de procesamiento de imágenes con **Sharp**.

---

## Modelo Utilizado

*   **Modelo por defecto / preferido:** auto-detectado entre los modelos de visión instalados localmente en Ollama, priorizando `llava:latest` por estabilidad, seguido de `llama3.2-vision:latest`.
*   **Tipo de Modelo:** Vision-Language Model (VLM)
*   **Rol en Pigmalea:** Recibe imágenes codificadas en Base64 junto a instrucciones de evaluación de calidad, emitiendo un diagnóstico visual estructurado en JSON.
*   **Selección manual:** El frontend permite elegir otro modelo de visión disponible vía `GET /api/info/model` y lo envía en el cuerpo de `POST /api/images/:id/analyze` como `{ "model": "nombre:tag" }`.

---

## Pipeline de Análisis e Inteligencia Visual

El flujo de procesamiento de IA se inicia cuando el cliente llama a la ruta `POST /api/images/:id/analyze`. El backend sigue los siguientes pasos:

1.  **Preprocesamiento con Sharp:** Antes de enviar la imagen a Ollama, se aplica auto-rotación según EXIF, se redimensiona a un máximo de `1024x1024` píxeles (`fit: 'inside'`) y se comprime como JPEG con calidad `80`. Esto reduce tamaño, normaliza la orientación y acelera la inferencia.
2.  **Codificación:** El buffer preprocesado se convierte a Base64.
3.  **Auto-detección de Modelo:** Si el cliente no especifica un modelo, `ollama.mjs` consulta `/api/tags`, filtra modelos de visión y, si existe `working-models.json`, usa solo los modelos verificados.
4.  **Preparación de Parámetros:** Se define una llamada HTTP hacia la API REST de Ollama (`/api/chat`) con:
    *   `model`: modelo activo (auto-detectado o seleccionado por el usuario).
    *   `format`: `"json"` (fuerza al modelo a validar y asegurar una salida con formato JSON sintácticamente correcto).
    *   `temperature`: `0.1` (asegura mayor consistencia y reproducibilidad en los diagnósticos y valores numéricos).
5.  **Lanzamiento del Prompt:** Se envía el prompt diseñado para evaluar y proponer correcciones.

---

## Prompt de Análisis y Estructura JSON

El prompt instruido al modelo es el siguiente:

```text
Analyze this image (which might be low resolution, blurry, or poor quality) and suggest numerical adjustment values to enhance it.
    
You must return a JSON object. The response must follow this EXACT schema:
{
  "description": "A concise description of the scene and main objects depicted.",
  "flaws": [
    "List of visual quality issues found (e.g., 'low contrast', 'blurry', 'noise', 'chromatic aberration', 'incorrect white balance')"
  ],
  "adjustments": {
    "brightness": 0.0,  // Suggested brightness modifier. Range: -0.5 to 0.5 (0.0 is no change)
    "contrast": 1.0,    // Suggested contrast multiplier. Range: 0.5 to 2.0 (1.0 is no change)
    "saturation": 1.0,  // Suggested saturation multiplier. Range: 0.0 to 2.0 (1.0 is no change)
    "sharpness": 0.0,   // Suggested sharpening amount. Range: 0.0 to 5.0 (0.0 is no change)
    "denoise": false,   // Whether a denoise/blur operation is recommended
    "upscale": true,    // Whether upscaling is recommended
    "rotate": 0,        // Suggested rotation angle clockwise in degrees if the image is sideways or upside down. Allowed values: 0, 90, 180, 270 (0 is no change)
    "temperature": 1.0,   // Suggested color temperature multiplier to correct white balance. Range: 0.5 to 1.5. (1.0 is no change, < 1.0 is cooler/blue, > 1.0 is warmer/orange)
    "tint": 1.0         // Suggested color tint multiplier to correct green/magenta casts. Range: 0.5 to 1.5. (1.0 is no change, < 1.0 is magenta/purple cast correction, > 1.0 is green cast correction)
  },
  "explanation": "A very brief explanation of why you recommended these specific parameters."
}

Do not include any text outside the JSON object. Do not include markdown code block syntax (like ```json).
```

### Respuesta del Modelo (Ejemplo)

```json
{
  "description": "Una foto en exteriores de un gato sentado en un jardín, con luz solar directa ligeramente cálida.",
  "flaws": [
    "contraste ligeramente elevado",
    "falta de nitidez en los bordes",
    "ligero ruido digital en las sombras",
    "dominante cálida leve"
  ],
  "adjustments": {
    "brightness": 0.05,
    "contrast": 0.95,
    "saturation": 1.0,
    "sharpness": 1.8,
    "denoise": true,
    "upscale": true,
    "rotate": 0,
    "temperature": 0.95,
    "tint": 1.0
  },
  "explanation": "Se ha incrementado ligeramente la nitidez por el desenfoque en bordes, reducido el contraste para recuperar detalle en sombras, activado la reducción de ruido y enfriado ligeramente la temperatura de color."
}
```

---

## Traducción de Recomendaciones a Parámetros de Sharp

Una vez obtenidas las directrices de la IA (o personalizadas por el usuario), el motor de procesamiento `imageProcessor.mjs` mapea estas propiedades numéricas a operaciones de manipulación de píxeles.

### 1. Brillo (Brightness)
*   **Parámetro IA:** `adjustments.brightness` (rango: `-0.5` a `0.5`)
*   **Mapeo Sharp:** Se utiliza el método `.modulate()` ajustando el factor multiplicativo a `1.0 + brightness * 0.4` para evitar recortes de luces altas.
*   **Código:**
    ```javascript
    pipeline = pipeline.modulate({ brightness: 1.0 + brightness * 0.4 });
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
*   **Mapeo Sharp:** Si está activo y el ancho de la imagen original es inferior a `1600px`, se duplica el ancho de la imagen manteniendo su proporción nativa y aplicando el algoritmo de interpolación **Lanczos** (ideal para conservar el detalle sin emborronar). El ancho se corrige según la orientación EXIF.
*   **Código:**
    ```javascript
    pipeline = pipeline.resize({
      width: currentWidth * 2,
      kernel: sharp.kernel.lanczos
    });
    ```

### 7. Rotación (Rotate)
*   **Parámetro IA:** `adjustments.rotate` (valores permitidos: `0`, `90`, `180`, `270`)
*   **Mapeo Sharp:** Antes de cualquier otro ajuste se aplica `.rotate()` para respetar la orientación EXIF. Si el usuario/IA solicita una rotación adicional, se aplica un segundo `.rotate(ángulo)`.
*   **Código:**
    ```javascript
    pipeline = pipeline.rotate();          // Auto-rotación EXIF
    if (rotate && rotate !== 0) {
      pipeline = pipeline.rotate(parseInt(rotate));
    }
    ```

### 8. Temperatura de Color (Temperature)
*   **Parámetro IA:** `adjustments.temperature` (rango: `0.5` a `1.5`, `1.0` neutro)
*   **Mapeo Sharp:** Se realiza un balance de blancos sencillo en espacio de color lineal `scrgb` con `.recomb()`. Valores `< 1.0` enfrían la imagen (más azul), valores `> 1.0` la calientan (más naranja/rojo).
*   **Código:**
    ```javascript
    const rScale = temperature;
    const bScale = temperature !== 0 ? (2.0 - temperature) : 1.0;
    pipeline = pipeline
      .pipelineColourspace('scrgb')
      .recomb([
        [rScale, 0, 0],
        [0, 1.0, 0],
        [0, 0, bScale]
      ])
      .toColourspace('srgb');
    ```

### 9. Matiz de Color (Tint)
*   **Parámetro IA:** `adjustments.tint` (rango: `0.5` a `1.5`, `1.0` neutro)
*   **Mapeo Sharp:** Se aplica junto con la temperatura en la misma matriz `.recomb()` para corregir dominantes verdes/magentas ajustando el canal verde.
*   **Código:**
    ```javascript
    const gScale = tint;
    // Incluido en la matriz de recomb descrita en la sección de Temperatura
    ```

---

## Flujo de Mejora (Enhance)

La ruta `POST /api/images/:id/enhance` aplica los ajustes siguiendo esta prioridad:

1. Valores enviados explícitamente por el usuario en el cuerpo de la petición.
2. Valores recomendados por la IA y almacenados en `ai_analysis`.
3. Valores neutros por defecto.

Esto permite tanto aplicar las recomendaciones automáticas como personalizar cualquier parámetro manualmente desde la interfaz.
