import {defineConfig} from 'vite';
export default defineConfig({esbuild:{jsx:'automatic'},build:{rollupOptions:{output:{manualChunks:{maplibre:['maplibre-gl'],react:['react','react-dom']}}}}});
