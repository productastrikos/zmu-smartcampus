import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Lets Digital Twin 2's static GIS assets (client/src/assets/geojson/*)
// be imported directly as parsed objects — `import x from './y.geojson'`
// — the same way Vite already handles `.json`, which it doesn't extend to
// `.geojson` out of the box.
function geojsonLoader() {
  return {
    name: 'geojson-loader',
    transform(code, id) {
      if (!id.endsWith('.geojson')) return;
      return { code: `export default ${code};`, map: null };
    },
  };
}

export default defineConfig({
  root: 'client',
  plugins: [react(), geojsonLoader()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5051',
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
