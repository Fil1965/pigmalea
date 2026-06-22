# Ollama Models Test Results & Comparisons

This report lists the results of running image analysis on each Ollama model available in the system using the test image `tests/test.jpg`.

*Report generated on: 22/6/2026, 20:04:16*

## Execution Statistics
- **Total Models Evaluated**: 14
- **Successful Vision Analyses**: 8
- **Failed/Unsupported Models**: 6
- **Total Suite Execution Time**: 351.03s

## Model Performance Overview

| Model | Status | Execution Time (s) | Description Summary / Error |
| :--- | :--- | :--- | :--- |
| **kimi-k2.7-code:cloud** | ✅ Success | 5.03s | A terracotta multi-pot planter with succulents sits on a brown tiled floor against a white wall with a brown baseboard. |
| **llava:latest** | ✅ Success | 27.61s | The image shows a potted plant with various plants and succulents, placed on a tiled floor indoors. The lighting appears to be artificial, casting soft shadows on the surface beneath the pot. |
| **minicpm-v4.6:latest** | ✅ Success | 21.28s | The image shows small terracotta pots with succulent plants placed on a tray, situated on tiled flooring against a white wall; the scene appears somewhat blurry and low in contrast. |
| **minimax-m3:cloud** | ✅ Success | 8.89s | A terracotta multi-pocket planter with various succulents (including a rosette-shaped succulent and a Kalanchoe) sitting on a brown tiled floor against a light-colored wall with a brown baseboard. A timestamp '2026/01/30 13:11:51' is visible in the bottom-left corner, suggesting it was captured by a security or surveillance camera. |
| **qwen3-vl:2b** | ✅ Success | 31.48s | A scene with several succulent plants in terracotta pots arranged on a tiled floor against a white wall. |
| **qwen3-vl:4b** | ✅ Success | 72.21s | A terracotta pot arrangement with three succulent plants placed on a tiled floor against a white wall. |
| **qwen3-vl:8b** | ✅ Success | 109.40s | A scene with multiple potted succulents placed on a tiled surface against a wall. |
| **qwen3.5:cloud** | ✅ Success | 50.72s | A cluster of three small terracotta pots containing various succulents, arranged in a matching saucer on a tiled floor against a white wall with a brown skirting board. |
| **deepseek-ocr:latest** | ❌ Failed/Unsupported | 22.75s | `AI output was not in the expected JSON format.` |
| **deepseek-v4-pro:cloud** | ❌ Failed/Unsupported | 0.35s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c8547643-4ef4-4ffa-b13f-eb00d172e518)"}` |
| **glm-5.1:cloud** | ❌ Failed/Unsupported | 0.37s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 9e95b9f6-4029-42e2-9962-91ef4f11d1ce)"}` |
| **glm-5.2:cloud** | ❌ Failed/Unsupported | 0.21s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 60c69ff4-8574-4b0a-9541-48664ca2fbaf)"}` |
| **qwen3-coder:480b-cloud** | ❌ Failed/Unsupported | 0.38s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: bda69f89-e66c-4dc3-a0fe-513ab4f7eb78)"}` |
| **qwen3-vl:235b-cloud** | ❌ Failed/Unsupported | 0.36s | `Ollama API responded with status 410: {"error":"qwen3-vl:235b was retired at 2026-06-16 00:00:00 -0700 PDT (ref: d64f40aa-56ea-44e6-8eab-530b2abae5d3)"}` |

## Detailed Model Enhancements

### Model: `kimi-k2.7-code:cloud`

- **Status**: ✅ Success
- **Time Taken**: 5.03 seconds
- **Explanation**: *Slight brightness and contrast boost, plus added saturation and sharpening, will make the flat, low-res image look clearer and more vibrant; upscaling helps the small dimensions.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.05,
  "contrast": 1.2,
  "saturation": 1.2,
  "sharpness": 1.5,
  "denoise": false,
  "upscale": true,
  "rotate": 0,
  "temperature": 1.05,
  "tint": 1
}
  ```

#### Analysis Details
> A terracotta multi-pot planter with succulents sits on a brown tiled floor against a white wall with a brown baseboard.

#### Visual Enhancement Output
![Enhanced Image for kimi-k2.7-code-cloud](./kimi_k2_7_code_cloud_enhanced.jpg)

---

### Model: `llava:latest`

- **Status**: ✅ Success
- **Time Taken**: 27.61 seconds
- **Explanation**: *To enhance the image, a moderate increase in brightness and contrast would help to bring out more detail in the plants. Sharpening could be applied to improve the overall clarity of the image. Denoising would help to reduce the pixelation and noise present in the image. Upscaling is not recommended as it may introduce additional artifacts. Rotating the image is not necessary, as it appears to be oriented correctly. The color temperature and tint appear to be well-balanced, so no adjustments are needed for these parameters.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.5,
  "contrast": 1.5,
  "saturation": 1,
  "sharpness": 2,
  "denoise": true,
  "upscale": false,
  "rotate": 0,
  "temperature": 1,
  "tint": 1
}
  ```

#### Analysis Details
> The image shows a potted plant with various plants and succulents, placed on a tiled floor indoors. The lighting appears to be artificial, casting soft shadows on the surface beneath the pot.

#### Visual Enhancement Output
![Enhanced Image for llava-latest](./llava_latest_enhanced.jpg)

---

### Model: `minicpm-v4.6:latest`

- **Status**: ✅ Success
- **Time Taken**: 21.28 seconds
- **Explanation**: *These adjustments enhance the image's brightness and contrast to improve visibility, increase saturation for plant colors, sharpen details to reduce blur, and apply upscaling to address low resolution.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.2,
  "contrast": 1.5,
  "saturation": 1.2,
  "sharpness": 4,
  "denoise": false,
  "upscale": true,
  "rotate": 0,
  "temperature": 1,
  "tint": 1
}
  ```

#### Analysis Details
> The image shows small terracotta pots with succulent plants placed on a tray, situated on tiled flooring against a white wall; the scene appears somewhat blurry and low in contrast.

#### Visual Enhancement Output
![Enhanced Image for minicpm-v4.6-latest](./minicpm_v4_6_latest_enhanced.jpg)

---

### Model: `minimax-m3:cloud`

- **Status**: ✅ Success
- **Time Taken**: 8.89 seconds
- **Explanation**: *The image is soft and slightly blurry, requiring denoising, upscaling, and moderate sharpening to recover detail. Colors are washed out, so increased saturation and contrast will restore the natural greens of the succulents and warm tones of the terracotta. A slight brightness boost and warmer temperature will compensate for the cool, flat CCTV-like white balance and bring out the earthy tones of the scene.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.05,
  "contrast": 1.25,
  "saturation": 1.35,
  "sharpness": 2,
  "denoise": true,
  "upscale": true,
  "rotate": 0,
  "temperature": 1.1,
  "tint": 1
}
  ```

#### Analysis Details
> A terracotta multi-pocket planter with various succulents (including a rosette-shaped succulent and a Kalanchoe) sitting on a brown tiled floor against a light-colored wall with a brown baseboard. A timestamp '2026/01/30 13:11:51' is visible in the bottom-left corner, suggesting it was captured by a security or surveillance camera.

#### Visual Enhancement Output
![Enhanced Image for minimax-m3-cloud](./minimax_m3_cloud_enhanced.jpg)

---

### Model: `qwen3-vl:2b`

- **Status**: ✅ Success
- **Time Taken**: 31.48 seconds
- **Explanation**: *The image is blurry, so sharpness is increased to enhance details. Low contrast is adjusted by increasing contrast to make the succulents and pots more visible. Brightness is slightly increased to brighten the scene.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.2,
  "contrast": 1.5,
  "saturation": 1.1,
  "sharpness": 3,
  "denoise": false,
  "upscale": true,
  "rotate": 0,
  "temperature": 1,
  "tint": 1
}
  ```

#### Analysis Details
> A scene with several succulent plants in terracotta pots arranged on a tiled floor against a white wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-2b](./qwen3_vl_2b_enhanced.jpg)

---

### Model: `qwen3-vl:4b`

- **Status**: ✅ Success
- **Time Taken**: 72.21 seconds
- **Explanation**: *Increasing brightness and contrast enhances visibility, while saturation boosts color vibrancy. Sharpness reduces blur, denoise minimizes grain, and upscaling improves resolution.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.15,
  "contrast": 1.3,
  "saturation": 1.2,
  "sharpness": 0.8,
  "denoise": true,
  "upscale": true,
  "rotate": 0,
  "temperature": 1,
  "tint": 1
}
  ```

#### Analysis Details
> A terracotta pot arrangement with three succulent plants placed on a tiled floor against a white wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-4b](./qwen3_vl_4b_enhanced.jpg)

---

### Model: `qwen3-vl:8b`

- **Status**: ✅ Success
- **Time Taken**: 109.40 seconds
- **Explanation**: *Increase brightness and contrast to enhance visibility, boost saturation for vivid plant colors, apply sharpening to reduce blur, and upscale to improve resolution.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.2,
  "contrast": 1.3,
  "saturation": 1.2,
  "sharpness": 2.5,
  "denoise": false,
  "upscale": true,
  "rotate": 0,
  "temperature": 1.1,
  "tint": 1
}
  ```

#### Analysis Details
> A scene with multiple potted succulents placed on a tiled surface against a wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-8b](./qwen3_vl_8b_enhanced.jpg)

---

### Model: `qwen3.5:cloud`

- **Status**: ✅ Success
- **Time Taken**: 50.72 seconds
- **Explanation**: *The image is soft and lacks definition, requiring significant sharpening and upscaling. Colors are washed out, necessitating higher contrast and saturation. The white balance appears slightly cool and greenish, so warming the temperature and adding magenta (via tint > 1.0) will correct the cast. Denoising is recommended due to visible grain.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.1,
  "contrast": 1.3,
  "saturation": 1.2,
  "sharpness": 3,
  "denoise": true,
  "upscale": true,
  "rotate": 0,
  "temperature": 1.1,
  "tint": 1.1
}
  ```

#### Analysis Details
> A cluster of three small terracotta pots containing various succulents, arranged in a matching saucer on a tiled floor against a white wall with a brown skirting board.

#### Visual Enhancement Output
![Enhanced Image for qwen3.5-cloud](./qwen3_5_cloud_enhanced.jpg)

---

### Model: `deepseek-ocr:latest`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 22.75 seconds
- **Failure/Error Message**:
  > `AI output was not in the expected JSON format.`

---

### Model: `deepseek-v4-pro:cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.35 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c8547643-4ef4-4ffa-b13f-eb00d172e518)"}`

---

### Model: `glm-5.1:cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.37 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 9e95b9f6-4029-42e2-9962-91ef4f11d1ce)"}`

---

### Model: `glm-5.2:cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.21 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 60c69ff4-8574-4b0a-9541-48664ca2fbaf)"}`

---

### Model: `qwen3-coder:480b-cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.38 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 400: {"error":"this model does not support image input (ref: bda69f89-e66c-4dc3-a0fe-513ab4f7eb78)"}`

---

### Model: `qwen3-vl:235b-cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.36 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 410: {"error":"qwen3-vl:235b was retired at 2026-06-16 00:00:00 -0700 PDT (ref: d64f40aa-56ea-44e6-8eab-530b2abae5d3)"}`

---

