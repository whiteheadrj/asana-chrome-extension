import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check if config.local.ts exists for aliasing
const configLocalPath = join(__dirname, 'src', 'config.local.ts');
const useLocalConfig = existsSync(configLocalPath);

if (useLocalConfig) {
  console.log('Using config.local.ts for build');
} else {
  console.log('Warning: config.local.ts not found, using placeholder config.ts');
}

// Entry points for the extension - ESM format (popups, service worker)
const esmEntryPoints = [
  'src/background/service-worker.ts',
  'src/popup/popup.ts',
  'src/settings/settings.ts',
  'src/oauth-callback/callback.ts',
];

// Entry points that need IIFE format (content scripts cannot use ES modules)
const iifeEntryPoints = [
  'src/content/gmail-content.ts',
  'src/content/outlook-content.ts',
];

// Filter to only existing entry points (for POC phase, not all files exist yet)
const existingEsmEntryPoints = esmEntryPoints.filter(entry => {
  const fullPath = join(__dirname, entry);
  return existsSync(fullPath);
});

const existingIifeEntryPoints = iifeEntryPoints.filter(entry => {
  const fullPath = join(__dirname, entry);
  return existsSync(fullPath);
});

// Plugin to resolve config.ts to config.local.ts when it exists
const configAliasPlugin = {
  name: 'config-alias',
  setup(build) {
    if (!useLocalConfig) return;

    // Intercept imports of config.ts and redirect to config.local.ts
    build.onResolve({ filter: /\/config$/ }, (args) => {
      // Only redirect if it's resolving to our src/config.ts
      if (args.resolveDir.includes('src') || args.resolveDir.includes('background') || args.resolveDir.includes('popup')) {
        return {
          path: configLocalPath,
        };
      }
      return null;
    });
  },
};

// Build configuration for ESM entry points (service worker, popups)
const esmBuildOptions = {
  entryPoints: existingEsmEntryPoints.length > 0 ? existingEsmEntryPoints : undefined,
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  outbase: 'src',  // Preserve directory structure
  external: ['chrome'],
  target: 'es2022',
  sourcemap: true,
  minify: false,
  plugins: [configAliasPlugin],
};

// Build configuration for IIFE entry points (content scripts)
// Content scripts CANNOT use ES modules - they must be IIFE format
const iifeBuildOptions = {
  entryPoints: existingIifeEntryPoints.length > 0 ? existingIifeEntryPoints : undefined,
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  outbase: 'src',  // Preserve directory structure (src/content/x.ts -> dist/content/x.js)
  external: ['chrome'],
  target: 'es2022',
  sourcemap: true,
  minify: false,
  plugins: [configAliasPlugin],
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

  // Copy OAuth callback HTML if it exists
  const callbackDir = join(distDir, 'oauth-callback');
  const callbackSrcDir = join(__dirname, 'src', 'oauth-callback');
  if (existsSync(callbackSrcDir)) {
    if (!existsSync(callbackDir)) {
      mkdirSync(callbackDir, { recursive: true });
    }

    const callbackHtml = join(callbackSrcDir, 'callback.html');
    if (existsSync(callbackHtml)) {
      copyFileSync(callbackHtml, join(callbackDir, 'callback.html'));
      console.log('Copied callback.html');
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

  let hasEntryPoints = false;

  // Build ESM entry points (service worker, popups)
  if (existingEsmEntryPoints.length > 0) {
    hasEntryPoints = true;
    try {
      await esbuild.build(esmBuildOptions);
      console.log('ESM build completed (service worker, popups)');
    } catch (error) {
      console.error('ESM build failed:', error);
      process.exit(1);
    }
  }

  // Build IIFE entry points (content scripts)
  if (existingIifeEntryPoints.length > 0) {
    hasEntryPoints = true;
    try {
      await esbuild.build(iifeBuildOptions);
      console.log('IIFE build completed (content scripts)');
    } catch (error) {
      console.error('IIFE build failed:', error);
      process.exit(1);
    }
  }

  if (!hasEntryPoints) {
    console.log('No entry points found yet - only copied static assets');
    // Create dist folder structure for verification
    const distDir = join(__dirname, 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
  } else {
    console.log('Build completed successfully!');
  }

  console.log('Output directory: dist/');
}

// Run build
build();
