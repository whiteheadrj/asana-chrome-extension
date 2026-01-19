import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Entry points for the extension
const entryPoints = [
  'src/background/service-worker.ts',
  'src/popup/popup.ts',
  'src/content/gmail-content.ts',
  'src/content/outlook-content.ts',
  'src/settings/settings.ts',
];

// Filter to only existing entry points (for POC phase, not all files exist yet)
const existingEntryPoints = entryPoints.filter(entry => {
  const fullPath = join(__dirname, entry);
  return existsSync(fullPath);
});

// Build configuration
const buildOptions = {
  entryPoints: existingEntryPoints.length > 0 ? existingEntryPoints : undefined,
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  external: ['chrome'],
  target: 'es2022',
  sourcemap: true,
  minify: false,
};

/**
 * Copy static assets to dist folder
 */
function copyStaticAssets() {
  const distDir = join(__dirname, 'dist');

  // Ensure dist directory exists
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json if it exists
  const manifestSrc = join(__dirname, 'manifest.json');
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, join(distDir, 'manifest.json'));
    console.log('Copied manifest.json');
  }

  // Copy popup HTML and CSS if they exist
  const popupDir = join(distDir, 'popup');
  const popupSrcDir = join(__dirname, 'src', 'popup');
  if (existsSync(popupSrcDir)) {
    if (!existsSync(popupDir)) {
      mkdirSync(popupDir, { recursive: true });
    }

    const popupHtml = join(popupSrcDir, 'popup.html');
    if (existsSync(popupHtml)) {
      copyFileSync(popupHtml, join(popupDir, 'popup.html'));
      console.log('Copied popup.html');
    }

    const popupCss = join(popupSrcDir, 'popup.css');
    if (existsSync(popupCss)) {
      copyFileSync(popupCss, join(popupDir, 'popup.css'));
      console.log('Copied popup.css');
    }
  }

  // Copy settings HTML and CSS if they exist
  const settingsDir = join(distDir, 'settings');
  const settingsSrcDir = join(__dirname, 'src', 'settings');
  if (existsSync(settingsSrcDir)) {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }

    const settingsHtml = join(settingsSrcDir, 'settings.html');
    if (existsSync(settingsHtml)) {
      copyFileSync(settingsHtml, join(settingsDir, 'settings.html'));
      console.log('Copied settings.html');
    }

    const settingsCss = join(settingsSrcDir, 'settings.css');
    if (existsSync(settingsCss)) {
      copyFileSync(settingsCss, join(settingsDir, 'settings.css'));
      console.log('Copied settings.css');
    }
  }

  // Copy icons if they exist
  const iconsDir = join(__dirname, 'icons');
  const distIconsDir = join(distDir, 'icons');
  if (existsSync(iconsDir)) {
    if (!existsSync(distIconsDir)) {
      mkdirSync(distIconsDir, { recursive: true });
    }

    const iconFiles = readdirSync(iconsDir).filter(f => f.endsWith('.png'));
    for (const iconFile of iconFiles) {
      copyFileSync(join(iconsDir, iconFile), join(distIconsDir, iconFile));
      console.log(`Copied ${iconFile}`);
    }
  }
}

/**
 * Main build function
 */
async function build() {
  console.log('Building extension...');

  // Copy static assets first
  copyStaticAssets();

  // Only run esbuild if there are entry points
  if (existingEntryPoints.length > 0) {
    try {
      await esbuild.build(buildOptions);
      console.log('Build completed successfully!');
    } catch (error) {
      console.error('Build failed:', error);
      process.exit(1);
    }
  } else {
    console.log('No entry points found yet - only copied static assets');
    // Create dist folder structure for verification
    const distDir = join(__dirname, 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
  }

  console.log('Output directory: dist/');
}

// Run build
build();
