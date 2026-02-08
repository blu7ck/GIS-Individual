
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicLibsDir = path.join(projectRoot, 'public', 'libs');

// Base URL for Potree 1.8 Resources (from a consistent source)
// We will use potree.org as it's the official demo site and has the structure we need.
const POTREE_BASE_URL = 'https://potree.org/potree/build/potree';
const POTREE_LIBS_URL = 'https://potree.org/potree/libs';

const libs = [
    {
        name: 'jquery',
        url: 'https://code.jquery.com/jquery-3.6.0.min.js',
        destination: 'jquery.min.js'
    },
    {
        name: 'proj4',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.min.js',
        destination: 'proj4.min.js'
    },
    {
        name: 'three',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        destination: 'three.min.js'
    },
    {
        name: 'tween',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js',
        destination: 'tween.min.js'
    },
    // Potree Core Files
    { name: 'potree.js', url: `${POTREE_BASE_URL}/potree.js`, destination: 'potree.min.js' },
    { name: 'potree.css', url: `${POTREE_BASE_URL}/potree.css`, destination: 'potree.css' },
    // Missing dependencies often bundled or expected
    { name: 'BinaryHeap.js', url: `${POTREE_LIBS_URL}/other/BinaryHeap.js`, destination: 'BinaryHeap.js' },
];

console.log(`Downloading libraries to ${publicLibsDir}...`);

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        // Ensure directory exists
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const file = fs.createWriteStream(dest);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        const request = https.get(url, options, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                // Try one more fallback for specific Potree structure if needed, or just fail
                // For now, fail to see what's missing
                reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${path.basename(dest)}`);
                resolve();
            });
        });

        request.on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

const downloadRecursive = async () => {
    // 1. Download Base Libs
    for (const lib of libs) {
        await downloadFile(lib.url, path.join(publicLibsDir, lib.destination));
    }

    // 2. Download Workers (Vital for Potree)
    // Structure: public/libs/workers/...
    const workers = [
        'BinaryDecoderWorker.js',
        'DEMWorker.js',
        'EptLaszipDecoderWorker.js',
        'EptBinaryDecoderWorker.js',
        'EptZstandardDecoderWorker.js',
        'LazLoaderWorker.js',
        '2.0/DecoderWorker.js', // The one explicitly failed in user log
        '2.0/Version.js'
    ];

    console.log('Downloading Workers...');
    for (const worker of workers) {
        const url = `${POTREE_BASE_URL}/workers/${worker}`;
        const dest = path.join(publicLibsDir, 'workers', worker);
        try {
            await downloadFile(url, dest);
        } catch (e) {
            console.error(`Warning: Could not download worker ${worker}: ${e.message}`);
        }
    }

    // 3. Download Resources (Icons, textures - minimal set)
    const resources = [
        'icons/orbit_controls.svg',
        'icons/flight_controls.svg',
        'icons/earth_controls.svg',
        'textures/gradient.jpg'
    ];

    console.log('Downloading Resources...');
    for (const res of resources) {
        const url = `${POTREE_BASE_URL}/resources/${res}`;
        const dest = path.join(publicLibsDir, 'resources', res);
        try {
            await downloadFile(url, dest);
        } catch (e) {
            console.error(`Warning: Could not download resource ${res}: ${e.message}`);
        }
    }
};

downloadRecursive().then(() => {
    console.log('All downloads finished.');
}).catch(err => {
    console.error('Fatal error:', err);
});
