// ==========================================================================
// Application State
// ==========================================================================
const state = {
  currentUser: null,
  images: [],
  currentImage: null,
  activeView: 'gallery',
  selectedFiles: [],
  selectedImageIds: [],
  galleryFilter: 'all', // 'all' | 'enhanced' | 'unprocessed'
  gallerySearch: ''
};

// Default adjustment parameters (neutral values)
const DEFAULT_ADJUSTMENTS = {
  brightness: 0,
  contrast: 1.0,
  saturation: 1.0,
  sharpness: 0,
  denoise: false,
  upscale: true,
  rotate: 0,
  temperature: 1.0,
  tint: 1.0
};

// ==========================================================================
// Initialization & Session Check
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadAppVersion();
  checkSession();
  initDragAndDrop();
  initSliderDrag();
  fetchActiveModel();
});

// Check if user is logged in
async function checkSession() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.loggedIn) {
      state.currentUser = data.user;
      document.getElementById('user-display-name').textContent = data.user.username;
      navigateTo('gallery');
    } else {
      navigateTo('auth');
    }
  } catch (err) {
    console.error('Session check failed:', err);
    navigateTo('auth');
  }
}

// ==========================================================================
// Navigation & Routing
// ==========================================================================
function navigateTo(view) {
  state.activeView = view;
  
  // Hide all views & panels
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (view === 'auth') {
    document.getElementById('auth-view').classList.remove('hidden');
  } else {
    document.getElementById('dashboard-view').classList.remove('hidden');
    
    if (view === 'gallery') {
      document.getElementById('panel-gallery').classList.add('active');
      document.getElementById('nav-gallery').classList.add('active');
      loadImages();
    } else if (view === 'upload') {
      document.getElementById('panel-upload').classList.add('active');
      document.getElementById('nav-upload').classList.add('active');
      resetUploadZone();
    } else if (view === 'workspace') {
      document.getElementById('panel-workspace').classList.add('active');
    }
  }
}

function switchAuthTab(tab) {
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('tab-login-btn').classList.remove('active');
  document.getElementById('tab-register-btn').classList.remove('active');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');

  if (tab === 'login') {
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('login-form').classList.remove('hidden');
  } else {
    document.getElementById('tab-register-btn').classList.add('active');
    document.getElementById('register-form').classList.remove('hidden');
  }
}

// ==========================================================================
// User Authentication Handlers
// ==========================================================================
async function handleAuth(event, type) {
  event.preventDefault();
  const errorEl = document.getElementById('auth-error');
  errorEl.classList.add('hidden');
  
  const username = document.getElementById(`${type}-username`).value;
  const password = document.getElementById(`${type}-password`).value;

  const submitBtn = document.getElementById(`${type}-submit-btn`);
  const origBtnHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

  try {
    const endpoint = type === 'login' ? '/api/login' : '/api/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ocurrió un error inesperado.');
    }

    state.currentUser = data.user;
    document.getElementById('user-display-name').textContent = data.user.username;
    
    // Clear forms
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();

    showToast(`¡Bienvenido, ${data.user.username}!`, 'success');
    navigateTo('gallery');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origBtnHTML;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    state.currentUser = null;
    showToast('Sesión cerrada correctamente.', 'success');
    navigateTo('auth');
  } catch (err) {
    console.error('Logout failed:', err);
    showToast('Error al cerrar sesión.', 'error');
  }
}

// ==========================================================================
// Gallery Panel Handlers
// ==========================================================================
async function loadImages() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  
  grid.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>Cargando imágenes...</p></div>';
  empty.classList.add('hidden');

  try {
    const res = await fetch('/api/images');
    if (!res.ok) throw new Error('Error al obtener la lista de imágenes.');
    const images = await res.json();
    state.images = images;
    
    // Clear selection of items that might not exist anymore
    state.selectedImageIds = state.selectedImageIds.filter(id => images.some(img => img.id === id));
    
    renderGallery();
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</div>`;
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  
  if (state.images.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    updateBulkActionsToolbar();
    return;
  }

  // Filter images
  const filtered = state.images.filter(img => {
    // 1. Status Filter
    if (state.galleryFilter === 'enhanced' && img.status !== 'enhanced') {
      return false;
    }
    if (state.galleryFilter === 'unprocessed' && img.status === 'enhanced') {
      return false;
    }

    // 2. Search Text
    if (state.gallerySearch.trim() !== '') {
      const q = state.gallerySearch.toLowerCase().trim();
      const nameMatch = img.original_name.toLowerCase().includes(q);
      
      let analysisMatch = false;
      if (img.ai_analysis) {
        const desc = (img.ai_analysis.description || '').toLowerCase();
        const explanation = (img.ai_analysis.explanation || '').toLowerCase();
        const flaws = Array.isArray(img.ai_analysis.flaws) 
          ? img.ai_analysis.flaws.join(' ').toLowerCase() 
          : '';
        
        analysisMatch = desc.includes(q) || explanation.includes(q) || flaws.includes(q);
      }
      
      return nameMatch || analysisMatch;
    }

    return true;
  });

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="spinner-container"><p>No se encontraron imágenes que coincidan con los criterios de búsqueda.</p></div>';
    empty.classList.add('hidden');
    updateBulkActionsToolbar();
    return;
  }

  empty.classList.add('hidden');

  filtered.forEach(img => {
    const card = document.createElement('div');
    const isSelected = state.selectedImageIds.includes(img.id);
    card.className = `image-card${isSelected ? ' selected' : ''}`;
    card.dataset.id = img.id;
    
    const badgeClass = `badge-${img.status}`;
    const statusLabel = img.status === 'uploaded' ? 'Subido' : (img.status === 'analyzed' ? 'Analizado' : 'Mejorado');
    
    // Determine what path to show in card preview (enhanced preferred)
    const previewUrl = img.status === 'enhanced' ? img.enhanced_url : img.original_url;
    const displaySize = formatBytes(img.status === 'enhanced' && img.enhanced_size ? img.enhanced_size : img.size);
    const displayRes = img.status === 'enhanced' && img.enhanced_width ? `${img.enhanced_width}x${img.enhanced_height}` : `${img.width}x${img.height}`;

    card.innerHTML = `
      <!-- Card Selection Checkbox -->
      <div class="card-select-container" onclick="event.stopPropagation();">
        <input type="checkbox" id="chk-img-${img.id}" class="card-checkbox" ${isSelected ? 'checked' : ''} onchange="handleImageSelect(${img.id}, this.checked)">
        <label for="chk-img-${img.id}" class="card-checkbox-label"></label>
      </div>

      <div class="card-preview">
        <img src="${previewUrl}" alt="${img.original_name}" loading="lazy">
        <span class="badge ${badgeClass} card-badge">${statusLabel}</span>
        <div class="card-overlay">
          <button class="card-btn card-btn-view" onclick="openWorkspace(${img.id})" title="Abrir mesa de trabajo"><i class="fa-solid fa-laptop-code"></i></button>
          <button class="card-btn card-btn-delete" onclick="deleteImage(${img.id}, event)" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
      <div class="card-info">
        <h4>${img.original_name}</h4>
        <div class="card-meta">
          <span>${displayRes}</span>
          <span>${displaySize}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  updateBulkActionsToolbar();

  // Restore scroll position if returning from workspace
  if (state.lastScrollTop !== undefined && state.lastScrollTop !== null) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = state.lastScrollTop;
    }
    state.lastScrollTop = null;
  }
}

async function deleteImage(id, event) {
  event.stopPropagation();
  if (!confirm('¿Estás seguro de que quieres eliminar esta imagen y todas sus optimizaciones?')) return;

  try {
    const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Remove from selection if deleted
    state.selectedImageIds = state.selectedImageIds.filter(x => x !== id);

    showToast('Imagen eliminada correctamente.', 'success');
    loadImages();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// Search & Filter Event Handlers
// ==========================================================================
function handleSearch(value) {
  state.gallerySearch = value;
  
  const clearBtn = document.getElementById('search-clear-btn');
  if (value.trim() !== '') {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }
  
  renderGallery();
}

function clearSearch() {
  const searchInput = document.getElementById('gallery-search');
  searchInput.value = '';
  state.gallerySearch = '';
  document.getElementById('search-clear-btn').classList.add('hidden');
  renderGallery();
}

function setGalleryFilter(filterType) {
  state.galleryFilter = filterType;
  
  // Update active buttons class
  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (filterType === 'all') {
    document.getElementById('filter-btn-all').classList.add('active');
  } else if (filterType === 'enhanced') {
    document.getElementById('filter-btn-enhanced').classList.add('active');
  } else if (filterType === 'unprocessed') {
    document.getElementById('filter-btn-unprocessed').classList.add('active');
  }
  
  renderGallery();
}

// ==========================================================================
// Card Checkboxes & Bulk Operations Management
// ==========================================================================
function handleImageSelect(id, isChecked) {
  if (isChecked) {
    if (!state.selectedImageIds.includes(id)) {
      state.selectedImageIds.push(id);
    }
    const card = document.querySelector(`.image-card[data-id="${id}"]`);
    if (card) card.classList.add('selected');
  } else {
    state.selectedImageIds = state.selectedImageIds.filter(x => x !== id);
    const card = document.querySelector(`.image-card[data-id="${id}"]`);
    if (card) card.classList.remove('selected');
  }
  
  updateBulkActionsToolbar();
}

function updateBulkActionsToolbar() {
  const toolbar = document.getElementById('bulk-actions-toolbar');
  const countLabel = document.getElementById('selected-count-label');
  const selectAllBtn = document.getElementById('bulk-select-all-btn');
  
  if (state.selectedImageIds.length > 0) {
    toolbar.classList.remove('hidden');
    countLabel.textContent = `${state.selectedImageIds.length} seleccionada${state.selectedImageIds.length > 1 ? 's' : ''}`;
    
    // Get visible images
    const visibleImages = state.images.filter(img => {
      if (state.galleryFilter === 'enhanced' && img.status !== 'enhanced') return false;
      if (state.galleryFilter === 'unprocessed' && img.status === 'enhanced') return false;
      if (state.gallerySearch.trim() !== '') {
        const q = state.gallerySearch.toLowerCase().trim();
        const nameMatch = img.original_name.toLowerCase().includes(q);
        let analysisMatch = false;
        if (img.ai_analysis) {
          const desc = (img.ai_analysis.description || '').toLowerCase();
          const explanation = (img.ai_analysis.explanation || '').toLowerCase();
          const flaws = Array.isArray(img.ai_analysis.flaws) ? img.ai_analysis.flaws.join(' ').toLowerCase() : '';
          analysisMatch = desc.includes(q) || explanation.includes(q) || flaws.includes(q);
        }
        return nameMatch || analysisMatch;
      }
      return true;
    });
    
    const visibleIds = visibleImages.map(img => img.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => state.selectedImageIds.includes(id));
    
    if (allVisibleSelected) {
      selectAllBtn.innerHTML = '<i class="fa-solid fa-square-minus"></i> Deseleccionar todas';
    } else {
      selectAllBtn.innerHTML = '<i class="fa-solid fa-square-check"></i> Seleccionar todas';
    }
  } else {
    toolbar.classList.add('hidden');
  }
}

function clearSelectedImages() {
  state.selectedImageIds = [];
  renderGallery();
}

function toggleSelectAllImages() {
  const visibleImages = state.images.filter(img => {
    if (state.galleryFilter === 'enhanced' && img.status !== 'enhanced') return false;
    if (state.galleryFilter === 'unprocessed' && img.status === 'enhanced') return false;
    if (state.gallerySearch.trim() !== '') {
      const q = state.gallerySearch.toLowerCase().trim();
      const nameMatch = img.original_name.toLowerCase().includes(q);
      let analysisMatch = false;
      if (img.ai_analysis) {
        const desc = (img.ai_analysis.description || '').toLowerCase();
        const explanation = (img.ai_analysis.explanation || '').toLowerCase();
        const flaws = Array.isArray(img.ai_analysis.flaws) ? img.ai_analysis.flaws.join(' ').toLowerCase() : '';
        analysisMatch = desc.includes(q) || explanation.includes(q) || flaws.includes(q);
      }
      return nameMatch || analysisMatch;
    }
    return true;
  });

  const visibleIds = visibleImages.map(img => img.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => state.selectedImageIds.includes(id));

  if (allVisibleSelected) {
    state.selectedImageIds = state.selectedImageIds.filter(id => !visibleIds.includes(id));
  } else {
    visibleIds.forEach(id => {
      if (!state.selectedImageIds.includes(id)) {
        state.selectedImageIds.push(id);
      }
    });
  }

  renderGallery();
}

// Progress Overlays
function showProgressOverlay(title, subtitle, percent = 0) {
  document.getElementById('progress-title').textContent = title;
  document.getElementById('progress-subtitle').textContent = subtitle;
  document.getElementById('progress-bar-fill').style.width = `${percent}%`;
  document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
  document.getElementById('progress-overlay').classList.remove('hidden');
}

function updateProgress(subtitle, percent) {
  document.getElementById('progress-subtitle').textContent = subtitle;
  document.getElementById('progress-bar-fill').style.width = `${percent}%`;
  document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
}

function hideProgressOverlay() {
  document.getElementById('progress-overlay').classList.add('hidden');
}

// Sequential processing for batch operations
async function startBulkAnalysis() {
  const ids = [...state.selectedImageIds];
  if (ids.length === 0) return;

  const total = ids.length;
  showProgressOverlay('Analizando imágenes con IA', `Preparando... (0/${total})`, 0);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const id = ids[i];
    const image = state.images.find(img => img.id === id);
    const name = image ? image.original_name : `Imagen #${id}`;
    
    updateProgress(`Analizando (${i + 1}/${total}): ${name}`, (i / total) * 100);

    try {
      const payload = selectedAIModel ? { model: selectedAIModel } : {};
      const res = await fetch(`/api/images/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error desconocido.');
      }
      
      successCount++;
    } catch (err) {
      console.error(`Error al analizar imagen #${id}:`, err);
      failCount++;
    }
  }

  updateProgress('Completado', 100);
  
  setTimeout(async () => {
    hideProgressOverlay();
    state.selectedImageIds = [];
    showToast(`Análisis por lote completo. Éxitos: ${successCount}. Fallos: ${failCount}.`, successCount > 0 ? 'success' : 'error');
    await loadImages();
  }, 1000);
}

async function startBulkOptimization() {
  const ids = [...state.selectedImageIds];
  if (ids.length === 0) return;

  // Only optimize images that already have AI analysis
  const analyzableIds = [];
  const skippedIds = [];

  for (const id of ids) {
    const image = state.images.find(img => img.id === id);
    if (image && image.ai_analysis && image.ai_analysis.adjustments) {
      analyzableIds.push(id);
    } else {
      skippedIds.push(image ? image.original_name : `Imagen #${id}`);
    }
  }

  if (analyzableIds.length === 0) {
    showToast('Ninguna imagen seleccionada tiene un análisis de IA previo. Analiza primero.', 'error');
    return;
  }

  const total = analyzableIds.length;
  showProgressOverlay('Optimizando imágenes con Sharp', `Preparando... (0/${total})`, 0);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const id = analyzableIds[i];
    const image = state.images.find(img => img.id === id);
    const name = image ? image.original_name : `Imagen #${id}`;

    updateProgress(`Optimizando (${i + 1}/${total}): ${name}`, (i / total) * 100);

    try {
      const res = await fetch(`/api/images/${id}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error desconocido.');
      }

      successCount++;
    } catch (err) {
      console.error(`Error al optimizar imagen #${id}:`, err);
      failCount++;
    }
  }

  updateProgress('Completado', 100);

  setTimeout(async () => {
    hideProgressOverlay();
    state.selectedImageIds = [];
    const skippedMsg = skippedIds.length > 0
      ? ` ${skippedIds.length} imagen(es) omitidas por no tener análisis previo.`
      : '';
    const type = successCount > 0 ? 'success' : 'error';
    showToast(`Optimización por lote completa. Éxitos: ${successCount}. Fallos: ${failCount}.${skippedMsg}`, type);
    await loadImages();
  }, 1000);
}

// ==========================================================================
// Upload Panel Handlers
// ==========================================================================
function initDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragging');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragging');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processSelectedFiles(files);
    }
  });
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (files.length > 0) {
    processSelectedFiles(files);
  }
}

function processSelectedFiles(files) {
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  
  if (imageFiles.length === 0) {
    showToast('Los archivos seleccionados deben ser imágenes.', 'error');
    return;
  }

  state.selectedFiles = imageFiles;
  
  // Show file preview details
  const fileCount = imageFiles.length;
  if (fileCount === 1) {
    const file = imageFiles[0];
    document.getElementById('upload-filename').textContent = file.name;
    document.getElementById('upload-filesize').textContent = formatBytes(file.size);
    document.getElementById('upload-btn-text').textContent = 'Subir Imagen';
  } else {
    const totalSize = imageFiles.reduce((acc, f) => acc + f.size, 0);
    document.getElementById('upload-filename').textContent = `${fileCount} imágenes seleccionadas`;
    document.getElementById('upload-filesize').textContent = formatBytes(totalSize);
    document.getElementById('upload-btn-text').textContent = `Subir ${fileCount} Imágenes`;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('upload-thumbnail').src = e.target.result;
    document.getElementById('upload-status-card').classList.remove('hidden');
  };
  reader.readAsDataURL(imageFiles[0]);
}

function resetUploadZone() {
  state.selectedFiles = [];
  document.getElementById('file-input').value = '';
  document.getElementById('upload-status-card').classList.add('hidden');
  document.getElementById('upload-thumbnail').src = '';
}

async function performUpload() {
  if (!state.selectedFiles || state.selectedFiles.length === 0) return;

  const btn = document.getElementById('start-upload-btn');
  const txt = document.getElementById('upload-btn-text');
  btn.disabled = true;
  txt.textContent = 'Subiendo...';

  const formData = new FormData();
  state.selectedFiles.forEach(file => {
    formData.append('image', file);
  });

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const count = state.selectedFiles.length;
    showToast(count === 1 ? 'Imagen subida correctamente.' : `${count} imágenes subidas correctamente.`, 'success');
    navigateTo('gallery');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    txt.textContent = state.selectedFiles.length === 1 ? 'Subir Imagen' : `Subir ${state.selectedFiles.length} Imágenes`;
  }
}

// ==========================================================================
// Workspace Panel (Compare, AI & Edit) Handlers
// ==========================================================================
function openWorkspace(imageId) {
  const image = state.images.find(img => img.id === imageId);
  if (!image) return;

  // Save current scroll position of the gallery
  const mainContent = document.querySelector('.main-content');
  state.lastScrollTop = mainContent ? mainContent.scrollTop : 0;

  state.currentImage = image;
  document.getElementById('workspace-title').textContent = `Optimizando: ${image.original_name}`;
  
  // Prepare canvases
  document.getElementById('img-original').src = image.original_url;
  document.getElementById('img-single').src = image.original_url;

  // Adjust comparison container to match image aspect ratio and viewport
  fitComparisonCardToImage(image);

  // Setup layout depending on status
  if (image.status === 'enhanced') {
    document.getElementById('img-enhanced').src = image.enhanced_url;
    document.getElementById('image-slider-wrapper').classList.add('active');
    document.getElementById('single-image-wrapper').classList.add('hidden');
    document.getElementById('btn-dl-enhanced').classList.remove('hidden');
    document.getElementById('btn-dl-enhanced').href = image.enhanced_url;
    document.getElementById('btn-copy-enhanced').classList.remove('hidden');

    // Reset Slider bar positions to center
    resetSliderHandle();
  } else {
    document.getElementById('image-slider-wrapper').classList.remove('active');
    document.getElementById('single-image-wrapper').classList.remove('hidden');
    document.getElementById('btn-dl-enhanced').classList.add('hidden');
    document.getElementById('btn-copy-enhanced').classList.add('hidden');
  }

  document.getElementById('btn-dl-original').href = image.original_url;

  // Setup metadata
  document.getElementById('meta-orig-res').textContent = `${image.width}x${image.height}`;
  document.getElementById('meta-orig-size').textContent = formatBytes(image.size);
  if (image.status === 'enhanced' && image.enhanced_width) {
    document.getElementById('meta-enh-row').classList.remove('hidden');
    document.getElementById('meta-enh-res').textContent = `${image.enhanced_width}x${image.enhanced_height}`;
    document.getElementById('meta-enh-size').textContent = formatBytes(image.enhanced_size);
  } else {
    document.getElementById('meta-enh-row').classList.add('hidden');
  }
  document.getElementById('meta-card').classList.remove('hidden');

  // Load AI details
  renderAIAnalysis(image.ai_analysis);

  // Setup parameter sliders to either stored AI recommendations or neutral defaults
  let params = { ...DEFAULT_ADJUSTMENTS };
  if (image.ai_analysis && image.ai_analysis.adjustments) {
    params = { ...params, ...image.ai_analysis.adjustments };
  }
  setSlidersValues(params);

  navigateTo('workspace');
}

function renderAIAnalysis(analysis) {
  const pending = document.getElementById('ai-state-pending');
  const loading = document.getElementById('ai-state-loading');
  const completed = document.getElementById('ai-state-completed');

  pending.classList.add('hidden');
  loading.classList.add('hidden');
  completed.classList.add('hidden');

  if (!analysis) {
    pending.classList.remove('hidden');
  } else {
    completed.classList.remove('hidden');
    document.getElementById('ai-report-description').textContent = analysis.description;
    
    const flawsList = document.getElementById('ai-report-flaws');
    flawsList.innerHTML = '';
    
    if (analysis.flaws && analysis.flaws.length > 0) {
      analysis.flaws.forEach(flaw => {
        const li = document.createElement('li');
        li.textContent = flaw;
        flawsList.appendChild(li);
      });
    } else {
      flawsList.innerHTML = '<li>Ninguno detectado de gravedad.</li>';
    }

    document.getElementById('ai-report-explanation').textContent = `"${analysis.explanation}"`;
  }
}

async function analyzeWithAI() {
  if (!state.currentImage) return;

  const pending = document.getElementById('ai-state-pending');
  const loading = document.getElementById('ai-state-loading');
  const completed = document.getElementById('ai-state-completed');

  pending.classList.add('hidden');
  completed.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const payload = selectedAIModel ? { model: selectedAIModel } : {};
    const res = await fetch(`/api/images/${state.currentImage.id}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.currentImage.status = data.status;
    state.currentImage.ai_analysis = data.ai_analysis;
    
    // Update local state copy in state.images
    const cachedIdx = state.images.findIndex(img => img.id === state.currentImage.id);
    if (cachedIdx !== -1) {
      state.images[cachedIdx].status = data.status;
      state.images[cachedIdx].ai_analysis = data.ai_analysis;
    }

    renderAIAnalysis(data.ai_analysis);
    
    // Auto populate sliders with recommendations
    if (data.ai_analysis && data.ai_analysis.adjustments) {
      setSlidersValues(data.ai_analysis.adjustments);
      showToast('IA completada. Recomendaciones cargadas en los controles.', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
    renderAIAnalysis(state.currentImage.ai_analysis);
  }
}

async function enhanceImage() {
  if (!state.currentImage) return;

  const btn = document.getElementById('enhance-btn');
  const loader = document.getElementById('enhance-loading');
  btn.classList.add('hidden');
  loader.classList.remove('hidden');

  // Collect slider adjustments
  const payload = {
    brightness: parseFloat(document.getElementById('slider-brightness').value),
    contrast: parseFloat(document.getElementById('slider-contrast').value),
    saturation: parseFloat(document.getElementById('slider-saturation').value),
    sharpness: parseFloat(document.getElementById('slider-sharpness').value),
    denoise: document.getElementById('check-denoise').checked,
    upscale: document.getElementById('check-upscale').checked,
    rotate: parseInt(document.getElementById('select-rotate').value),
    temperature: parseFloat(document.getElementById('slider-temperature').value),
    tint: parseFloat(document.getElementById('slider-tint').value)
  };

  try {
    const res = await fetch(`/api/images/${state.currentImage.id}/enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.currentImage.status = data.image.status;
    state.currentImage.enhanced_url = data.image.enhanced_url;
    state.currentImage.enhanced_width = data.image.enhanced_width;
    state.currentImage.enhanced_height = data.image.enhanced_height;
    state.currentImage.enhanced_size = data.image.enhanced_size;

    // Update global list cache
    const cachedIdx = state.images.findIndex(img => img.id === state.currentImage.id);
    if (cachedIdx !== -1) {
      state.images[cachedIdx] = { ...state.images[cachedIdx], ...data.image };
    }

    // Refresh Canvas Slider
    document.getElementById('img-enhanced').src = data.image.enhanced_url;
    document.getElementById('image-slider-wrapper').classList.add('active');
    document.getElementById('single-image-wrapper').classList.add('hidden');

    // Re-fit comparison card to the enhanced image dimensions
    fitComparisonCardToImage(state.currentImage);

    // Update Details
    document.getElementById('meta-enh-row').classList.remove('hidden');
    document.getElementById('meta-enh-res').textContent = `${data.image.enhanced_width}x${data.image.enhanced_height}`;
    document.getElementById('meta-enh-size').textContent = formatBytes(data.image.enhanced_size);
    document.getElementById('btn-dl-enhanced').classList.remove('hidden');
    document.getElementById('btn-dl-enhanced').href = data.image.enhanced_url;
    document.getElementById('btn-copy-enhanced').classList.remove('hidden');

    resetSliderHandle();
    showToast('Imagen mejorada correctamente.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.classList.remove('hidden');
    loader.classList.add('hidden');
  }
}

// Slider element setters
function setSlidersValues(adjustments) {
  const defaults = { ...DEFAULT_ADJUSTMENTS, ...adjustments };

  document.getElementById('slider-brightness').value = defaults.brightness;
  updateSliderVal('brightness', defaults.brightness);

  document.getElementById('slider-contrast').value = defaults.contrast;
  updateSliderVal('contrast', defaults.contrast);

  document.getElementById('slider-saturation').value = defaults.saturation;
  updateSliderVal('saturation', defaults.saturation);

  document.getElementById('slider-sharpness').value = defaults.sharpness;
  updateSliderVal('sharpness', defaults.sharpness);

  document.getElementById('slider-temperature').value = defaults.temperature;
  updateSliderVal('temperature', defaults.temperature);

  document.getElementById('slider-tint').value = defaults.tint;
  updateSliderVal('tint', defaults.tint);

  document.getElementById('check-denoise').checked = !!defaults.denoise;
  document.getElementById('check-upscale').checked = !!defaults.upscale;
  document.getElementById('select-rotate').value = defaults.rotate !== undefined ? defaults.rotate : 0;
}

function updateSliderVal(param, val) {
  const formattedVal = parseFloat(val).toFixed(2);
  document.getElementById(`val-${param}`).textContent = formattedVal;
}

// Before/After comparison slider handle dragging mechanics
function initSliderDrag() {
  const handle = document.getElementById('slider-handle');
  const wrapper = document.getElementById('image-slider-wrapper');
  const afterContainer = document.getElementById('image-after-container');

  if (!handle || !wrapper || !afterContainer) return;

  let isDragging = false;

  const onDrag = (e) => {
    if (!isDragging) return;
    const rect = wrapper.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (clientX === undefined) return;
    
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    const percentage = (x / rect.width) * 100;
    handle.style.left = `${percentage}%`;
    
    // We override width structure for top layer using modern CSS clip-path to prevent distortion!
    afterContainer.style.width = '100%';
    afterContainer.style.clipPath = `inset(0 0 0 ${percentage}%)`;
  };

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', onDrag);

  // Touch Support
  handle.addEventListener('touchstart', (e) => {
    isDragging = true;
  });
  window.addEventListener('touchend', () => isDragging = false);
  window.addEventListener('touchmove', onDrag);
}

function resetSliderHandle() {
  const handle = document.getElementById('slider-handle');
  const afterContainer = document.getElementById('image-after-container');
  if (handle && afterContainer) {
    handle.style.left = '50%';
    afterContainer.style.width = '100%';
    afterContainer.style.clipPath = 'inset(0 0 0 50%)';
  }
}

/**
 * Sizes the comparison card to best fit the viewport while preserving the
 * image's native aspect ratio. This avoids huge black bars for vertical photos.
 */
function fitComparisonCardToImage(image) {
  const card = document.querySelector('.comparison-card');
  if (!card || !image.width || !image.height) return;

  // Use the image's natural aspect ratio so the container matches its shape
  const aspectRatio = image.width / image.height;
  card.style.aspectRatio = `${aspectRatio}`;

  // For vertical images we want to use more height; cap very narrow ratios
  // so the card never becomes a skyscraper taller than the viewport.
  const MAX_VERTICAL_RATIO = 0.55; // ~9:16
  if (aspectRatio < MAX_VERTICAL_RATIO) {
    card.style.aspectRatio = `${MAX_VERTICAL_RATIO}`;
  }

  // Once the actual image loads, fine-tune if the displayed image differs
  // (e.g. after EXIF rotation or enhancement changes dimensions)
  const displayedImg = document.getElementById('img-single');
  const tune = () => {
    if (displayedImg.naturalWidth && displayedImg.naturalHeight) {
      const liveRatio = displayedImg.naturalWidth / displayedImg.naturalHeight;
      const finalRatio = Math.max(liveRatio, MAX_VERTICAL_RATIO);
      card.style.aspectRatio = `${finalRatio}`;
    }
  };
  displayedImg.onload = tune;
  if (displayedImg.complete) tune();
}

// ==========================================================================
// Helper Utility Functions
// ==========================================================================
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Toast alerts
let toastTimeout = null;
function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-message');
  const icon = toast.querySelector('.toast-icon');

  toast.className = `toast ${type}`;
  text.textContent = message;

  // Set appropriate icons
  icon.className = 'fa-solid toast-icon';
  if (type === 'success') {
    icon.classList.add('fa-circle-check');
  } else if (type === 'error') {
    icon.classList.add('fa-circle-exclamation');
  } else {
    icon.classList.add('fa-circle-info');
  }

  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

let activeModelName = 'Llama 3.2 Vision';
let selectedAIModel = null;

async function loadAppVersion() {
  try {
    const res = await fetch('/api/info/version');
    if (!res.ok) return;
    const data = await res.json();
    const versionEl = document.getElementById('brand-version');
    if (versionEl && data.version) {
      versionEl.textContent = `v${data.version}`;
    }
  } catch (err) {
    console.error('Failed to load app version:', err);
  }
}

async function fetchActiveModel() {
  try {
    const res = await fetch('/api/info/model');
    if (res.ok) {
      const data = await res.json();
      const savedModel = localStorage.getItem('pigmalea_selected_model');
      let activeModel = data.model;

      if (data.models && data.models.length > 0) {
        // Verify that the saved model is still installed and available
        if (savedModel && data.models.includes(savedModel)) {
          activeModel = savedModel;
        }
      }

      if (activeModel) {
        activeModelName = formatModelName(activeModel);
        selectedAIModel = activeModel;
        updateModelNameElements();
      }

      if (data.models && data.models.length > 0) {
        const select = document.getElementById('ai-model-select');
        select.innerHTML = '';
        data.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = formatModelName(m) + ` (${m})`;
          if (m === selectedAIModel) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });

        // Show selection container if multiple models are available
        if (data.models.length > 1) {
          document.getElementById('model-select-wrapper').classList.remove('hidden');
        } else {
          document.getElementById('model-select-wrapper').classList.add('hidden');
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch active model:', err);
  }
}

function onModelSelectChange(val) {
  selectedAIModel = val;
  activeModelName = formatModelName(val);
  updateModelNameElements();
  localStorage.setItem('pigmalea_selected_model', val);
}

function formatModelName(modelId) {
  if (!modelId) return 'IA';
  const baseName = modelId.split(':')[0];
  
  if (baseName.toLowerCase().startsWith('llama3.2-vision')) {
    return 'Llama 3.2 Vision';
  }
  if (baseName.toLowerCase().startsWith('llava')) {
    return 'Llava';
  }
  if (baseName.toLowerCase().startsWith('bakllava')) {
    return 'Bakllava';
  }
  
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

function updateModelNameElements() {
  document.querySelectorAll('.ai-model-name').forEach(el => {
    el.textContent = activeModelName;
  });
}

// ==========================================================================
// Copy to Clipboard Operations
// ==========================================================================
async function copyOriginalImage() {
  if (!state.currentImage) return;
  await copyImageToClipboard(state.currentImage.original_url);
}

async function copyEnhancedImage() {
  if (!state.currentImage || !state.currentImage.enhanced_url) return;
  await copyImageToClipboard(state.currentImage.enhanced_url);
}

async function copyImageToClipboard(imageUrl) {
  try {
    showToast('Copiando imagen...', 'info');
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Create image element in memory
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    // Draw on Canvas to convert any format to PNG (standard clipboard format)
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    canvas.toBlob(async (pngBlob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': pngBlob
          })
        ]);
        showToast('¡Imagen copiada al portapapeles!', 'success');
      } catch (clipboardErr) {
        console.error('Clipboard write failed:', clipboardErr);
        showToast('Error al copiar imagen al portapapeles.', 'error');
      } finally {
        URL.revokeObjectURL(img.src);
      }
    }, 'image/png');
    
  } catch (err) {
    console.error('Failed to copy image:', err);
    showToast('Error al procesar la imagen para copiar.', 'error');
  }
}

