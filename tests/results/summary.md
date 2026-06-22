# Ollama Models Test Results & Comparisons

This report lists the results of running image analysis on each Ollama model available in the system using the test image `tests/test.jpg`.

*Report updated on: 22/6/2026, 17:04:40*

## Execution Statistics
- **Total Models Evaluated**: 11
- **Successful Vision Analyses**: 5
- **Failed/Unsupported Models**: 6
- **Total Suite Execution Time**: 261.40s

## Model Performance Overview

| Model | Status | Execution Time (s) | Description Summary / Error |
| :--- | :--- | :--- | :--- |
| **kimi-k2.7-code:cloud** | ✅ Success | 6.59s | A terracotta triple-pot planter with succulents sits on brown tiled flooring against a white wall with a brown baseboard. A timestamp is visible in the bottom-left corner. |
| **llava:latest** | ✅ Success | 45.41s | The image shows a potted plant with various succulents, placed on a tiled floor indoors. The lighting is artificial and appears to be coming from above, casting shadows on the tiles. There are no people or moving objects in the scene. |
| **minimax-m3:cloud** | ✅ Success | 11.02s | A multi-tiered terracotta pot arrangement containing various succulents (including a rosette-shaped echeveria and trailing varieties) placed on a brown tiled floor against a beige wall, likely on a balcony or patio. A date stamp '2026/01/30 13:11:51' appears in the lower left corner. |
| **qwen3-vl:4b** | ✅ Success | 148.17s | A terracotta pot arrangement with multiple succulents placed on a tiled floor against a white wall. |
| **qwen3.5:cloud** | ✅ Success | 25.65s | A cluster of three terracotta pots holding various succulent plants, placed on a brown tiled floor against a white wall. |
| **deepseek-ocr:latest** | ❌ Failed/Unsupported | 22.75s | `AI output was not in the expected JSON format.` |
| **deepseek-v4-pro:cloud** | ❌ Failed/Unsupported | 0.35s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c8547643-4ef4-4ffa-b13f-eb00d172e518)"}` |
| **glm-5.1:cloud** | ❌ Failed/Unsupported | 0.37s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: 9e95b9f6-4029-42e2-9962-91ef4f11d1ce)"}` |
| **glm-5.2:cloud** | ❌ Failed/Unsupported | 0.36s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c178c5f7-d72f-4f5f-9c76-92b54f6dbf2a)"}` |
| **qwen3-coder:480b-cloud** | ❌ Failed/Unsupported | 0.38s | `Ollama API responded with status 400: {"error":"this model does not support image input (ref: bda69f89-e66c-4dc3-a0fe-513ab4f7eb78)"}` |
| **qwen3-vl:235b-cloud** | ❌ Failed/Unsupported | 0.36s | `Ollama API responded with status 410: {"error":"qwen3-vl:235b was retired at 2026-06-16 00:00:00 -0700 PDT (ref: d64f40aa-56ea-44e6-8eab-530b2abae5d3)"}` |

## Detailed Model Enhancements

### Model: `kimi-k2.7-code:cloud`

- **Status**: ✅ Success
- **Time Taken**: 6.59 seconds
- **Explanation**: *The image is low-resolution, hazy, and lacks contrast and color vibrancy. Slightly reducing brightness while boosting contrast and saturation will restore depth, sharpening will improve detail, and denoising/upscaling will address the low-quality capture.*
- **Adjustments Applied**:
  ```json
{
  "brightness": -0.1,
  "contrast": 1.4,
  "saturation": 1.3,
  "sharpness": 2.5,
  "denoise": true,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A terracotta triple-pot planter with succulents sits on brown tiled flooring against a white wall with a brown baseboard. A timestamp is visible in the bottom-left corner.

#### Visual Enhancement Output
![Enhanced Image for kimi-k2.7-code-cloud](./kimi_k2_7_code_cloud_enhanced.jpg)

---

### Model: `llava:latest`

- **Status**: ✅ Success
- **Time Taken**: 45.41 seconds
- **Explanation**: *To enhance the image, a moderate increase in brightness and contrast would help to make the details of the plant more visible. A slight sharpening could also improve the clarity of the succulents. Since the image is already quite saturated, no adjustment is needed for saturation. The denoise feature should be applied to reduce any noise present in the image. Upscaling would not be beneficial as it would introduce more artifacts due to the low resolution. There is no need to rotate the image.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.5,
  "contrast": 1.5,
  "saturation": 1,
  "sharpness": 2,
  "denoise": true,
  "upscale": false,
  "rotate": 0
}
  ```

#### Analysis Details
> The image shows a potted plant with various succulents, placed on a tiled floor indoors. The lighting is artificial and appears to be coming from above, casting shadows on the tiles. There are no people or moving objects in the scene.

#### Visual Enhancement Output
![Enhanced Image for llava-latest](./llava_latest_enhanced.jpg)

---

### Model: `minimax-m3:cloud`

- **Status**: ✅ Success
- **Time Taken**: 11.02 seconds
- **Explanation**: *A modest brightness lift and contrast increase will restore depth lost in the flat lighting. Slight saturation boost will revive the muted greens of the succulents and warm terracotta tones. Mild sharpening will bring out leaf and petal details that are currently soft, while avoiding over-sharpening. Upscaling is recommended given the moderate native resolution. Denoise is not strictly needed since noise is minimal, and no rotation is required as the orientation is correct.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.08,
  "contrast": 1.15,
  "saturation": 1.15,
  "sharpness": 1.5,
  "denoise": false,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A multi-tiered terracotta pot arrangement containing various succulents (including a rosette-shaped echeveria and trailing varieties) placed on a brown tiled floor against a beige wall, likely on a balcony or patio. A date stamp '2026/01/30 13:11:51' appears in the lower left corner.

#### Visual Enhancement Output
![Enhanced Image for minimax-m3-cloud](./minimax_m3_cloud_enhanced.jpg)

---

### Model: `qwen3-vl:4b`

- **Status**: ✅ Success
- **Time Taken**: 148.17 seconds
- **Explanation**: *Adjusting brightness to enhance visibility, increasing contrast and saturation for vivid colors, applying moderate sharpening to reduce blurriness, denoising to remove compression artifacts, and upscaling to improve resolution.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.1,
  "contrast": 1.3,
  "saturation": 1.2,
  "sharpness": 0.5,
  "denoise": true,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A terracotta pot arrangement with multiple succulents placed on a tiled floor against a white wall.

#### Visual Enhancement Output
![Enhanced Image for qwen3-vl-4b](./qwen3_vl_4b_enhanced.jpg)

---

### Model: `qwen3.5:cloud`

- **Status**: ✅ Success
- **Time Taken**: 25.65 seconds
- **Explanation**: *The image appears flat and washed out due to low contrast. Increasing contrast and saturation will revitalize the colors of the plants and pots. Sharpening is needed to counteract the softness, and denoising will help clean up the graininess visible in the wall and floor.*
- **Adjustments Applied**:
  ```json
{
  "brightness": 0.1,
  "contrast": 1.3,
  "saturation": 1.2,
  "sharpness": 2.5,
  "denoise": true,
  "upscale": true,
  "rotate": 0
}
  ```

#### Analysis Details
> A cluster of three terracotta pots holding various succulent plants, placed on a brown tiled floor against a white wall.

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
- **Time Taken**: 0.36 seconds
- **Failure/Error Message**:
  > `Ollama API responded with status 400: {"error":"this model does not support image input (ref: c178c5f7-d72f-4f5f-9c76-92b54f6dbf2a)"}`

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

