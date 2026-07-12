import fastifyPkg from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Writable } from 'stream';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import local helper modules
import { initDb, run, get, all, getFileHash } from './db.mjs';
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

// Custom pretty log stream to format Fastify/Pino JSON logs to console
// and write raw JSON logs to server.log
const logFile = path.join(__dirname, 'server.log');
const logFileStream = fs.createWriteStream(logFile, { flags: 'a' });

const customLoggerStream = new Writable({
  write(chunk, encoding, callback) {
    const rawLine = chunk.toString();
    logFileStream.write(rawLine);

    try {
      const log = JSON.parse(rawLine.trim());
      const date = new Date(log.time || Date.now()).toLocaleTimeString();
      
      let levelName = 'INFO';
      if (log.level === 60) levelName = 'FATAL';
      else if (log.level === 50) levelName = 'ERROR';
      else if (log.level === 40) levelName = 'WARN';
      else if (log.level === 30) levelName = 'INFO';
      else if (log.level === 20) levelName = 'DEBUG';
      else if (log.level === 10) levelName = 'TRACE';
      
      let msg = log.msg || '';
      
      if (log.req) {
        msg = `--> ${log.req.method} ${log.req.url}`;
      } else if (log.res) {
        const timeTaken = log.responseTime ? ` in ${log.responseTime.toFixed(1)}ms` : '';
        msg = `<-- ${log.res.statusCode}${timeTaken}`;
      } else if (log.err) {
        msg = `${msg} - Error: ${log.err.message}\n${log.err.stack || ''}`;
      }
      
      console.log(`[${date}] [${levelName}] ${msg}`);
    } catch (e) {
      console.log(rawLine.trim());
    }
    callback();
  }
});

const fastify = fastifyPkg({
  logger: {
    level: 'info',
    stream: customLoggerStream
  }
});

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

// GET /api/info/version (retrieve the application version from package.json)
fastify.get('/api/info/version', async (request, reply) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return { version: pkg.version || '0.0.0' };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Error al obtener la versión de la aplicación.' });
  }
});


// -------------------------------------------------------------
// Protected Image Endpoints
// -------------------------------------------------------------

// GET /api/images (list user's images)
fastify.get('/api/images', { preHandler: requireAuth }, async (request, reply) => {
  try {
    const images = await all(
      'SELECT id, filename, filepath, original_name, size, width, height, status, ai_analysis, applied_adjustments, enhanced_filename, created_at, captured_at, gps_latitude, gps_longitude, camera_make, camera_model, lens_model, fnumber, exposure_time, iso, focal_length, focal_length_35mm, flash, white_balance, software, artist FROM images WHERE user_id = ? ORDER BY created_at DESC',
      [request.session.userId]
    );
    
    // Parse JSON strings to objects for frontend convenience
    const parsedImages = images.map(img => {
      let analysis = null;
      if (img.ai_analysis) {
        try {
          analysis = JSON.parse(img.ai_analysis);
        } catch (e) {
          fastify.log.error('Error parsing stored AI analysis JSON:', e);
        }
      }
      let applied = null;
      if (img.applied_adjustments) {
        try {
          applied = JSON.parse(img.applied_adjustments);
        } catch (e) {
          fastify.log.error('Error parsing stored applied adjustments JSON:', e);
        }
      }
      return {
        ...img,
        ai_analysis: analysis,
        applied_adjustments: applied,
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
  const duplicateImages = [];
  
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

        // Compute hash of the saved file
        const hash = await getFileHash(savedFilepath);

        // Check if this hash is already uploaded by the current user or in this batch
        const existing = await get(
          'SELECT id, original_name FROM images WHERE user_id = ? AND hash = ?',
          [request.session.userId, hash]
        );
        const isDuplicateInBatch = uploadedImages.some(img => img.hash === hash);

        if (existing || isDuplicateInBatch) {
          // It's a duplicate, delete from disk
          if (fs.existsSync(savedFilepath)) {
            try { fs.unlinkSync(savedFilepath); } catch (e) {}
          }
          duplicateImages.push({
            original_name: originalName,
            hash: hash
          });
          continue; // skip DB save
        }

        // Get metadata (width, height, size)
        const meta = await getImageMetadata(savedFilepath);

        // Save into database including hash and EXIF metadata
        const dbResult = await run(
          `INSERT INTO images (user_id, filename, filepath, original_name, size, width, height, status, hash, captured_at, gps_latitude, gps_longitude, exif_processed, camera_make, camera_model, lens_model, fnumber, exposure_time, iso, focal_length, focal_length_35mm, flash, white_balance, software, artist)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            request.session.userId,
            uniqueFilename,
            savedFilepath,
            originalName,
            meta.size,
            meta.width,
            meta.height,
            'uploaded',
            hash,
            meta.captured_at,
            meta.gps_latitude,
            meta.gps_longitude,
            1, // Mark EXIF as processed on upload
            meta.camera_make,
            meta.camera_model,
            meta.lens_model,
            meta.fnumber,
            meta.exposure_time,
            meta.iso,
            meta.focal_length,
            meta.focal_length_35mm,
            meta.flash !== null && meta.flash !== undefined ? String(meta.flash) : null,
            meta.white_balance !== null && meta.white_balance !== undefined ? String(meta.white_balance) : null,
            meta.software,
            meta.artist
          ]
        );

        uploadedImages.push({
          id: dbResult.id,
          filename: uniqueFilename,
          filepath: savedFilepath, // Stored temporarily for cleanup on failure
          hash: hash, // Stored temporarily for batch duplicate check
          original_name: originalName,
          size: meta.size,
          width: meta.width,
          height: meta.height,
          captured_at: meta.captured_at,
          gps_latitude: meta.gps_latitude,
          gps_longitude: meta.gps_longitude,
          camera_make: meta.camera_make,
          camera_model: meta.camera_model,
          lens_model: meta.lens_model,
          fnumber: meta.fnumber,
          exposure_time: meta.exposure_time,
          iso: meta.iso,
          focal_length: meta.focal_length,
          focal_length_35mm: meta.focal_length_35mm,
          flash: meta.flash,
          white_balance: meta.white_balance,
          software: meta.software,
          artist: meta.artist,
          status: 'uploaded',
          original_url: `/uploads/originals/${uniqueFilename}`,
          enhanced_url: null,
          ai_analysis: null
        });
      }
    }

    if (uploadedImages.length === 0 && duplicateImages.length === 0) {
      return reply.status(400).send({ error: 'No se ha proporcionado ninguna imagen.' });
    }

    // Remove the temporary filepath and hash fields before returning
    const responseImages = uploadedImages.map(img => {
      const { filepath, hash, ...rest } = img;
      return rest;
    });

    return {
      success: true,
      images: responseImages,
      duplicates: duplicateImages
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
      rotate: userAdjustments.rotate !== undefined ? parseInt(userAdjustments.rotate) : (aiAdjustments.rotate !== undefined ? parseInt(aiAdjustments.rotate) : 0),
      temperature: userAdjustments.temperature !== undefined ? parseFloat(userAdjustments.temperature) : (aiAdjustments.temperature !== undefined ? parseFloat(aiAdjustments.temperature) : 1.0),
      tint: userAdjustments.tint !== undefined ? parseFloat(userAdjustments.tint) : (aiAdjustments.tint !== undefined ? parseFloat(aiAdjustments.tint) : 1.0)
    };

    const ext = path.extname(image.filename) || '.jpg';
    const baseName = path.basename(image.filename, ext);
    const enhancedFilename = `${baseName}_enhanced_${Date.now()}${ext}`;
    const enhancedFilepath = path.join(enhancedDir, enhancedFilename);

    // Process image using sharp
    const outputMeta = await enhanceImage(image.filepath, enhancedFilepath, options);

    // Save details in DB
    await run(
      'UPDATE images SET status = ?, enhanced_filepath = ?, enhanced_filename = ?, applied_adjustments = ? WHERE id = ?',
      ['enhanced', enhancedFilepath, enhancedFilename, JSON.stringify(options), imageId]
    );

    return {
      success: true,
      image: {
        id: image.id,
        filename: image.filename,
        original_name: image.original_name,
        size: image.size,
        status: 'enhanced',
        applied_adjustments: options,
        captured_at: image.captured_at,
        gps_latitude: image.gps_latitude,
        gps_longitude: image.gps_longitude,
        camera_make: image.camera_make,
        camera_model: image.camera_model,
        lens_model: image.lens_model,
        fnumber: image.fnumber,
        exposure_time: image.exposure_time,
        iso: image.iso,
        focal_length: image.focal_length,
        focal_length_35mm: image.focal_length_35mm,
        flash: image.flash,
        white_balance: image.white_balance,
        software: image.software,
        artist: image.artist,
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
