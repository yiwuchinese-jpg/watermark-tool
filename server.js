const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static');
const cors = require('cors');

const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Determine temp directory based on environment
// Vercel allows writing only to /tmp
const TMP_DIR = process.env.VERCEL ? os.tmpdir() : __dirname;
const UPLOAD_DIR = path.join(TMP_DIR, 'uploads');
const PROCESSED_DIR = path.join(TMP_DIR, 'processed');

// Setup ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Middleware
app.use(cors());
app.use(express.static('public'));

// Serve processed files from the correct directory
app.use('/processed', express.static(PROCESSED_DIR));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

// --- Core Logic ported from Electron App ---

async function generateLayerBuffer(layer, width, height) {
    if (layer.type === 'tiled') {
        const tiledType = layer.tiledType || 'text'; // 'text' or 'image'
        const opacity = layer.opacity || 50;

        if (tiledType === 'image' && layer.path) {
            try {
                const imgPath = layer.path;
                const targetImgWidth = Math.max(20, Math.round(width * (layer.size / 100)));
                const imgBuffer = await sharp(imgPath)
                    .resize({ width: targetImgWidth })
                    .toBuffer();

                const imgMeta = await sharp(imgBuffer).metadata();
                const imgW = imgMeta.width;
                const imgH = imgMeta.height;
                const imgBase64 = imgBuffer.toString('base64');
                const mimeType = imgPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

                const tileW = Math.round(imgW * 3);
                const tileH = Math.round(imgH * 3);

                const svgTiled = `
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="tilePattern" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
                             <image 
                                href="data:${mimeType};base64,${imgBase64}" 
                                x="${(tileW - imgW) / 2}" 
                                y="${(tileH - imgH) / 2}" 
                                width="${imgW}" 
                                height="${imgH}" 
                                transform="rotate(-45, ${tileW / 2}, ${tileH / 2})" 
                                opacity="${opacity / 100}"
                             />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#tilePattern)" />
                </svg>`;

                const rasterizedBuffer = await sharp(Buffer.from(svgTiled)).png().toBuffer();
                return { buffer: rasterizedBuffer, isTiled: true };

            } catch (err) {
                console.error("Error processing tiled image:", err);
                return null;
            }
        } else {
            // Tiled Text Logic
            const text = layer.text || 'Watermark';
            const fontSize = Math.max(12, Math.round(width * (layer.size / 100)));
            const color = layer.color || '#ffffff';

            const charWidth = fontSize * 0.8;
            const tileW = Math.max(50, Math.round((text.length * charWidth) + (fontSize * 3)));
            const tileH = Math.max(50, Math.round(fontSize * 4));

            const svgTiled = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="tilePattern" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
                         <text x="50%" y="50%" 
                               text-anchor="middle" 
                               dominant-baseline="middle" 
                               transform="rotate(-45, ${tileW / 2}, ${tileH / 2})" 
                               fill="${color}" 
                               font-size="${fontSize}px" 
                               font-weight="bold" 
                               font-family="sans-serif" 
                               opacity="${opacity / 100}">
                               ${text}
                         </text>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tilePattern)" />
            </svg>`;

            const rasterizedBuffer = await sharp(Buffer.from(svgTiled)).png().toBuffer();
            return { buffer: rasterizedBuffer, isTiled: true };
        }
    }
    else if (layer.type === 'text') {
        const text = layer.text || 'Watermark';
        const fontSize = Math.max(12, Math.round(width * (layer.size / 100)));
        const color = layer.color || '#ffffff';
        const opacity = layer.opacity || 100;
        const posX = Math.round((layer.position.x / 100) * width);
        const posY = Math.round((layer.position.y / 100) * height);

        const svgImage = `
        <svg width="${width}" height="${height}">
          <style>
            .title { fill: ${color}; font-size: ${fontSize}px; font-weight: bold; font-family: sans-serif; opacity: ${opacity / 100}; }
          </style>
          <text x="${posX}" y="${posY}" text-anchor="middle" dominant-baseline="middle" class="title">${text}</text>
        </svg>`;
        return { buffer: Buffer.from(svgImage), isText: true };
    }
    else if (layer.type === 'logo' && layer.path) {
        const logoPath = layer.path;
        if (fs.existsSync(logoPath)) {
            const desiredWidth = Math.max(10, Math.round(width * (layer.size / 100)));
            const logoBuffer = await sharp(logoPath)
                .resize({ width: desiredWidth })
                .toBuffer();
            return { buffer: logoBuffer, isLogo: true, xPct: layer.position.x, yPct: layer.position.y };
        }
    }
    return null;
}

async function processImage(filePath, settings) {
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    // Use PROCESSED_DIR instead of hardcoded path
    const outputPath = path.join(PROCESSED_DIR, `${name}_${Date.now()}${ext}`);

    const image = sharp(filePath);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    let composites = [];
    const layers = settings.layers || [settings];

    for (const layer of layers) {
        try {
            const result = await generateLayerBuffer(layer, width, height);
            if (!result) continue;

            if (result.isLogo) {
                const logoMeta = await sharp(result.buffer).metadata();
                const left = Math.max(0, Math.round((result.xPct / 100) * width) - Math.round(logoMeta.width / 2));
                const top = Math.max(0, Math.round((result.yPct / 100) * height) - Math.round(logoMeta.height / 2));
                composites.push({ input: result.buffer, top, left });
            } else if (result.isTiled || result.isText) {
                composites.push({ input: result.buffer, top: 0, left: 0 });
            }
        } catch (e) {
            console.error("Layer generation error:", e);
        }
    }

    if (composites.length > 0) {
        await image.composite(composites).toFile(outputPath);
    } else {
        await image.toFile(outputPath);
    }
    return outputPath;
}

function processVideo(filePath, settings) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(filePath);
        const name = path.basename(filePath, ext);
        // Use PROCESSED_DIR instead of hardcoded path
        const outputPath = path.join(PROCESSED_DIR, `${name}_${Date.now()}${ext}`);

        ffmpeg.ffprobe(filePath, async (err, metadata) => {
            if (err) return reject(new Error("FFprobe failed: " + err.message));

            try {
                const stream = metadata.streams.find(s => s.codec_type === 'video');
                const width = stream.width || 1280;
                const height = stream.height || 720;

                const layerPriority = { 'tiled': 1, 'text': 2, 'logo': 3 };
                const layers = settings.layers || [settings];
                let activeLayers = layers.sort((a, b) => (layerPriority[a.type] || 0) - (layerPriority[b.type] || 0));

                if (activeLayers.length === 0) {
                    fs.copyFileSync(filePath, outputPath);
                    return resolve(outputPath);
                }

                let filterComplex = [];
                let inputFiles = [];
                let tempFiles = [];
                let currentStream = '0:v';

                for (let i = 0; i < activeLayers.length; i++) {
                    const layer = activeLayers[i];
                    const inputIdx = i + 1;

                    if (layer.type === 'tiled' || layer.type === 'text') {
                        const result = await generateLayerBuffer(layer, width, height);
                        const tempPath = path.join(PROCESSED_DIR, `temp_layer_${Date.now()}_${i}.png`);
                        await sharp(result.buffer).toFile(tempPath);

                        inputFiles.push(tempPath);
                        tempFiles.push(tempPath);

                        const nextStream = `v${inputIdx}`;
                        filterComplex.push(`[${currentStream}][${inputIdx}:v]overlay=0:0[${nextStream}]`);
                        currentStream = nextStream;

                    } else if (layer.type === 'logo' && layer.path) {
                        const logoPath = layer.path;
                        if (fs.existsSync(logoPath)) {
                            inputFiles.push(logoPath);

                            const logoStreamName = `logo${inputIdx}`;
                            const opacity = layer.opacity / 100;
                            const xPct = layer.position.x / 100;
                            const yPct = layer.position.y / 100;
                            const targetWidth = Math.max(10, Math.round(width * (layer.size / 100)));

                            filterComplex.push(`[${inputIdx}:v]scale=${targetWidth}:-1,format=rgba,colorchannelmixer=aa=${opacity}[${logoStreamName}]`);

                            const nextStream = `v${inputIdx}`;
                            filterComplex.push(`[${currentStream}][${logoStreamName}]overlay=x=(W*${xPct})-(w/2):y=(H*${yPct})-(h/2)[${nextStream}]`);
                            currentStream = nextStream;
                        }
                    }
                }

                const finalMap = currentStream === '0:v' ? '0:v' : `[${currentStream}]`;

                let command = ffmpeg(filePath);
                inputFiles.forEach(f => command.input(f));

                if (filterComplex.length > 0) {
                    command.complexFilter(filterComplex, finalMap);
                }

                command
                    .outputOptions(['-map 0:a?', '-c:a copy'])
                    .output(outputPath)
                    .on('end', () => {
                        tempFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        tempFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
                        reject(err);
                    })
                    .run();

            } catch (e) {
                reject(e);
            }
        });
    });
}

// API Endpoint
app.post('/process', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
    try {
        if (!req.files || !req.files['file']) {
            return res.status(400).send('No file uploaded.');
        }

        const file = req.files['file'][0];
        const logoFile = req.files['logo'] ? req.files['logo'][0] : null;
        
        // Parse settings from form data
        let settings = {};
        if (req.body.settings) {
            try {
                settings = JSON.parse(req.body.settings);
            } catch (e) {
                console.error("Invalid settings JSON", e);
            }
        }
        
        // Construct the layer configuration
        const layer = {
            type: req.body.type || 'text', // text, tiled, logo
            tiledType: req.body.tiledType || 'text',
            text: req.body.text || 'JustinPro',
            color: req.body.color || '#ffffff',
            size: parseFloat(req.body.size) || 5, // percentage
            opacity: parseFloat(req.body.opacity) || 50,
            position: {
                x: parseFloat(req.body.x) || 50,
                y: parseFloat(req.body.y) || 50
            }
        };

        if (layer.type === 'logo') {
            if (logoFile) {
                layer.path = logoFile.path;
            } else {
                return res.status(400).send('Logo type selected but no logo file uploaded');
            }
        }
        
        // Handle Tiled Image
        if (layer.type === 'tiled' && layer.tiledType === 'image') {
             if (logoFile) {
                layer.path = logoFile.path;
            }
        }

        const processingSettings = { layers: [layer] };
        
        const ext = path.extname(file.path).toLowerCase();
        let outputPath;

        if (['.jpg', '.png', '.jpeg', '.webp'].includes(ext)) {
            outputPath = await processImage(file.path, processingSettings);
        } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
            outputPath = await processVideo(file.path, processingSettings);
        } else {
            return res.status(400).send('Unsupported file type');
        }

        const relativePath = 'processed/' + path.basename(outputPath);
        res.json({ success: true, url: relativePath });

    } catch (err) {
        console.error(err);
        res.status(500).send('Processing failed: ' + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Export app for Vercel
module.exports = app;
