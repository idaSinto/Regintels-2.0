/** @type {import('next').NextConfig} */
const fs = require('fs');
const os = require('os');
const path = require('path');

const isWindows = process.platform === 'win32';
const tsconfigBuildPath = isWindows ? path.join(os.tmpdir(), 'regintels-2.0', 'tsconfig.build.json') : 'tsconfig.json';
const tsconfigPath = isWindows ? path.relative(__dirname, tsconfigBuildPath) : 'tsconfig.json';

if (isWindows) {
  fs.mkdirSync(path.dirname(tsconfigBuildPath), { recursive: true });
  const repoRoot = __dirname;
  const tsconfig = {
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      forceConsistentCasingInFileNames: true,
      baseUrl: repoRoot,
      paths: {
        '@/*': ['src/*'],
      },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts', 'src/app/layout.tsx', 'next.config.js'],
    exclude: ['node_modules'],
  };

  fs.writeFileSync(tsconfigBuildPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}

const nextConfig = {
  // OneDrive-backed workspaces can expose `.next` as a reparse point on Windows,
  // which breaks Next's build-time `readlink` checks. Use a separate local dist dir.
  distDir: process.platform === 'win32' ? '.next-local' : '.next',
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
