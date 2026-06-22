import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

import { analyzeImage } from '../ollama.mjs';
import { enhanceImage } from '../imageProcessor.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testImagePath = path.join(__dirname, 'test.jpg');
const resultsDir = path.join(__dirname, 'results');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Setup: Ensure results directory exists
await fs.mkdir(resultsDir, { recursive: true });

test('Ollama Models Analysis and Enhancement Test Suite', async (t) => {
  // 1. Health check to ensure Ollama service is online
  await t.test('Ollama service health check', async () => {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/tags`);
      assert.ok(response.ok, `Ollama server tags API returned status ${response.status}`);
    } catch (err) {
      assert.fail(`Ollama service is not running or unreachable at ${OLLAMA_HOST}. Error: ${err.message}`);
    }
  });

  // 2. Fetch all installed models
  let models = [];
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    const data = await response.json();
    models = (data.models || []).map(m => m.name);
  } catch (err) {
    assert.fail(`Failed to fetch models from Ollama: ${err.message}`);
  }

  // Parse target model from command line arguments or environment variable
  let targetModel = process.env.MODEL || null;
  if (!targetModel) {
    const modelFlagIndex = process.argv.findIndex(arg => arg === '--model' || arg === '-m');
    if (modelFlagIndex !== -1 && process.argv[modelFlagIndex + 1]) {
      targetModel = process.argv[modelFlagIndex + 1];
    } else {
      // Look for any positional argument that is not the node executable, --test, or the test runner files, and doesn't start with '-'
      const possibleArgs = process.argv.slice(2).filter(arg => {
        if (arg.startsWith('-')) return false;
        if (arg.endsWith('ollama-models.test.mjs')) return false;
        return true;
      });
      if (possibleArgs.length > 0) {
        targetModel = possibleArgs[0];
      }
    }
  }

  if (targetModel) {
    const matchedModels = models.filter(m => m.toLowerCase() === targetModel.toLowerCase() || m.toLowerCase().includes(targetModel.toLowerCase()));
    if (matchedModels.length > 0) {
      models = matchedModels;
      console.log(`Filtering tests to run only for model(s): ${models.join(', ')}`);
    } else {
      models = [targetModel];
      console.log(`Model "${targetModel}" not found in local Ollama list, but will attempt to test it anyway.`);
    }
  }

  if (models.length === 0) {
    console.warn('No models found in Ollama to test.');
    return;
  }

  console.log(`Found ${models.length} models to test in Ollama:`, models);

  const results = [];

  // 3. Run analysis and enhancement on each model
  for (const model of models) {
    await t.test(`Model: ${model}`, async (st) => {
      const startTime = performance.now();
      let success = false;
      let analysis = null;
      let errorMessage = null;
      let enhancedImageName = null;

      try {
        console.log(`\n==================================================`);
        console.log(`Testing model [${model}] with ${testImagePath}...`);
        
        // Call the image analysis helper with keepAlive = 0 to avoid VRAM congestion
        analysis = await analyzeImage(testImagePath, model, 0);
        
        // Assert basic schema validity
        assert.ok(analysis, 'Analysis response should not be null');
        assert.ok(analysis.description, 'Analysis should contain a description field');
        assert.ok(analysis.adjustments, 'Analysis should contain adjustments parameters');
        assert.ok(analysis.adjustments.temperature !== undefined, 'Analysis adjustments should contain temperature parameter');
        assert.ok(analysis.adjustments.tint !== undefined, 'Analysis adjustments should contain tint parameter');
        assert.ok(analysis.explanation, 'Analysis should contain an explanation field');
        
        success = true;
        console.log(`Analysis successful for [${model}].`);

        // Apply adjustments to the test image
        const sanitizedModel = model.replace(/[^a-zA-Z0-9]/g, '_');
        enhancedImageName = `${sanitizedModel}_enhanced.jpg`;
        const outputPath = path.join(resultsDir, enhancedImageName);

        console.log(`Applying adjustments to enhance image for [${model}]...`);
        await enhanceImage(testImagePath, outputPath, analysis.adjustments);
        console.log(`Enhanced image saved to ${outputPath}`);
      } catch (err) {
        success = false;
        errorMessage = err.message;
        console.error(`Failed testing model [${model}]. Error: ${err.message}`);
      } finally {
        const endTime = performance.now();
        const durationMs = endTime - startTime;
        const durationSec = (durationMs / 1000).toFixed(2);

        const resultData = {
          model,
          success,
          durationMs,
          durationSec,
          analysis,
          error: errorMessage,
          enhancedImage: enhancedImageName
        };

        results.push(resultData);

        // Save individual model JSON file
        const sanitizedModel = model.replace(/[^a-zA-Z0-9]/g, '_');
        const jsonFilePath = path.join(resultsDir, `${sanitizedModel}.json`);
        await fs.writeFile(jsonFilePath, JSON.stringify(resultData, null, 2), 'utf8');
      }
    });
  }

  // 4. Compile summary markdown report
  await t.test('Generate Markdown summary report', async () => {
    try {
      await generateSummaryMarkdown(resultsDir);
    } catch (err) {
      assert.fail(`Failed to generate summary markdown or working models list: ${err.message}`);
    }
  });
});

/**
 * Compiles a visual markdown summary report of the test results by reading JSON files on disk.
 * @param {string} resultsDir - Directory containing the JSON result files.
 */
async function generateSummaryMarkdown(resultsDir) {
  const files = await fs.readdir(resultsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'summary.json');
  
  const results = [];
  for (const file of jsonFiles) {
    const filePath = path.join(resultsDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    try {
      const data = JSON.parse(content);
      if (data.model) {
        results.push(data);
      }
    } catch (err) {
      console.error(`Error parsing JSON file ${file}:`, err.message);
    }
  }

  // Sort results: successful first, then alphabetical by model name
  results.sort((a, b) => {
    if (a.success && !b.success) return -1;
    if (!a.success && b.success) return 1;
    return a.model.localeCompare(b.model);
  });

  const totalModels = results.length;
  const successCount = results.filter(r => r.success).length;
  const failCount = totalModels - successCount;
  const totalDurationSec = (results.reduce((acc, r) => acc + parseFloat(r.durationMs || 0), 0) / 1000).toFixed(2);

  let mdContent = `# Ollama Models Test Results & Comparisons\n\n`;
  mdContent += `This report lists the results of running image analysis on each Ollama model available in the system using the test image \`tests/test.jpg\`.\n\n`;
  
  mdContent += `*Report generated on: ${new Date().toLocaleString()}*\n\n`;
  
  mdContent += `## Execution Statistics\n`;
  mdContent += `- **Total Models Evaluated**: ${totalModels}\n`;
  mdContent += `- **Successful Vision Analyses**: ${successCount}\n`;
  mdContent += `- **Failed/Unsupported Models**: ${failCount}\n`;
  mdContent += `- **Total Suite Execution Time**: ${totalDurationSec}s\n\n`;

  mdContent += `## Model Performance Overview\n\n`;
  mdContent += `| Model | Status | Execution Time (s) | Description Summary / Error |\n`;
  mdContent += `| :--- | :--- | :--- | :--- |\n`;

  for (const r of results) {
    const statusIcon = r.success ? '✅ Success' : '❌ Failed/Unsupported';
    const errorClean = (r.error || 'Unknown error').trim().replace(/\n/g, ' ');
    const descriptionOrError = r.success
      ? (r.analysis?.description || 'No description').replace(/\n/g, ' ')
      : `\`${errorClean}\``;
    mdContent += `| **${r.model}** | ${statusIcon} | ${r.durationSec || '0.00'}s | ${descriptionOrError} |\n`;
  }

  mdContent += `\n## Detailed Model Enhancements\n\n`;

  for (const r of results) {
    mdContent += `### Model: \`${r.model}\`\n\n`;
    mdContent += `- **Status**: ${r.success ? '✅ Success' : '❌ Failed / Unsupported (No Vision)'}\n`;
    mdContent += `- **Time Taken**: ${r.durationSec || '0.00'} seconds\n`;

    if (r.success && r.analysis) {
      mdContent += `- **Explanation**: *${r.analysis.explanation}*\n`;
      mdContent += `- **Adjustments Applied**:\n`;
      mdContent += `  \`\`\`json\n${JSON.stringify(r.analysis.adjustments, null, 2)}\n  \`\`\`\n\n`;
      
      mdContent += `#### Analysis Details\n`;
      mdContent += `> ${r.analysis.description}\n\n`;
      
      if (r.enhancedImage) {
        mdContent += `#### Visual Enhancement Output\n`;
        const sanitizedModelForAlt = r.model.replace(/:/g, '-');
        mdContent += `![Enhanced Image for ${sanitizedModelForAlt}](./${r.enhancedImage})\n\n`;
      }
    } else {
      const errorCleanMsg = (r.error || 'Unknown error').trim();
      mdContent += `- **Failure/Error Message**:\n`;
      mdContent += `  > \`${errorCleanMsg}\`\n\n`;
    }
    
    mdContent += `---\n\n`;
  }

  const summaryPath = path.join(resultsDir, 'summary.md');
  await fs.writeFile(summaryPath, mdContent, 'utf8');
  console.log(`\nSummary markdown successfully compiled at: ${summaryPath}`);

  // Write working-models.json to the project root
  const workingModels = results.filter(r => r.success).map(r => r.model);
  const workingModelsPath = path.join(resultsDir, '..', '..', 'working-models.json');
  await fs.writeFile(workingModelsPath, JSON.stringify(workingModels, null, 2), 'utf8');
  console.log(`Working models list saved to: ${workingModelsPath}`);
}
