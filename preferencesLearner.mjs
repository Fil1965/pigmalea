import { all } from './db.mjs';

/**
 * Procesa una lista de imágenes editadas para calcular el mapa de offsets del usuario.
 * @param {Array} rows - Filas de la DB con ai_analysis, applied_adjustments y camera_model.
 * @returns {Object} Un perfil de preferencias con offsets globales y por modelo de cámara.
 */
export function calculatePreferencesProfile(rows) {
  if (!rows || rows.length === 0) {
    return { global: null, cameras: {} };
  }

  // Agrupar filas globales y por cámara
  const globalRows = rows;
  const cameraGroups = {};
  for (const row of rows) {
    if (row.camera_model) {
      const cleanModel = String(row.camera_model).trim();
      if (cleanModel && cleanModel.toLowerCase() !== 'unknown') {
        if (!cameraGroups[cleanModel]) {
          cameraGroups[cleanModel] = [];
        }
        cameraGroups[cleanModel].push(row);
      }
    }
  }

  // Helper para calcular offsets de un grupo de filas
  const calculateGroupOffsets = (groupRows, isCameraSpecific = false, cameraModel = null) => {
    const sums = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, temperature: 0, tint: 0 };
    const booleans = { denoise: { count: 0, userTrue: 0 }, upscale: { count: 0, userTrue: 0 } };
    let count = 0;

    for (const row of groupRows) {
      try {
        const aiObj = JSON.parse(row.ai_analysis);
        const ai = aiObj.adjustments;
        const user = JSON.parse(row.applied_adjustments);
        if (!ai || !user) continue;

        sums.brightness += (user.brightness ?? 0) - (ai.brightness ?? 0);
        sums.contrast += (user.contrast ?? 1.0) - (ai.contrast ?? 1.0);
        sums.saturation += (user.saturation ?? 1.0) - (ai.saturation ?? 1.0);
        sums.sharpness += (user.sharpness ?? 0) - (ai.sharpness ?? 0);
        sums.temperature += (user.temperature ?? 1.0) - (ai.temperature ?? 1.0);
        sums.tint += (user.tint ?? 1.0) - (ai.tint ?? 1.0);

        if (user.denoise !== undefined) {
          booleans.denoise.count++;
          if (user.denoise) booleans.denoise.userTrue++;
        }
        if (user.upscale !== undefined) {
          booleans.upscale.count++;
          if (user.upscale) booleans.upscale.userTrue++;
        }
        count++;
      } catch (e) {}
    }

    if (count === 0) return null;

    return {
      brightness: sums.brightness / count,
      contrast: sums.contrast / count,
      saturation: sums.saturation / count,
      sharpness: sums.sharpness / count,
      temperature: sums.temperature / count,
      tint: sums.tint / count,
      denoise_ratio: booleans.denoise.count > 0 ? booleans.denoise.userTrue / booleans.denoise.count : null,
      upscale_ratio: booleans.upscale.count > 0 ? booleans.upscale.userTrue / booleans.upscale.count : null,
      samplesCount: count,
      isCameraSpecific,
      cameraModel
    };
  };

  const globalOffsets = calculateGroupOffsets(globalRows, false, null);
  const camerasOffsets = {};
  for (const [model, group] of Object.entries(cameraGroups)) {
    // Requerimos al menos 3 muestras para considerarla específica de cámara
    if (group.length >= 3) {
      const cameraOffsets = calculateGroupOffsets(group, true, model);
      if (cameraOffsets) {
        camerasOffsets[model] = cameraOffsets;
      }
    }
  }

  return {
    global: globalOffsets,
    cameras: camerasOffsets
  };
}

/**
 * Obtiene los offsets preferidos para una cámara dada utilizando el perfil precalculado.
 * @param {Object} profile - Perfil de preferencias precalculado.
 * @param {string|null} cameraModel - Modelo de cámara.
 * @returns {Object|null} Offsets correspondientes.
 */
export function getOffsetsFromProfile(profile, cameraModel = null) {
  if (!profile) return null;
  if (cameraModel) {
    const cleanModel = String(cameraModel).trim();
    if (cleanModel && cleanModel.toLowerCase() !== 'unknown' && profile.cameras && profile.cameras[cleanModel]) {
      return profile.cameras[cleanModel];
    }
  }
  return profile.global || null;
}

/**
 * Calcula los ajustes personalizados aprendidos del usuario a partir de su historial.
 * @param {number} userId - ID del usuario.
 * @param {string|null} cameraModel - Opcional modelo de cámara para segmentar el aprendizaje.
 * @returns {Promise<Object|null>} Offsets aprendidos para cada parámetro o null si no hay historial.
 */
export async function getLearnedOffsets(userId, cameraModel = null) {
  const query = `
    SELECT ai_analysis, applied_adjustments, camera_model
    FROM images
    WHERE user_id = ? AND ai_analysis IS NOT NULL AND applied_adjustments IS NOT NULL
  `;
  const params = [userId];
  const rows = await all(query, params);
  const cleanCamera = cameraModel && cameraModel.toLowerCase() !== 'unknown' ? cameraModel : null;
  const profile = calculatePreferencesProfile(rows);
  return getOffsetsFromProfile(profile, cleanCamera);
}

/**
 * Aplica los offsets aprendidos sobre los ajustes sugeridos por la IA.
 * @param {Object} aiAdjustments - Los ajustes brutos recomendados por la IA.
 * @param {Object|null} offsets - Los offsets aprendidos del usuario.
 * @returns {Object} Ajustes optimizados para el usuario.
 */
export function applyLearnedOffsets(aiAdjustments, offsets) {
  if (!offsets) {
    return { ...aiAdjustments };
  }

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const result = { ...aiAdjustments };

  // Sumar desviaciones y limitar a rangos válidos
  if (aiAdjustments.brightness !== undefined) {
    result.brightness = Number(clamp(aiAdjustments.brightness + (offsets.brightness || 0), -0.5, 0.5).toFixed(2));
  }
  if (aiAdjustments.contrast !== undefined) {
    result.contrast = Number(clamp(aiAdjustments.contrast + (offsets.contrast || 0), 0.5, 2.0).toFixed(2));
  }
  if (aiAdjustments.saturation !== undefined) {
    result.saturation = Number(clamp(aiAdjustments.saturation + (offsets.saturation || 0), 0.0, 2.0).toFixed(2));
  }
  if (aiAdjustments.sharpness !== undefined) {
    result.sharpness = Number(clamp(aiAdjustments.sharpness + (offsets.sharpness || 0), 0.0, 5.0).toFixed(1));
  }
  if (aiAdjustments.temperature !== undefined) {
    result.temperature = Number(clamp(aiAdjustments.temperature + (offsets.temperature || 0), 0.5, 1.5).toFixed(2));
  }
  if (aiAdjustments.tint !== undefined) {
    result.tint = Number(clamp(aiAdjustments.tint + (offsets.tint || 0), 0.5, 1.5).toFixed(2));
  }

  // Modificar booleanos si se detecta un patrón claro de preferencia (>= 75% o <= 25%)
  if (offsets.denoise_ratio !== null) {
    if (offsets.denoise_ratio >= 0.75) result.denoise = true;
    else if (offsets.denoise_ratio <= 0.25) result.denoise = false;
  }
  if (offsets.upscale_ratio !== null) {
    if (offsets.upscale_ratio >= 0.75) result.upscale = true;
    else if (offsets.upscale_ratio <= 0.25) result.upscale = false;
  }

  // Propagar metadatos de aprendizaje para uso del frontend
  result.samplesCount = offsets.samplesCount;
  result.isCameraSpecific = offsets.isCameraSpecific;
  result.cameraModel = offsets.cameraModel;

  return result;
}

