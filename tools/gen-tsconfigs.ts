import { promises as fs } from 'fs';
import * as path from 'path';

import { getPackageInfo } from './utils';

const BASE_TS_CONFIG = {
  '//': '⚠️ AUTOGENERATED ⚠️ This file was automatically generated by tools/gen-tsconfigs.ts, do not edit manually.',
  compilerOptions: {
    module: 'commonjs',
    target: 'es2019',
    outDir: 'dist',
    lib: ['dom', 'es2019'],
    sourceMap: true,
    rootDir: 'src',
    experimentalDecorators: true,
    strict: true,
    esModuleInterop: true,
    declaration: true,
    composite: true,
    declarationMap: true,
  },
  exclude: ['node_modules', 'dist', 'test', 'index.ts', 'tmpl'],
};

/**
 * Filters out non-unique items in an array.
 */
function filterDupes<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

(async () => {
  const packages = await getPackageInfo();

  // Do each package in parallel
  await Promise.all(
    packages.map((pkg) => {
      // Carve out a subset of types on the package manifest object
      const pkgManifest = pkg.manifest as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      // Figure out which other local packages this package references
      const pkgDeps = [pkgManifest.dependencies, pkgManifest.devDependencies].flatMap((deps) => (deps === undefined ? [] : Object.keys(deps)));
      const refs = filterDupes(
        pkgDeps.flatMap((depName) => {
          const depPkg = packages.find((maybeDepPkg) => maybeDepPkg.name === depName);
          return depPkg === undefined ? [] : [depPkg];
        })
      );

      // Map each package this package references to a typescript project reference
      const tsRefs = refs.map((depPkg) => ({
        path: path.relative(pkg.path, depPkg.path),
      }));

      // Create the typescript config object
      const tsConfig = Object.assign({}, BASE_TS_CONFIG, {
        references: tsRefs,
      });
      Object.assign(tsConfig.compilerOptions, {
        typeRoots: [
          path.relative(pkg.path, path.resolve(__dirname, '..', 'typings')),
          path.relative(pkg.path, path.resolve(__dirname, '..', 'node_modules', '@types')),
        ],
      });

      // Write the typescript config to the package dir
      const tsConfigPath = path.join(pkg.path, 'tsconfig.json');
      return fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, undefined, 2));
    })
  );
})().catch(console.error);
