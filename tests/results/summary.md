# Ollama Models Test Results & Comparisons

This report lists the results of running image analysis on each Ollama model available in the system using the test image `tests/test.jpg`.

*Report generated on: 22/6/2026, 18:32:44*

## Execution Statistics
- **Total Models Evaluated**: 14
- **Successful Vision Analyses**: 6
- **Failed/Unsupported Models**: 8
- **Total Suite Execution Time**: 436.51s

## Model Performance Overview

| Model | Status | Execution Time (s) | Description Summary / Error |
| :--- | :--- | :--- | :--- |
| **kimi-k2.7-code:cloud** | ✅ Success | 4.16s | A terracotta multi-pot planter with assorted succulents sits on a brown tiled floor against a white wall. |
| **llava:latest** | ✅ Success | 12.19s | The image shows a potted plant with various succulents, placed on a tiled floor. The lighting in the room is soft and diffused, creating a calm atmosphere. There are no people or moving objects in the scene. |
| **minicpm-v4.6:latest** | ✅ Success | 17.30s | The image shows potted succulent plants in terracotta pots placed on a tiled floor, with visible blurriness and low contrast. The scene appears to be outdoors or in a semi-enclosed space with a white wall background. |
| **qwen3-vl:2b** | ✅ Success | 42.08s | A terracotta pot arrangement with multiple succulents placed on a tiled floor against a white wall. |
| **qwen3-vl:8b** | ✅ Success | 259.64s | A terracotta pot arrangement with succulent plants placed on a tiled surface against a wall. |
| **qwen3.5:cloud** | ✅ Success | 23.70s | A cluster of small terracotta pots containing various succulents sitting on a reddish-brown tiled floor against a white wall. |
| **deepseek-ocr:latest** | ❌ Failed/Unsupported | 22.75s | `AI output was not in the expected JSON format.` |
| **deepseek-v4-pro:cloud** | ❌ Failed/Unsupported | 0.35s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c8547643-4ef4-4ffa-b13f-eb00d172e518)"}` |
| **glm-5.1:cloud** | ❌ Failed/Unsupported | 0.37s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 9e95b9f6-4029-42e2-9962-91ef4f11d1ce)"}` |
| **glm-5.2:cloud** | ❌ Failed/Unsupported | 0.11s | `Ollama API responded with status 401: {"error":"Unauthorized"}` |
| **minimax-m3:cloud** | ❌ Failed/Unsupported | 0.11s | `Ollama API responded with status 401: {"error":"Unauthorized"}` |
| **qwen3-coder:480b-cloud** | ❌ Failed/Unsupported | 0.38s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: bda69f89-e66c-4dc3-a0fe-513ab4f7eb78)"}` |
| **qwen3-vl:235b-cloud** | ❌ Failed/Unsupported | 0.36s | `Ollama API responded with status 410: {"error":"qwen3-vl:235b was retired at 2026-06-16 00:00:00 -0700 PDT (ref: d64f40aa-56ea-44e6-8eab-530b2abae5d3)"}` |
| **qwen3-vl:4b** | ❌ Failed/Unsupported | 53.01s | `Ollama returned an empty response.` |

## Detailed Model Enhancements

### Model: `kimi-k2.7-code:cloud`

- **Status**: ✅ Success
- **Time Taken**: 4.16 seconds
- **Explanation**: *Increasing contrast and saturation will restore depth and color to the washed-out succulents and terracotta, while a moderate sharpness boost and upscaling will help compensate for the low-resolution blur.*
- **Adjustments Applied**:
  ```json
{
  "brightness": -0.05,
  "contrast": 1.25,
  "saturation": 1.2,
  "sharpness": 1.5,
  "denoise": false,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A terracotta multi-pot planter with assorted succulents sits on a brown tiled floor against a white wall.

#### Visual Enhancement Output
![Enhanced Image for kimi-k2.7-code-cloud](./kimi_k2_7_code_cloud_enhanced.jpg)

---

### Model: `llava:latest`

- **Status**: ✅ Success
- **Time Taken**: 12.19 seconds
- **Explanation**: *To enhance the image, it would benefit from increased brightness and contrast to make the details of the plant more visible. The sharpness could be improved by applying a slight sharpening filter. Since the image is already in color, no adjustments are needed for temperature or tint.*
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
> The image shows a potted plant with various succulents, placed on a tiled floor. The lighting in the room is soft and diffused, creating a calm atmosphere. There are no people or moving objects in the scene.

#### Visual Enhancement Output
![Enhanced Image for llava-latest](./llava_latest_enhanced.jpg)

---

### Model: `minicpm-v4.6:latest`

- **Status**: ✅ Success
- **Time Taken**: 17.30 seconds
- **Explanation**: *The adjustments are made to enhance clarity and color vibrance by increasing brightness, contrast, saturation, and sharpness, while denoising and upscaling to improve overall quality.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.15,
  "contrast": 1.2,
  "saturation": 1.1,
  "sharpness": 4,
  "denoise": true,
  "upscale": true,
  "rotate": 0,
  "temperature": 1,
  "tint": 1
}
  ```

#### Analysis Details
> The image shows potted succulent plants in terracotta pots placed on a tiled floor, with visible blurriness and low contrast. The scene appears to be outdoors or in a semi-enclosed space with a white wall background.

#### Visual Enhancement Output
![Enhanced Image for minicpm-v4.6-latest](./minicpm_v4_6_latest_enhanced.jpg)

---

### Model: `qwen3-vl:2b`

- **Status**: ✅ Success
- **Time Taken**: 42.08 seconds
- **Explanation**: *The image is blurry and has noise; increasing sharpness to enhance clarity and denoising to reduce artifacts.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.2,
  "contrast": 1.2,
  "saturation": 1,
  "sharpness": 3,
  "denoise": true,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A terracotta pot arrangement with multiple succulents placed on a tiled floor against a white wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-2b](./qwen3_vl_2b_enhanced.jpg)

---

### Model: `qwen3-vl:8b`

- **Status**: ✅ Success
- **Time Taken**: 259.64 seconds
- **Explanation**: *Increase contrast and sharpness to counteract blurriness, slightly boost brightness/saturation for clarity. Upscaling recommended due to low resolution.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.1,
  "contrast": 1.2,
  "saturation": 1.1,
  "sharpness": 2.5,
  "denoise": false,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A terracotta pot arrangement with succulent plants placed on a tiled surface against a wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-8b](./qwen3_vl_8b_enhanced.jpg)

---

### Model: `qwen3.5:cloud`

- **Status**: ✅ Success
- **Time Taken**: 23.70 seconds
- **Explanation**: *The image appears washed out with low contrast, making the plants look pale. Increasing contrast and saturation will restore vibrancy to the succulents and pots. The image is soft and grainy, requiring sharpening and denoising to improve clarity and detail.*
- **Adjustments Applied**:
  ```json
{
  "brightness": -0.1,
  "contrast": 1.35,
  "saturation": 1.2,
  "sharpness": 2.5,
  "denoise": true,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A cluster of small terracotta pots containing various succulents sitting on a reddish-brown tiled floor against a white wall.

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
- **Time Taken**: 0.11 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 401: {"error":"Unauthorized"}`

---

### Model: `minimax-m3:cloud`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 0.11 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 401: {"error":"Unauthorized"}`

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

### Model: `qwen3-vl:4b`

- **Status**: ❌ Failed / Unsupported (No Vision)
- **Time Taken**: 53.01 seconds
- **Failure/Error Message**:
  > `Ollama returned an empty response.`

---

