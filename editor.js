const MAX_FREE_DAILY = 10;
const MAX_IMAGES_FREE = 20;
const MAX_IMAGES_PRO = 100;
const VALID_POSITIONS = [
  'top-left','top-center','top-right',
  'middle-left','center','middle-right',
  'bottom-left','bottom-center','bottom-right',
  'tiled'
];
const VALID_FONTS = [
  'Arial','Georgia','Times New Roman','Courier New',
  'Verdana','Impact','Trebuchet MS'
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let images = [];
let selectedIndex = -1;
let isPaid = false;
let logoImg = null;
let logoDataUrl = null;
let extpay;

try {
  extpay = ExtPay('watermark-express');
} catch (_) {}

async function init() {
  await loadPaidStatus();
  updatePlanUI();
  await updateDailyLimitUI();
  await loadTemplateList();
  bindEvents();
}

async function loadPaidStatus() {
  const { isPaid: paid } = await chrome.storage.local.get('isPaid');
  if (paid) { isPaid = true; return; }
  try {
    if (extpay) {
      const user = await extpay.getUser();
      if (user.paid) {
        isPaid = true;
        chrome.storage.local.set({ isPaid: true });
      }
    }
  } catch (_) {}
}

async function verifyPaidOnAction() {
  if (isPaid) return true;
  try {
    if (extpay) {
      const user = await extpay.getUser();
      if (user.paid) {
        isPaid = true;
        chrome.storage.local.set({ isPaid: true });
        updatePlanUI();
        return true;
      }
    }
  } catch (_) {}
  return false;
}

function updatePlanUI() {
  const badge = $('#plan-badge');
  const headerUpgrade = $('#btn-upgrade-header');
  const proTags = $$('.pro-tag');
  if (isPaid) {
    badge.textContent = 'PRO';
    badge.className = 'badge badge-pro';
    headerUpgrade.hidden = true;
    proTags.forEach(t => t.hidden = true);
    $('#daily-limit-info').hidden = true;
    const allLabel = document.querySelector('#btn-download-all .btn-text');
    if (allLabel) allLabel.textContent = 'Download All as ZIP';
  } else {
    badge.textContent = 'FREE';
    badge.className = 'badge badge-free';
    headerUpgrade.hidden = false;
    proTags.forEach(t => t.hidden = false);
  }
}

async function getDailyUsage() {
  const { dailyUsage } = await chrome.storage.local.get('dailyUsage');
  const today = new Date().toISOString().split('T')[0];
  if (!dailyUsage || dailyUsage.date !== today) return 0;
  return dailyUsage.count;
}

async function incrementUsage(count) {
  const today = new Date().toISOString().split('T')[0];
  const current = await getDailyUsage();
  await chrome.storage.local.set({
    dailyUsage: { date: today, count: current + count }
  });
  await updateDailyLimitUI();
}

async function updateDailyLimitUI() {
  if (isPaid) return;
  const used = await getDailyUsage();
  const remaining = Math.max(0, MAX_FREE_DAILY - used);
  $('#limit-text').textContent = `${remaining} of ${MAX_FREE_DAILY} free downloads remaining today`;
  const allLabel = document.querySelector('#btn-download-all .btn-text');
  if (allLabel) {
    allLabel.textContent = remaining > 0
      ? `Download All — ${remaining} left today`
      : 'Daily limit reached';
  }
}

// --- Toast ---

let toastTimer = null;
function showToast(message, type) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = 'toast toast-' + (type || 'info');
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2500);
}

// --- Events ---

function bindEvents() {
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const previewArea = $('#preview-area');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  previewArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    previewArea.classList.add('drag-over');
  });
  previewArea.addEventListener('dragleave', () => previewArea.classList.remove('drag-over'));
  previewArea.addEventListener('drop', (e) => {
    e.preventDefault();
    previewArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  $('#wm-text').addEventListener('input', renderPreview);
  $('#wm-font').addEventListener('change', renderPreview);
  $('#wm-color').addEventListener('input', (e) => {
    $('#wm-color-hex').textContent = e.target.value;
    renderPreview();
  });
  $('#wm-size').addEventListener('input', (e) => {
    $('#wm-size-val').textContent = e.target.value + '%';
    renderPreview();
  });
  $('#wm-opacity').addEventListener('input', (e) => {
    $('#wm-opacity-val').textContent = e.target.value + '%';
    renderPreview();
  });
  $('#wm-quality').addEventListener('input', (e) => {
    $('#wm-quality-val').textContent = e.target.value + '%';
  });
  $('#logo-size').addEventListener('input', (e) => {
    $('#logo-size-val').textContent = e.target.value + '%';
    renderPreview();
  });

  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'logo' && !isPaid) {
        showUpgradeModal();
        return;
      }
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#text-settings').hidden = type !== 'text';
      $('#logo-settings').hidden = type !== 'logo';
      if (type === 'logo' && !logoImg) {
        $('#logo-warning').hidden = false;
      } else {
        $('#logo-warning').hidden = true;
      }
      renderPreview();
    });
  });

  $$('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.pos-btn').forEach(b => b.classList.remove('active'));
      $('#btn-tiled').classList.remove('active');
      btn.classList.add('active');
      renderPreview();
    });
  });
  $('#btn-tiled').addEventListener('click', () => {
    $$('.pos-btn').forEach(b => b.classList.remove('active'));
    $('#btn-tiled').classList.add('active');
    renderPreview();
  });

  const logoDropZone = $('#logo-drop-zone');
  const logoInput = $('#logo-input');
  logoDropZone.addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', (e) => handleLogoFile(e.target.files[0]));
  logoDropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
  logoDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]);
  });

  $('#btn-download-current').addEventListener('click', downloadCurrent);
  $('#btn-download-all').addEventListener('click', downloadAll);

  $('#btn-upgrade-header').addEventListener('click', showUpgradeModal);
  $('#btn-upgrade').addEventListener('click', () => {
    if (extpay) extpay.openPaymentPage();
  });
  $('#modal-close').addEventListener('click', closeUpgradeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUpgradeModal();
  });

  if (extpay) {
    extpay.onPaid.addListener(() => {
      isPaid = true;
      chrome.storage.local.set({ isPaid: true });
      closeUpgradeModal();
      updatePlanUI();
      showToast('Pro activated!', 'success');
    });
  }

  $('#btn-save-template').addEventListener('click', saveTemplate);
  $('#btn-delete-template').addEventListener('click', deleteTemplate);
  $('#template-select').addEventListener('change', (e) => {
    if (e.target.value) applyTemplate(e.target.value);
  });
}

// --- File handling (sequential loading to prevent OOM) ---

function handleFiles(fileList) {
  const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!newFiles.length) return;

  const maxImages = isPaid ? MAX_IMAGES_PRO : MAX_IMAGES_FREE;
  const available = maxImages - images.length;
  if (available <= 0) {
    showToast(`Maximum ${maxImages} images reached`, 'error');
    return;
  }

  const filesToLoad = newFiles.slice(0, available);
  if (filesToLoad.length < newFiles.length) {
    showToast(`Loading ${filesToLoad.length} of ${newFiles.length} images (limit: ${maxImages})`, 'info');
  }

  let loaded = 0;
  let failed = 0;

  function loadNext(i) {
    if (i >= filesToLoad.length) {
      if (selectedIndex < 0 && images.length > 0) selectedIndex = 0;
      onImagesChanged();
      if (failed > 0) showToast(`${failed} image(s) failed to load`, 'error');
      return;
    }

    const file = filesToLoad[i];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        images.push({
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          file,
          img,
          name: file.name,
          dataUrl: e.target.result
        });
        loadNext(i + 1);
      };
      img.onerror = () => {
        failed++;
        loadNext(i + 1);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      failed++;
      loadNext(i + 1);
    };
    reader.readAsDataURL(file);
  }

  loadNext(0);
}

function handleLogoFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showToast('Failed to read logo file', 'error');
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = () => showToast('Invalid logo image', 'error');
    img.onload = () => {
      logoImg = img;
      logoDataUrl = e.target.result;
      $('#logo-preview-img').src = e.target.result;
      $('#logo-preview-img').hidden = false;
      $('#logo-placeholder').hidden = true;
      $('#logo-warning').hidden = true;
      saveLogo();
      renderPreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveLogo() {
  if (logoDataUrl) {
    await chrome.storage.local.set({ savedLogo: logoDataUrl });
  }
}

async function loadSavedLogo() {
  const { savedLogo } = await chrome.storage.local.get('savedLogo');
  if (!savedLogo) return;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      logoImg = img;
      logoDataUrl = savedLogo;
      $('#logo-preview-img').src = savedLogo;
      $('#logo-preview-img').hidden = false;
      $('#logo-placeholder').hidden = true;
      resolve();
    };
    img.onerror = () => {
      logoImg = null;
      logoDataUrl = null;
      resolve();
    };
    img.src = savedLogo;
  });
}

// --- Image state ---

function onImagesChanged() {
  $('#settings-panel').hidden = images.length === 0;
  $('#empty-state').hidden = images.length > 0;
  $('#preview-container').hidden = images.length === 0;
  $('#thumbnail-strip').hidden = images.length === 0;
  $('#image-count').textContent = images.length + ' image' + (images.length !== 1 ? 's' : '');
  renderThumbnails();
  renderPreview();
}

function renderThumbnails() {
  const strip = $('#thumbnail-strip');
  strip.innerHTML = '';
  images.forEach((item, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';

    const thumb = document.createElement('img');
    thumb.className = 'thumb' + (i === selectedIndex ? ' active' : '');
    thumb.src = item.dataUrl;
    thumb.addEventListener('click', () => {
      selectedIndex = i;
      renderThumbnails();
      renderPreview();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'thumb-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      images.splice(i, 1);
      if (selectedIndex >= images.length) selectedIndex = images.length - 1;
      onImagesChanged();
    });

    const nameEl = document.createElement('div');
    nameEl.className = 'thumb-name';
    nameEl.textContent = item.name;
    nameEl.title = item.name;

    wrap.appendChild(thumb);
    wrap.appendChild(removeBtn);
    wrap.appendChild(nameEl);
    strip.appendChild(wrap);
  });
}

// --- Settings ---

function getSettings() {
  const activeToggle = $('.toggle-btn.active');
  const type = activeToggle ? activeToggle.dataset.type : 'text';

  const activePos = $('.pos-btn.active');
  const tiledActive = $('#btn-tiled').classList.contains('active');
  let position = tiledActive ? 'tiled' : (activePos ? activePos.dataset.pos : 'center');
  if (!VALID_POSITIONS.includes(position)) position = 'center';

  return {
    type,
    text: $('#wm-text').value || 'Watermark',
    font: VALID_FONTS.includes($('#wm-font').value) ? $('#wm-font').value : 'Arial',
    sizePercent: parseInt($('#wm-size').value),
    color: /^#[0-9a-fA-F]{6}$/.test($('#wm-color').value) ? $('#wm-color').value : '#ffffff',
    opacity: parseInt($('#wm-opacity').value) / 100,
    position,
    logoSizePercent: parseInt($('#logo-size').value),
    jpegQuality: parseInt($('#wm-quality').value) / 100,
  };
}

// --- Canvas rendering ---

function renderPreview() {
  if (selectedIndex < 0 || !images[selectedIndex]) return;
  const canvas = $('#preview-canvas');
  const sourceImg = images[selectedIndex].img;
  applyWatermark(canvas, sourceImg, getSettings());
}

function applyWatermark(canvas, sourceImg, settings) {
  canvas.width = sourceImg.naturalWidth;
  canvas.height = sourceImg.naturalHeight;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(sourceImg, 0, 0);
  ctx.globalAlpha = settings.opacity;

  if (settings.type === 'text') {
    drawTextWatermark(ctx, canvas.width, canvas.height, settings);
  } else if (settings.type === 'logo' && logoImg) {
    drawLogoWatermark(ctx, canvas.width, canvas.height, settings);
  }

  ctx.globalAlpha = 1;
}

function drawTextWatermark(ctx, w, h, s) {
  const fontSize = Math.round(w * s.sizePercent / 100);
  ctx.font = `bold ${fontSize}px "${s.font}"`;
  ctx.fillStyle = s.color;

  const outlineColor = isLightColor(s.color) ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = Math.max(1, fontSize / 30);
  ctx.lineJoin = 'round';

  if (s.position === 'tiled') {
    drawTiledText(ctx, w, h, s.text, fontSize);
  } else {
    const pos = calcPosition(w, h, s.position, ctx.measureText(s.text).width, fontSize);
    ctx.textAlign = pos.align;
    ctx.textBaseline = pos.baseline;
    ctx.strokeText(s.text, pos.x, pos.y);
    ctx.fillText(s.text, pos.x, pos.y);
  }
}

function drawTiledText(ctx, w, h, text, fontSize) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const angle = -30 * Math.PI / 180;
  ctx.rotate(angle);
  const spacingX = Math.max(ctx.measureText(text).width + fontSize * 2, fontSize * 6);
  const spacingY = fontSize * 4;
  const diagonal = Math.sqrt(w * w + h * h);
  for (let y = -diagonal; y < diagonal * 2; y += spacingY) {
    for (let x = -diagonal; x < diagonal * 2; x += spacingX) {
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

function drawLogoWatermark(ctx, w, h, s) {
  const logoW = Math.round(w * s.logoSizePercent / 100);
  const logoH = Math.round(logoW * (logoImg.naturalHeight / logoImg.naturalWidth));

  if (s.position === 'tiled') {
    ctx.save();
    const angle = -30 * Math.PI / 180;
    ctx.rotate(angle);
    const spacingX = logoW * 3;
    const spacingY = logoH * 3;
    const diagonal = Math.sqrt(w * w + h * h);
    for (let y = -diagonal; y < diagonal * 2; y += spacingY) {
      for (let x = -diagonal; x < diagonal * 2; x += spacingX) {
        ctx.drawImage(logoImg, x - logoW / 2, y - logoH / 2, logoW, logoH);
      }
    }
    ctx.restore();
  } else {
    const margin = Math.round(w * 0.03);
    const pos = calcLogoPosition(w, h, logoW, logoH, s.position, margin);
    ctx.drawImage(logoImg, pos.x, pos.y, logoW, logoH);
  }
}

function calcPosition(w, h, position, textW, fontSize) {
  const margin = Math.round(w * 0.03);
  const positions = {
    'top-left':      { x: margin, y: margin, align: 'left', baseline: 'top' },
    'top-center':    { x: w / 2, y: margin, align: 'center', baseline: 'top' },
    'top-right':     { x: w - margin, y: margin, align: 'right', baseline: 'top' },
    'middle-left':   { x: margin, y: h / 2, align: 'left', baseline: 'middle' },
    'center':        { x: w / 2, y: h / 2, align: 'center', baseline: 'middle' },
    'middle-right':  { x: w - margin, y: h / 2, align: 'right', baseline: 'middle' },
    'bottom-left':   { x: margin, y: h - margin, align: 'left', baseline: 'bottom' },
    'bottom-center': { x: w / 2, y: h - margin, align: 'center', baseline: 'bottom' },
    'bottom-right':  { x: w - margin, y: h - margin, align: 'right', baseline: 'bottom' },
  };
  return positions[position] || positions['center'];
}

function calcLogoPosition(w, h, logoW, logoH, position, margin) {
  const positions = {
    'top-left':      { x: margin, y: margin },
    'top-center':    { x: (w - logoW) / 2, y: margin },
    'top-right':     { x: w - logoW - margin, y: margin },
    'middle-left':   { x: margin, y: (h - logoH) / 2 },
    'center':        { x: (w - logoW) / 2, y: (h - logoH) / 2 },
    'middle-right':  { x: w - logoW - margin, y: (h - logoH) / 2 },
    'bottom-left':   { x: margin, y: h - logoH - margin },
    'bottom-center': { x: (w - logoW) / 2, y: h - logoH - margin },
    'bottom-right':  { x: w - logoW - margin, y: h - logoH - margin },
  };
  return positions[position] || positions['center'];
}

function isLightColor(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// --- Download ---

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export image'));
    }, mimeType, quality);
  });
}

function getOutputInfo(file, settings) {
  const ext = file.type === 'image/png' ? 'png' : 'jpeg';
  const mimeType = 'image/' + ext;
  const quality = ext === 'jpeg' ? settings.jpegQuality : undefined;
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const outName = `${baseName}-watermarked.${ext === 'jpeg' ? 'jpg' : ext}`;
  return { ext, mimeType, quality, outName };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setButtonProcessing(btn, processing, text) {
  const label = btn.querySelector('.btn-text') || btn;
  if (processing) {
    btn._originalLabel = label.textContent;
    label.textContent = text || 'Processing...';
    btn.classList.add('processing');
  } else {
    label.textContent = btn._originalLabel || label.textContent;
    btn.classList.remove('processing');
  }
}

async function downloadCurrent() {
  if (selectedIndex < 0 || !images[selectedIndex]) return;

  if (!isPaid) {
    const used = await getDailyUsage();
    if (used >= MAX_FREE_DAILY) {
      showUpgradeModal();
      return;
    }
  }

  const btn = $('#btn-download-current');
  setButtonProcessing(btn, true, 'Exporting...');

  try {
    const item = images[selectedIndex];
    const settings = getSettings();
    const canvas = document.createElement('canvas');
    applyWatermark(canvas, item.img, settings);

    const { mimeType, quality, outName } = getOutputInfo(item.file, settings);
    const blob = await canvasToBlob(canvas, mimeType, quality);
    triggerDownload(blob, outName);

    showToast('Downloaded!', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  } finally {
    setButtonProcessing(btn, false);
    if (!isPaid) await incrementUsage(1);
  }
}

async function downloadAll() {
  if (!images.length) return;

  if (!isPaid) {
    await verifyPaidOnAction();
  }

  if (!isPaid) {
    const used = await getDailyUsage();
    const remaining = MAX_FREE_DAILY - used;
    if (remaining <= 0) {
      showUpgradeModal();
      return;
    }
    const count = Math.min(images.length, remaining);
    await downloadIndividual(count);
    if (count < images.length) {
      showToast(`Downloaded ${count}/${images.length}. Upgrade for unlimited.`, 'info');
    }
    return;
  }

  await downloadAsZip();
}

async function downloadIndividual(count) {
  const btn = $('#btn-download-all');
  const label = btn.querySelector('.btn-text') || btn;
  setButtonProcessing(btn, true, `Exporting 0/${count}...`);

  let successCount = 0;
  try {
    const settings = getSettings();
    const canvas = document.createElement('canvas');

    for (let i = 0; i < count; i++) {
      label.textContent = `Exporting ${i + 1}/${count}...`;
      const item = images[i];
      applyWatermark(canvas, item.img, settings);

      const { mimeType, quality, outName } = getOutputInfo(item.file, settings);
      const blob = await canvasToBlob(canvas, mimeType, quality);
      triggerDownload(blob, outName);
      successCount++;

      if (i < count - 1) await sleep(200);
    }

    showToast(`${successCount} image(s) downloaded!`, 'success');
  } catch (err) {
    showToast(`Export failed after ${successCount} images: ${err.message}`, 'error');
  } finally {
    setButtonProcessing(btn, false);
    if (successCount > 0) await incrementUsage(successCount);
  }
}

async function downloadAsZip() {
  const btn = $('#btn-download-all');
  const label = btn.querySelector('.btn-text') || btn;
  setButtonProcessing(btn, true, `Creating ZIP 0/${images.length}...`);

  try {
    const zip = new JSZip();
    const settings = getSettings();
    const canvas = document.createElement('canvas');

    for (let i = 0; i < images.length; i++) {
      label.textContent = `Creating ZIP ${i + 1}/${images.length}...`;
      const item = images[i];
      applyWatermark(canvas, item.img, settings);

      const { mimeType, quality, outName } = getOutputInfo(item.file, settings);
      const blob = await canvasToBlob(canvas, mimeType, quality);
      zip.file(outName, blob);
    }

    label.textContent = 'Compressing ZIP...';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, 'watermarked-images.zip');
    showToast(`${images.length} images saved as ZIP!`, 'success');
  } catch (err) {
    showToast('ZIP creation failed: ' + err.message, 'error');
  } finally {
    setButtonProcessing(btn, false);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Upgrade modal ---

function showUpgradeModal() {
  $('#upgrade-modal').hidden = false;
}

function closeUpgradeModal() {
  $('#upgrade-modal').hidden = true;
}

// --- Templates ---

async function saveTemplate() {
  if (!isPaid) {
    showUpgradeModal();
    return;
  }
  const name = prompt('Template name:');
  if (!name || !name.trim()) return;
  if (name.trim().length > 50) {
    showToast('Name too long (max 50 characters)', 'error');
    return;
  }

  const settings = getSettings();
  const { wmTemplates = [] } = await chrome.storage.local.get('wmTemplates');

  if (wmTemplates.length >= 20) {
    showToast('Maximum 20 templates reached', 'error');
    return;
  }

  const existing = wmTemplates.findIndex(t => t.name === name.trim());
  const template = { name: name.trim(), settings };
  if (existing >= 0) {
    wmTemplates[existing] = template;
  } else {
    wmTemplates.push(template);
  }
  await chrome.storage.local.set({ wmTemplates });
  await loadTemplateList();
  showToast('Template saved!', 'success');
}

async function deleteTemplate() {
  const select = $('#template-select');
  const name = select.value;
  if (!name) {
    showToast('Select a template to delete', 'info');
    return;
  }
  if (!confirm(`Delete template "${name}"?`)) return;

  const { wmTemplates = [] } = await chrome.storage.local.get('wmTemplates');
  const filtered = wmTemplates.filter(t => t.name !== name);
  await chrome.storage.local.set({ wmTemplates: filtered });
  await loadTemplateList();
  showToast('Template deleted', 'success');
}

async function loadTemplateList() {
  const { wmTemplates = [] } = await chrome.storage.local.get('wmTemplates');
  const select = $('#template-select');
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '— Select template —';
  select.replaceChildren(defaultOpt);

  wmTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

function applyTemplate(name) {
  chrome.storage.local.get('wmTemplates', ({ wmTemplates = [] }) => {
    const template = wmTemplates.find(t => t.name === name);
    if (!template) return;
    const s = template.settings;

    if (s.type === 'logo' && !isPaid) {
      showUpgradeModal();
      return;
    }

    if (s.type === 'text') {
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      $('[data-type="text"]').classList.add('active');
      $('#text-settings').hidden = false;
      $('#logo-settings').hidden = true;
    } else if (s.type === 'logo' && isPaid) {
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      $('[data-type="logo"]').classList.add('active');
      $('#text-settings').hidden = true;
      $('#logo-settings').hidden = false;
    }

    if (s.text) $('#wm-text').value = s.text;
    if (s.font && VALID_FONTS.includes(s.font)) $('#wm-font').value = s.font;
    if (s.color && /^#[0-9a-fA-F]{6}$/.test(s.color)) {
      $('#wm-color').value = s.color;
      $('#wm-color-hex').textContent = s.color;
    }
    if (s.sizePercent) {
      $('#wm-size').value = s.sizePercent;
      $('#wm-size-val').textContent = s.sizePercent + '%';
    }
    if (s.opacity != null) {
      const opVal = Math.round(s.opacity * 100);
      $('#wm-opacity').value = opVal;
      $('#wm-opacity-val').textContent = opVal + '%';
    }
    if (s.jpegQuality != null) {
      const qVal = Math.round(s.jpegQuality * 100);
      $('#wm-quality').value = qVal;
      $('#wm-quality-val').textContent = qVal + '%';
    }
    if (s.logoSizePercent) {
      $('#logo-size').value = s.logoSizePercent;
      $('#logo-size-val').textContent = s.logoSizePercent + '%';
    }

    $$('.pos-btn').forEach(b => b.classList.remove('active'));
    $('#btn-tiled').classList.remove('active');
    if (VALID_POSITIONS.includes(s.position)) {
      if (s.position === 'tiled') {
        $('#btn-tiled').classList.add('active');
      } else {
        const posBtn = $(`[data-pos="${s.position}"]`);
        if (posBtn && posBtn.classList.contains('pos-btn')) posBtn.classList.add('active');
      }
    }

    renderPreview();
    showToast('Template applied', 'success');
  });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
  await init();
  await loadSavedLogo();
});
