import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

// Fonction pour copier un répertoire récursivement
function copyFolderRecursiveSync(source, target) {
  // Vérifier si le répertoire cible existe, sinon le créer
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Lire tous les fichiers du répertoire source
  if (fs.existsSync(source)) {
    const files = fs.readdirSync(source);
    files.forEach(file => {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      
      // Si le fichier est un répertoire, appel récursif
      if (fs.lstatSync(sourcePath).isDirectory()) {
        copyFolderRecursiveSync(sourcePath, targetPath);
      } else {
        // Sinon, copier le fichier
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    copyPublicDir: true,
  },
  publicDir: 'public', // Changer le dossier public à 'public'
  base: './',
  plugins: [
    {
      name: 'copy-assets-plugin',
      closeBundle() {
        const sourceDir = resolve(__dirname, 'assets');
        const targetDir = resolve(__dirname, 'dist/assets');
        console.log(`Copying assets from ${sourceDir} to ${targetDir}`);
        copyFolderRecursiveSync(sourceDir, targetDir);
      }
    }
  ]
});
