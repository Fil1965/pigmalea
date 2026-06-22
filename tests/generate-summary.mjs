import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsDir = path.join(__dirname, 'results');
const projectRootDir = path.join(__dirname, '..');

async function main() {
  try {
    // 1. Read all files in results directory
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'summary.json');
    
    console.log(`Found ${jsonFiles.length} JSON result files to compile.`);
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

    // 2. Generate summary.md content
    const totalModels = results.length;
    const successCount = results.filter(r => r.success).length;
    const failCount = totalModels - successCount;
    const totalDurationSec = (results.reduce((acc, r) => acc + parseFloat(r.durationMs || 0), 0) / 1000).toFixed(2);

    let mdContent = `# Ollama Models Test Results & Comparisons\n\n`;
    mdContent += `This report lists the results of running image analysis on each Ollama model available in the system using the test image \`tests/test.jpg\`.\n\n`;
    mdContent += `*Report updated on: ${new Date().toLocaleString()}*\n\n`;
    
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
    console.log(`Summary markdown successfully compiled at: ${summaryPath}`);

    // 3. Write working-models.json to the project root
    const workingModels = results.filter(r => r.success).map(r => r.model);
    const workingModelsPath = path.join(projectRootDir, 'working-models.json');
    await fs.writeFile(workingModelsPath, JSON.stringify(workingModels, null, 2), 'utf8');
    console.log(`Working models list saved to: ${workingModelsPath}`);

  } catch (err) {
    console.error('Error generating summary:', err.message);
  }
}

main();
