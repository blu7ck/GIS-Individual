import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      sourcemap: false, // Production'da source map'i kapatın (güvenlik ve performans)
      // Code splitting for better performance
      rollupOptions: {
        // Externalize Cesium - it's loaded from CDN via importmap
        external: ['cesium', '@cesium/engine'],
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'supabase': ['@supabase/supabase-js'],
          },
          // Disable source map comments in output to prevent source map errors
          sourcemapExcludeSources: true,
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
    },
    // Optimize dependencies to prevent source map issues
    optimizeDeps: {
      // Exclude Cesium and its dependencies (loaded from CDN via importmap)
      exclude: [
        'cesium',
        '@cesium/engine',
        'resium', // Resium also loads Cesium from CDN
      ],
      // Force include CommonJS modules for proper ESM transformation
      // These are dependencies that need CommonJS->ESM conversion
      include: [
        'mersenne-twister',
        'urijs',
        'urijs/src/URI',
        'grapheme-splitter',
        'grapheme-splitter',
        'nosleep.js',
        'meshoptimizer',
        'dompurify',
        '@tweenjs/tween.js',
        'protobufjs',
        'shpjs', // Add shpjs for proper browser compatibility
      ],
      // Configure CommonJS handling for mixed module types
      esbuildOptions: {
        target: 'es2020',
      },
      commonjsOptions: {
        // Transform mixed ES modules (CommonJS interop)
        transformMixedEsModules: true,
        // Include all CommonJS modules in node_modules for proper handling
        include: [/node_modules/],
        // Handle default exports from CommonJS modules
        defaultIsModuleExports: true,
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'global': 'globalThis', // Add global polyfill for Node.js modules
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Prevent Vite from resolving Cesium from node_modules
        // Cesium is loaded from CDN via importmap in index.html
        'cesium': 'https://esm.sh/cesium@^1.136.0',
        '@cesium/engine': 'https://esm.sh/cesium@^1.136.0',
        // Add buffer polyfill for shpjs browser compatibility
        'buffer': 'buffer',
      }
    }
  };
});
