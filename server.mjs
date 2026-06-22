import fastifyPkg from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import local helper modules
import { initDb, run, get, all } from './db.mjs';
import { analyzeImage, getAvailableVisionModel, getInstalledVisionModels } from './ollama.mjs';
import { enhanceImage, getImageMetadata } from './imageProcessor.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize folders
const uploadsDir = path.join(__dirname, 'uploads');
const originalsDir = path.join(uploadsDir, 'originals');
const enhancedDir = path.join(uploadsDir, 'enhanced');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(originalsDir)) fs.mkdirSync(originalsDir);
if (!fs.existsSync(enhancedDir)) fs.mkdirSync(enhancedDir);

const fastify = fastifyPkg({ logger: true });

// Register cookies and session
fastify.register(fastifyCookie);
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-very-long-secret-key-that-should-be-kept-safe',
  cookie: {
    secure: false, // Set to true if deploying over HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
});

// Register multipart support for file uploads
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Serve frontend static files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Serve uploaded images static files (must use decorateReply: false)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/',
  decorateReply: false
});

// Authentication guard hook
const requireAuth = async (request, reply) => {
  if (!request.session.userId) {
    reply.status(401).send({ error: 'Inicia sesión para realizar esta acción.' });
  }
};

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

// POST /api/register
fastify.post('/api/register', async (request, reply) => {
  const { username, password } = request.body || {};
  if (!username || !password) {
    return reply.status(400).send({ error: 'Nombre de usuario y contraseña requeridos.' });
  }

  try {
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return reply.status(400).send({ error: 'El usuario debe tener al menos 3 caracteres.' });
    }
    if (password.length < 5) {
      return reply.status(400).send({ error: 'La contraseña debe tener al menos 5 caracteres.' });
    }

    // Check if user exists
    const existing = await get('SELECT id FROM users WHERE username = ?', [trimmedUsername]);
    if (existing) {
      return reply.status(409).send({ error: 'El nombre de usuario ya está registrado.' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Save user
    const result = await run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [trimmedUsername, hash]
    );

    // Save user in session
    request.session.userId = result.id;
    request.session.username = trimmedUsername;
    await request.session.save();

    return { success: true, user: { id: result.id, username: trimmedUsername } };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error interno del servidor al registrar.' });
  }
});

// POST /api/login
fastify.post('/api/login', async (request, reply) => {
  const { username, password } = request.body || {};
  if (!username || !password) {
    return reply.status(400).send({ error: 'Nombre de usuario y contraseña requeridos.' });
  }

  try {
    const trimmedUsername = username.trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE username = ?', [trimmedUsername]);
    if (!user) {
      return reply.status(401).send({ error: 'Usuario o contraseña incorrectos.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return reply.status(401).send({ error: 'Usuario o contraseña incorrectos.' });
    }

    request.session.userId = user.id;
    request.session.username = user.username;
    await request.session.save();

    return { success: true, user: { id: user.id, username: user.username } };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error interno del servidor al iniciar sesión.' });
  }
});

// POST /api/logout
fastify.post('/api/logout', async (request, reply) => {
  if (request.session.userId) {
    await request.session.destroy();
    return { success: true, message: 'Sesión cerrada.' };
  }
  return { success: true };
});

// GET /api/me
fastify.get('/api/me', async (request, reply) => {
  if (request.session.userId) {
    return { loggedIn: true, user: { id: request.session.userId, username: request.session.username } };
  }
  return { loggedIn: false };
});

// GET /api/info/model (retrieve the active vision model name and list of available vision models)
fastify.get('/api/info/model', async (request, reply) => {
  try {
    const model = await getAvailableVisionModel();
    const models = await getInstalledVisionModels();
    return { model, models };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error al obtener el modelo de IA.' });
  }
});


// -------------------------------------------------------------
// Protected Image Endpoints
// -------------------------------------------------------------

// GET /api/images (list user's images)
fastify.get('/api/images', { preHandler: requireAuth }, async (request, reply) => {
  try {
    const images = await all(
      'SELECT id, filename, filepath, original_name, size, width, height, status, ai_analysis, enhanced_filename, created_at FROM images WHERE user_id = ? ORDER BY created_at DESC',
      [request.session.userId]
    );
    
    // Parse ai_analysis string to object for frontend convenience
    const parsedImages = images.map(img => {
      let analysis = null;
      if (img.ai_analysis) {
        try {
          analysis = JSON.parse(img.ai_analysis);
        } catch (e) {
          fastify.log.error('Error parsing stored AI analysis JSON:', e);
        }
      }
      return {
        ...img,
        ai_analysis: analysis,
        original_url: `/uploads/originals/${img.filename}`,
        enhanced_url: img.enhanced_filename ? `/uploads/enhanced/${img.enhanced_filename}` : null
      };
    });

    return parsedImages;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error al obtener la lista de imágenes.' });
  }
});

// POST /api/upload (upload multiple files)
fastify.post('/api/upload', { preHandler: requireAuth }, async (request, reply) => {
  const parts = request.files();
  const uploadedImages = [];
  
  try {
    for await (const part of parts) {
      if (part.file) {
        const originalName = part.filename;
        const mimeType = part.mimetype;
        if (!mimeType.startsWith('image/')) {
          // Cleanup already uploaded files in this request
          for (const img of uploadedImages) {
            if (fs.existsSync(img.filepath)) {
              try { fs.unlinkSync(img.filepath); } catch (e) {}
            }
          }
          return reply.status(400).send({ error: 'Uno de los archivos subidos no es una imagen válida.' });
        }

        const ext = path.extname(originalName) || '.jpg';
        const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const savedFilepath = path.join(originalsDir, uniqueFilename);

        await pipeline(part.file, fs.createWriteStream(savedFilepath));

        // Get metadata (width, height, size)
        const meta = await getImageMetadata(savedFilepath);

        // Save into database
        const dbResult = await run(
          `INSERT INTO images (user_id, filename, filepath, original_name, size, width, height, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            request.session.userId,
            uniqueFilename,
            savedFilepath,
            originalName,
            meta.size,
            meta.width,
            meta.height,
            'uploaded'
          ]
        );

        uploadedImages.push({
          id: dbResult.id,
          filename: uniqueFilename,
          filepath: savedFilepath, // Stored temporarily for cleanup on failure
          original_name: originalName,
          size: meta.size,
          width: meta.width,
          height: meta.height,
          status: 'uploaded',
          original_url: `/uploads/originals/${uniqueFilename}`,
          enhanced_url: null,
          ai_analysis: null
        });
      }
    }

    if (uploadedImages.length === 0) {
      return reply.status(400).send({ error: 'No se ha proporcionado ninguna imagen.' });
    }

    // Remove the temporary filepath field before returning
    const responseImages = uploadedImages.map(img => {
      const { filepath, ...rest } = img;
      return rest;
    });

    return {
      success: true,
      images: responseImages
    };

  } catch (err) {
    fastify.log.error(err);
    // Cleanup any files written in this request if DB failed
    for (const img of uploadedImages) {
      if (fs.existsSync(img.filepath)) {
        try { fs.unlinkSync(img.filepath); } catch (e) {}
      }
    }
    return reply.status(500).send({ error: 'Error al procesar y guardar las imágenes.' });
  }
});

// POST /api/images/:id/analyze (trigger Ollama LLama3.2-Vision analysis)
fastify.post('/api/images/:id/analyze', { preHandler: requireAuth }, async (request, reply) => {
  const imageId = request.params.id;
  const { model } = request.body || {};
  try {
    const image = await get('SELECT * FROM images WHERE id = ? AND user_id = ?', [imageId, request.session.userId]);
    if (!image) {
      return reply.status(404).send({ error: 'Imagen no encontrada.' });
    }

    // Call Ollama helper
    const analysisResult = await analyzeImage(image.filepath, model);

    // Save result to DB
    const stringifiedResult = JSON.stringify(analysisResult);
    await run(
      'UPDATE images SET status = ?, ai_analysis = ? WHERE id = ?',
      ['analyzed', stringifiedResult, imageId]
    );

    return {
      success: true,
      ai_analysis: analysisResult,
      status: 'analyzed'
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: `Error al analizar la imagen con la IA: ${err.message}` });
  }
});

// POST /api/images/:id/enhance (apply sharp adjustments)
fastify.post('/api/images/:id/enhance', { preHandler: requireAuth }, async (request, reply) => {
  const imageId = request.params.id;
  const userAdjustments = request.body || {};

  try {
    const image = await get('SELECT * FROM images WHERE id = ? AND user_id = ?', [imageId, request.session.userId]);
    if (!image) {
      return reply.status(404).send({ error: 'Imagen no encontrada.' });
    }

    // Determine target parameters (fall back to AI recommendations if not provided by user)
    let aiAdjustments = {};
    if (image.ai_analysis) {
      try {
        const analysisObj = JSON.parse(image.ai_analysis);
        aiAdjustments = analysisObj.adjustments || {};
      } catch (e) {
        fastify.log.error('Could not parse saved AI analysis for enhancement:', e);
      }
    }

    // Merge parameters: prioritize request parameters, fallback to AI parameters, fallback to default neutral values
    const options = {
      brightness: userAdjustments.brightness !== undefined ? parseFloat(userAdjustments.brightness) : (aiAdjustments.brightness !== undefined ? parseFloat(aiAdjustments.brightness) : 0),
      contrast: userAdjustments.contrast !== undefined ? parseFloat(userAdjustments.contrast) : (aiAdjustments.contrast !== undefined ? parseFloat(aiAdjustments.contrast) : 1.0),
      saturation: userAdjustments.saturation !== undefined ? parseFloat(userAdjustments.saturation) : (aiAdjustments.saturation !== undefined ? parseFloat(aiAdjustments.saturation) : 1.0),
      sharpness: userAdjustments.sharpness !== undefined ? parseFloat(userAdjustments.sharpness) : (aiAdjustments.sharpness !== undefined ? parseFloat(aiAdjustments.sharpness) : 0),
      denoise: userAdjustments.denoise !== undefined ? !!userAdjustments.denoise : (aiAdjustments.denoise !== undefined ? !!aiAdjustments.denoise : false),
      upscale: userAdjustments.upscale !== undefined ? !!userAdjustments.upscale : (aiAdjustments.upscale !== undefined ? !!aiAdjustments.upscale : false),
      rotate: userAdjustments.rotate !== undefined ? parseInt(userAdjustments.rotate) : (aiAdjustments.rotate !== undefined ? parseInt(aiAdjustments.rotate) : 0)
    };

    const ext = path.extname(image.filename) || '.jpg';
    const baseName = path.basename(image.filename, ext);
    const enhancedFilename = `${baseName}_enhanced_${Date.now()}${ext}`;
    const enhancedFilepath = path.join(enhancedDir, enhancedFilename);

    // Process image using sharp
    const outputMeta = await enhanceImage(image.filepath, enhancedFilepath, options);

    // Save details in DB
    await run(
      'UPDATE images SET status = ?, enhanced_filepath = ?, enhanced_filename = ? WHERE id = ?',
      ['enhanced', enhancedFilepath, enhancedFilename, imageId]
    );

    return {
      success: true,
      image: {
        id: image.id,
        filename: image.filename,
        original_name: image.original_name,
        size: image.size,
        status: 'enhanced',
        original_url: `/uploads/originals/${image.filename}`,
        enhanced_url: `/uploads/enhanced/${enhancedFilename}`,
        enhanced_width: outputMeta.width,
        enhanced_height: outputMeta.height,
        enhanced_size: outputMeta.size
      }
    };

  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: `Error al mejorar la imagen: ${err.message}` });
  }
});

// DELETE /api/images/:id (delete image record and files)
fastify.delete('/api/images/:id', { preHandler: requireAuth }, async (request, reply) => {
  const imageId = request.params.id;
  try {
    const image = await get('SELECT * FROM images WHERE id = ? AND user_id = ?', [imageId, request.session.userId]);
    if (!image) {
      return reply.status(404).send({ error: 'Imagen no encontrada.' });
    }

    // Delete database entry
    await run('DELETE FROM images WHERE id = ?', [imageId]);

    // Delete files asynchronously (ignore if not found)
    if (fs.existsSync(image.filepath)) {
      try { fs.unlinkSync(image.filepath); } catch (e) {}
    }
    if (image.enhanced_filepath && fs.existsSync(image.enhanced_filepath)) {
      try { fs.unlinkSync(image.enhanced_filepath); } catch (e) {}
    }

    return { success: true, message: 'Imagen eliminada correctamente.' };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error al eliminar la imagen.' });
  }
});

// Start the server
const start = async () => {
  try {
    await initDb();
    const port = process.env.PORT || 3000;
    const address = await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server is running at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
