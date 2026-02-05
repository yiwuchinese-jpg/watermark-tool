let selectedFile = null;
let selectedLogo = null;
let isDragging = false;
let currentSettings = {
    type: 'logo',
    size: 5,
    opacity: 50,
    x: 50,
    y: 50,
    tiledType: 'image'
};

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('fileName').innerText = `已选择: ${selectedFile.name}`;
        updatePreview();
    }
}

function handleLogoSelect(input) {
    if (input.files && input.files[0]) {
        selectedLogo = input.files[0];
        document.getElementById('logoName').innerText = `Logo: ${selectedLogo.name}`;
        updatePreview();
    }
}

function handleSettingsChange() {
    currentSettings.type = document.getElementById('watermarkType').value;
    currentSettings.size = parseInt(document.getElementById('wmSize').value);
    currentSettings.opacity = parseInt(document.getElementById('wmOpacity').value);
    currentSettings.x = parseInt(document.getElementById('wmX').value);
    currentSettings.y = parseInt(document.getElementById('wmY').value);
    
    currentSettings.tiledType = (currentSettings.type === 'tiled-image') ? 'image' : 'image';

    document.getElementById('sizeVal').innerText = currentSettings.size;
    document.getElementById('opacityVal').innerText = currentSettings.opacity;
    document.getElementById('xVal').innerText = currentSettings.x;
    document.getElementById('yVal').innerText = currentSettings.y;

    const logoSettings = document.getElementById('logoSettings');
    const posSettings = document.getElementById('posSettings');

    // Always show logo settings
    if (logoSettings) logoSettings.style.display = 'block';

    if (currentSettings.type === 'tiled-image') {
        posSettings.style.display = 'none';
    } else {
        posSettings.style.display = 'block';
    }

    updateOverlay();
}

function updatePreview() {
    const container = document.getElementById('previewContainer');
    if (!selectedFile) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🖼️</span>
                <p>请选择文件以预览</p>
            </div>`;
        return;
    }

    container.innerHTML = ''; 

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'media-wrapper';
    wrapper.id = 'mediaWrapper';
    container.appendChild(wrapper);

    // 1. Create Media Element
    let mediaEl;
    if (selectedFile.type.startsWith('video')) {
        mediaEl = document.createElement('video');
        mediaEl.src = URL.createObjectURL(selectedFile);
        mediaEl.controls = true;
    } else {
        mediaEl = document.createElement('img');
        mediaEl.src = URL.createObjectURL(selectedFile);
    }
    mediaEl.className = 'preview-media';
    wrapper.appendChild(mediaEl);

    // 2. Create Overlay Element
    const overlay = document.createElement('div');
    overlay.className = 'watermark-overlay';
    overlay.id = 'watermarkOverlay';
    
    // Add drag listeners
    overlay.addEventListener('mousedown', startDrag);
    overlay.addEventListener('touchstart', startDrag, {passive: false});

    wrapper.appendChild(overlay);

    // Important: Wait for image to load to get dimensions for tiling logic
    mediaEl.onload = () => updateOverlay();
    mediaEl.onloadeddata = () => updateOverlay(); // for video
}

function updateOverlay() {
    const overlay = document.getElementById('watermarkOverlay');
    const mediaEl = document.querySelector('.preview-media');
    if (!overlay || !mediaEl) return;

    // Clear previous styles/content
    overlay.innerHTML = '';
    overlay.style = ''; // Reset inline styles
    overlay.className = 'watermark-overlay'; // Reset class

    // Base Overlay Styles (re-apply from CSS essentially, but dynamic)
    overlay.style.position = 'absolute';
    overlay.style.cursor = 'move';
    overlay.style.userSelect = 'none';
    overlay.style.opacity = currentSettings.opacity / 100;

    // Get Container Dimensions for Tiling Calculation
    const width = mediaEl.clientWidth || 800;
    const height = mediaEl.clientHeight || 600;

    if (currentSettings.type === 'logo') {
        if (selectedLogo) {
            const imgUrl = URL.createObjectURL(selectedLogo);
            overlay.innerHTML = `<img src="${imgUrl}" draggable="false" style="width:100%;height:auto;display:block;">`;
            overlay.style.width = `${currentSettings.size}%`;
            overlay.style.height = 'auto'; 
        } else {
            overlay.innerHTML = `<span style="background:rgba(0,0,0,0.5);color:white;padding:5px;font-size:12px;">Logo</span>`;
            overlay.style.width = 'auto';
        }
        
        // Position
        overlay.style.left = `${currentSettings.x}%`;
        overlay.style.top = `${currentSettings.y}%`;
        overlay.style.transform = 'translate(-50%, -50%)';
    }
    else if (currentSettings.type === 'tiled-image') {
        // Tiled Logo
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.transform = 'none'; // CRITICAL: Reset the default centering transform
        overlay.style.cursor = 'default';

        if (selectedLogo) {
            const imgUrl = URL.createObjectURL(selectedLogo);
            
            // Need image dimensions to calculate tile size ratio
            const img = new Image();
            img.src = imgUrl;
            img.onload = () => {
                 const logoW = img.width;
                 const logoH = img.height;
                 
                 // Target Logo Width in Preview
                 const targetW = Math.max(20, Math.round(width * (currentSettings.size / 100)));
                 const scale = targetW / logoW;
                 const targetH = logoH * scale;

                 // Spacing
                 const tileW = targetW * 3; 
                 const tileH = targetH * 3;

                 const svg = `
                 <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="tiledLogoPattern" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
                             <image 
                                href="${imgUrl}" 
                                x="${(tileW - targetW) / 2}" 
                                y="${(tileH - targetH) / 2}" 
                                width="${targetW}" 
                                height="${targetH}" 
                                transform="rotate(-45, ${tileW / 2}, ${tileH / 2})" 
                             />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#tiledLogoPattern)" />
                </svg>`;
                
                const svgBlob = new Blob([svg], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(svgBlob);
                overlay.style.backgroundImage = `url('${url}')`;
                overlay.style.backgroundRepeat = 'repeat';
                overlay.style.backgroundSize = 'auto'; // Let pattern define size
            };
        } else {
             overlay.innerHTML = '<span style="background:rgba(0,0,0,0.5);color:white;padding:10px;">请上传 Logo 以预览铺满效果</span>';
             overlay.style.display = 'flex';
             overlay.style.alignItems = 'center';
             overlay.style.justifyContent = 'center';
        }
    }
}

// Drag Logic
function startDrag(e) {
    if (currentSettings.type === 'tiled-image') return;
    
    e.preventDefault();
    isDragging = true;
    
    const overlay = document.getElementById('watermarkOverlay');
    overlay.classList.add('active');

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, {passive: false});
    document.addEventListener('touchend', stopDrag);
}

function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const container = document.getElementById('mediaWrapper'); 
    const rect = container.getBoundingClientRect();
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    currentSettings.x = Math.round(x);
    currentSettings.y = Math.round(y);

    document.getElementById('wmX').value = currentSettings.x;
    document.getElementById('wmY').value = currentSettings.y;
    document.getElementById('xVal').innerText = currentSettings.x;
    document.getElementById('yVal').innerText = currentSettings.y;

    updateOverlay();
}

function stopDrag() {
    isDragging = false;
    const overlay = document.getElementById('watermarkOverlay');
    if (overlay) overlay.classList.remove('active');
    
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
}


async function processFile() {
    if (!selectedFile) {
        alert('请先选择文件！');
        return;
    }

    const btn = document.getElementById('processBtn');
    btn.disabled = true;
    btn.innerText = '⏳ 处理中...';

    const formData = new FormData();
    formData.append('file', selectedFile);

    if (currentSettings.type === 'logo' || currentSettings.type === 'tiled-image') {
        if (selectedLogo) {
            formData.append('logo', selectedLogo);
        } else {
            alert('请上传 Logo 图片！');
            btn.disabled = false;
            btn.innerText = '开始处理 & 下载';
            return;
        }
    }

    // Fix for backend compatibility: map 'tiled-image' to 'tiled'
    if (currentSettings.type === 'tiled-image') {
        formData.append('type', 'tiled');
    } else {
        formData.append('type', currentSettings.type);
    }
    
    formData.append('tiledType', currentSettings.tiledType);
    formData.append('size', currentSettings.size);
    formData.append('opacity', currentSettings.opacity);
    formData.append('x', currentSettings.x);
    formData.append('y', currentSettings.y);

    try {
        const response = await fetch('/process', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            const resultDiv = document.getElementById('resultContent');
            const isVideo = selectedFile.type.startsWith('video');
            const url = result.url;
            
            let html = '';
            if (isVideo) {
                html = `<video controls src="${url}" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);"></video>`;
            } else {
                html = `<img src="${url}" alt="Processed Image" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
            }
            html += `<br><br><a href="${url}" download class="btn btn-primary" style="width: auto; padding: 0.8rem 2rem;">⬇️ 下载处理后的文件</a>`;
            
            resultDiv.innerHTML = html;
            document.getElementById('resultSection').style.display = 'block';
            resultDiv.scrollIntoView({behavior: 'smooth'});
        } else {
            alert('处理失败: ' + (result.message || '未知错误'));
        }
    } catch (err) {
        console.error(err);
        alert('网络错误或服务器异常');
    } finally {
        btn.disabled = false;
        btn.innerText = '开始处理 & 下载';
    }
}

handleSettingsChange();
