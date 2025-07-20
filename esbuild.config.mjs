import esbuild from 'esbuild';
import process from 'node:process';
import builtins from 'builtin-modules';

const banner = `/*
 * Content Farm Plugin for Obsidian
 * Generated: ${new Date().toISOString()}
 * Build: ${process.env.NODE_ENV || 'development'}
 */`;

const isProduction = process.argv[2] === 'production' || process.env.NODE_ENV === 'production';

const external = [
  'obsidian',
  'electron',
  '@codemirror/autocomplete',
  '@codemirror/collab',
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/lint',
  '@codemirror/search',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/lr',
  ...builtins
];

// First, build the CSS file
await esbuild.build({
  entryPoints: ['src/styles/main.css'],
  bundle: true,
  minify: isProduction,
  outfile: 'styles.css',
  loader: { '.css': 'css' },
});

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ['main.ts'],
  bundle: true,
  external: [...external, './styles.css'],
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  treeShaking: true,
  sourcemap: !isProduction ? 'inline' : false,
  minify: isProduction,
  define: {
    'process.env.NODE_ENV': `"${isProduction ? 'production' : 'development'}"`,
  },
  logLevel: 'info',
  outfile: 'main.js',
  loader: { '.css': 'text' },
});

if (isProduction) {
  // Build only for production
  await context.rebuild();
  process.exit(0);
} else {
  // Enable watch mode for development
  await context.watch();
  console.log('Watching for changes...');
}
