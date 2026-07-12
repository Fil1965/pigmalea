import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import exifr from 'exifr';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'pigmalea.db');

// Connect to SQLite database
export const db = new Database(dbPath);

// Enable WAL mode (Write-Ahead Logging) for better concurrency and speed
db.pragma('journal_mode = WAL');

// Promise-based query helpers for backward compatibility with server.mjs
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      resolve({ id: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      reject(err);
    }
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(params);
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
};

// Helper to compute sha256 hash of a file
export function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve(null);
    }
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// Initialize schema
export const initDb = async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        original_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        status TEXT DEFAULT 'uploaded',
        hash TEXT,
        ai_analysis TEXT,
        applied_adjustments TEXT,
        captured_at TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        exif_processed INTEGER DEFAULT 0,
        camera_make TEXT,
        camera_model TEXT,
        lens_model TEXT,
        fnumber REAL,
        exposure_time REAL,
        iso INTEGER,
        focal_length REAL,
        focal_length_35mm REAL,
        flash TEXT,
        white_balance TEXT,
        software TEXT,
        artist TEXT,
        enhanced_filepath TEXT,
        enhanced_filename TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const tableInfo = db.prepare("PRAGMA table_info(images)").all();

    // Helper to alter columns dynamically if they don't exist
    const addColumnIfNeeded = (colName, colType) => {
      const exists = tableInfo.some(column => column.name === colName);
      if (!exists) {
        db.prepare(`ALTER TABLE images ADD COLUMN ${colName} ${colType}`).run();
        console.log(`Added ${colName} column to images table.`);
      }
    };

    addColumnIfNeeded('hash', 'TEXT');
    addColumnIfNeeded('applied_adjustments', 'TEXT');
    addColumnIfNeeded('captured_at', 'TEXT');
    addColumnIfNeeded('gps_latitude', 'REAL');
    addColumnIfNeeded('gps_longitude', 'REAL');
    addColumnIfNeeded('exif_processed', 'INTEGER DEFAULT 0');
    addColumnIfNeeded('camera_make', 'TEXT');
    addColumnIfNeeded('camera_model', 'TEXT');
    addColumnIfNeeded('lens_model', 'TEXT');
    addColumnIfNeeded('fnumber', 'REAL');
    addColumnIfNeeded('exposure_time', 'REAL');
    addColumnIfNeeded('iso', 'INTEGER');
    addColumnIfNeeded('focal_length', 'REAL');
    addColumnIfNeeded('focal_length_35mm', 'REAL');
    addColumnIfNeeded('flash', 'TEXT');
    addColumnIfNeeded('white_balance', 'TEXT');
    addColumnIfNeeded('software', 'TEXT');
    addColumnIfNeeded('artist', 'TEXT');

    // Recalculate hashes for images that have NULL hash
    const rowsWithoutHash = db.prepare("SELECT id, filepath FROM images WHERE hash IS NULL").all();
    if (rowsWithoutHash.length > 0) {
      console.log(`Recalculating hashes for ${rowsWithoutHash.length} existing images...`);
      for (const row of rowsWithoutHash) {
        try {
          const fileHash = await getFileHash(row.filepath);
          if (fileHash) {
            db.prepare("UPDATE images SET hash = ? WHERE id = ?").run(fileHash, row.id);
            console.log(`Updated hash for image ID ${row.id}: ${fileHash}`);
          } else {
            console.warn(`File not found for image ID ${row.id} at ${row.filepath}`);
          }
        } catch (hashErr) {
          console.error(`Failed to calculate hash for image ID ${row.id}:`, hashErr);
        }
      }
      console.log('Finished recalculating hashes.');
    }

    // Backfill EXIF metadata.
    // We process in two passes:
    //   1) Images that have never been processed (exif_processed = 0).
    //   2) Images that were processed by an older EXIF reader (exif_processed = 1)
    //      but are missing the new extended camera/exposure fields added in 1.4.3.
    //      This second pass is idempotent and safe to run on every startup.
    const extendedExifColumns = [
      'camera_make', 'camera_model', 'lens_model',
      'fnumber', 'exposure_time', 'iso',
      'focal_length', 'focal_length_35mm',
      'flash', 'white_balance', 'software', 'artist'
    ];

    const missingExtendedExpr = extendedExifColumns.map(c => `${c} IS NULL`).join(' AND ');
    const rowsWithoutExif = db.prepare(
      `SELECT id, filepath FROM images WHERE exif_processed = 0 OR (exif_processed = 1 AND (${missingExtendedExpr}))`
    ).all();
    if (rowsWithoutExif.length > 0) {
      console.log(`Backfilling EXIF metadata for ${rowsWithoutExif.length} images...`);
      for (const row of rowsWithoutExif) {
        try {
          let captured_at = null;
          let gps_latitude = null;
          let gps_longitude = null;
          let camera_make = null;
          let camera_model = null;
          let lens_model = null;
          let fnumber = null;
          let exposure_time = null;
          let iso = null;
          let focal_length = null;
          let focal_length_35mm = null;
          let flash = null;
          let white_balance = null;
          let software = null;
          let artist = null;

          if (fs.existsSync(row.filepath)) {
            const parsedExif = await exifr.parse(row.filepath, {
              tiff: true, ifd0: true, exif: true, gps: true
            }).catch(() => null);
            if (parsedExif) {
              if (parsedExif.DateTimeOriginal) {
                captured_at = parsedExif.DateTimeOriginal instanceof Date
                  ? parsedExif.DateTimeOriginal.toISOString()
                  : new Date(parsedExif.DateTimeOriginal).toISOString();
              }
              if (parsedExif.latitude !== undefined && parsedExif.longitude !== undefined) {
                gps_latitude = parsedExif.latitude;
                gps_longitude = parsedExif.longitude;
              }
              if (parsedExif.Make)   camera_make  = String(parsedExif.Make).trim()  || null;
              if (parsedExif.Model)  camera_model = String(parsedExif.Model).trim() || null;
              if (parsedExif.LensModel) lens_model = String(parsedExif.LensModel).trim() || null;
              if (typeof parsedExif.FNumber === 'number')   fnumber = parsedExif.FNumber;
              if (typeof parsedExif.ExposureTime === 'number') exposure_time = parsedExif.ExposureTime;
              if (typeof parsedExif.ISO === 'number')       iso = parsedExif.ISO;
              if (typeof parsedExif.FocalLength === 'number') focal_length = parsedExif.FocalLength;
              if (typeof parsedExif.FocalLengthIn35mmFormat === 'number') focal_length_35mm = parsedExif.FocalLengthIn35mmFormat;
              if (parsedExif.Flash !== undefined && parsedExif.Flash !== null) flash = String(parsedExif.Flash);
              if (parsedExif.WhiteBalance !== undefined && parsedExif.WhiteBalance !== null) white_balance = String(parsedExif.WhiteBalance);
              if (parsedExif.Software) software = String(parsedExif.Software).trim() || null;
              if (parsedExif.Artist)   artist   = String(parsedExif.Artist).trim()   || null;
            }
          }

          if (!camera_make && !camera_model) {
            camera_make = 'Unknown';
            camera_model = 'Unknown';
          }

          db.prepare(`
            UPDATE images 
            SET captured_at = ?, gps_latitude = ?, gps_longitude = ?,
                camera_make = ?, camera_model = ?, lens_model = ?,
                fnumber = ?, exposure_time = ?, iso = ?,
                focal_length = ?, focal_length_35mm = ?,
                flash = ?, white_balance = ?, software = ?, artist = ?,
                exif_processed = 1 
            WHERE id = ?
          `).run(
            captured_at, gps_latitude, gps_longitude,
            camera_make, camera_model, lens_model,
            fnumber, exposure_time, iso,
            focal_length, focal_length_35mm,
            flash, white_balance, software, artist,
            row.id
          );

          console.log(`Processed EXIF for image ID ${row.id}: date=${captured_at}, cam=${camera_model}, iso=${iso}`);
        } catch (exifErr) {
          console.error(`Failed to backfill EXIF for image ID ${row.id}:`, exifErr);
          // Flag as processed to avoid looping endlessly on failure
          try {
            db.prepare("UPDATE images SET exif_processed = 1 WHERE id = ?").run(row.id);
          } catch (e) {}
        }
      }
      console.log('Finished backfilling EXIF metadata.');
    }

    console.log('Database schema checked/initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    throw err;
  }
};
