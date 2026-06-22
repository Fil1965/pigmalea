# Pruebas de Modelos de Ollama (Suite de Test)

Esta carpeta contiene la suite de pruebas automatizadas para evaluar las capacidades de visión y análisis de imágenes de los modelos instalados en tu instancia local de Ollama.

## Características de la Suite de Pruebas

1. **Persistencia de Resultados Históricos**: Los resultados de pruebas anteriores no se eliminan de la carpeta `tests/results/`, incluso si desinstalas el modelo de Ollama. Se mantienen y siguen incluyéndose en el reporte consolidado (`summary.md`).
2. **Sustitución en Pruebas Repetidas**: Si ejecutas la prueba de un modelo que ya había sido probado en el pasado, el archivo de resultados antiguo (`.json` e imagen mejorada `.jpg`) se sobrescribirá con los nuevos datos.
3. **Liberación Instantánea de VRAM (GPU)**: Durante los tests, Ollama recibe una instrucción especial (`keep_alive: 0`) para descargar el modelo de la GPU tan pronto como termine el análisis, evitando saturar la memoria de video cuando se prueban múltiples modelos sucesivamente.

---

## Cómo Ejecutar las Pruebas

### 1. Ejecutar todos los modelos instalados
Para buscar y evaluar secuencialmente todos los modelos que tengas instalados actualmente en Ollama:

```bash
# Usando npm (definido en package.json)
npm run test

# O directamente con node
node tests/ollama-models.test.mjs
```

### 2. Ejecutar un modelo específico
Si quieres repetir o realizar la prueba únicamente para un modelo en concreto sin evaluar el resto de modelos de la lista, puedes pasar su nombre como parámetro de dos formas:

#### Opción A: Mediante argumentos en la línea de comandos (Recomendado)
Ejecuta el archivo directamente con `node` pasando el nombre del modelo:

```powershell
# Argumento posicional simple
node tests/ollama-models.test.mjs llava:latest

# O usando la bandera --model o -m
node tests/ollama-models.test.mjs --model qwen3-vl:2b
```

#### Opción B: Mediante el script de PowerShell (Windows)
Hemos creado un script conveniente en `tests/run-test.ps1` para automatizar la asignación de la variable de entorno, ejecución y limpieza en Windows:

```powershell
# Probar un modelo específico (ej. minicpm-v4.6:latest)
.\tests\run-test.ps1 minicpm-v4.6:latest

# O probar todos los modelos (sin pasar parámetros)
.\tests\run-test.ps1
```

#### Opción C: Mediante variable de entorno manual
Si quieres usar la variable de entorno manualmente antes de ejecutar el test:

* **En PowerShell (Windows):**
  ```powershell
  $env:MODEL="llava:latest"; npm run test; Remove-Item Env:\MODEL
  ```
* **En Bash (Linux/macOS):**
  ```bash
  MODEL=llava:latest npm run test
  ```

---

## Resultados Generados

Los resultados de las ejecuciones se guardan en la subcarpeta `tests/results/`:
* **Archivos JSON (`<modelo_sanitizado>.json`)**: Contienen los detalles de ejecución, tiempo tardado, parámetros recomendados de brillo, contraste, etc., y el estado de la prueba.
* **Imágenes mejoradas (`<modelo_sanitizado>_enhanced.jpg`)**: La imagen de prueba procesada con los parámetros devueltos por cada modelo.
* **summary.md**: Reporte comparativo en formato Markdown con estadísticas y visualización de cada mejora.
* **working-models.json** (en la raíz del proyecto): Listado en formato JSON que reúne todos los modelos que han superado con éxito la prueba de visión.
