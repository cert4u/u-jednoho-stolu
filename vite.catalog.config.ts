import {defineConfig} from 'vite';
export default defineConfig({
  build:{outDir:'dist',emptyOutDir:false,target:'es2022',minify:false,
    lib:{entry:'lib/catalogs/core.ts',formats:['es'],fileName:()=> 'catalog-core.mjs'},
    rollupOptions:{external:['zod']},
  },
});
