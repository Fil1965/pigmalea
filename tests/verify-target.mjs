import Database from 'better-sqlite3';
const db = new Database('pigmalea.db', { readonly: true });
const r = db.prepare("SELECT id, original_name, status, captured_at, camera_make, camera_model, lens_model, fnumber, exposure_time, iso, focal_length, focal_length_35mm, flash, software FROM images WHERE original_name LIKE ?").get('%IMG_20260618_212320138%');
if (!r) {
  console.log('No encontrada');
} else {
  console.log('id', r.id, '|', r.original_name, '|', r.status);
  console.log('  date:', r.captured_at);
  console.log('  camera:', r.camera_make, '|', r.camera_model);
  console.log('  lens:', r.lens_model);
  console.log('  f-number:', r.fnumber, '| exposure_time:', r.exposure_time, '| ISO:', r.iso);
  console.log('  focal:', r.focal_length, 'mm (35mm:', r.focal_length_35mm, ')');
  console.log('  flash:', r.flash, '| software:', r.software);
}
db.close();
