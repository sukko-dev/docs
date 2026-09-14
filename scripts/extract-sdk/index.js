#!/usr/bin/env node

// Extract SDK reference from the sukko-js TypeScript packages using TypeDoc.
//
// TypeDoc runs the real TypeScript compiler over each package's barrel entry
// point, so it resolves named re-exports, directory barrels (e.g. `./transport`),
// and generics — and reports exactly the public surface, excluding internals a
// file happens to export. It replaces the earlier regex parser, which missed
// `SseTransport` (a directory re-export) and over-extracted internals like
// `HttpApi` (named re-export lists were not honored).
//
// Output matches the schema `scripts/generate-docs.js` consumes:
//   { packages: [{ name, dir, exports: [{ name, kind, signature, parameters?, returnType? }] }] }
// `kind` is one of: function | type | class | constant.
//
// Usage: node index.js /path/to/sukko-js

const path = require('node:path');
const { Application, TSConfigReader } = require('typedoc');

const packages = [
  { name: '@sukko/sdk', dir: 'packages/sdk' },
  { name: '@sukko/websocket', dir: 'packages/websocket' },
  { name: '@sukko/websocket-node', dir: 'packages/websocket-node' },
  { name: '@sukko/react', dir: 'packages/react' },
  { name: '@sukko/react-native', dir: 'packages/react-native' },
  { name: '@sukko/vue', dir: 'packages/vue' },
  { name: '@sukko/svelte', dir: 'packages/svelte' },
];

// TypeDoc ReflectionKind → the docs schema's `kind`.
const KIND = {
  128: 'class', // Class
  256: 'type', // Interface — grouped under "type" in the reference
  2097152: 'type', // TypeAlias
  64: 'function', // Function
  32: 'constant', // Variable
  8: 'type', // Enum
};

/** Render a TypeDoc serialized type to a compact display string. Best-effort — the reference lists
 * signatures, it is not a type checker; unknown shapes fall back to their name or `unknown`. */
function typeToString(t) {
  if (!t) return 'unknown';
  switch (t.type) {
    case 'intrinsic':
    case 'reference':
    case 'typeParameter': {
      const args = t.typeArguments?.length
        ? `<${t.typeArguments.map(typeToString).join(', ')}>`
        : '';
      return `${t.name}${args}`;
    }
    case 'array':
      return `${typeToString(t.elementType)}[]`;
    case 'union':
      return t.types.map(typeToString).join(' | ');
    case 'intersection':
      return t.types.map(typeToString).join(' & ');
    case 'literal':
      return typeof t.value === 'string' ? `"${t.value}"` : String(t.value);
    case 'tuple':
      return `[${(t.elements ?? []).map(typeToString).join(', ')}]`;
    case 'reflection':
      return 'object';
    default:
      return t.name ?? 'unknown';
  }
}

/** Type parameter suffix, e.g. `<T = unknown>` → `<T>`. */
function typeParams(refl) {
  const tp = refl.typeParameters;
  if (!tp?.length) return '';
  return `<${tp.map((p) => p.name).join(', ')}>`;
}

/** Build the display signature for one exported reflection. */
function signatureOf(refl, kind) {
  if (kind === 'function') {
    const sig = refl.signatures?.[0];
    const params = (sig?.parameters ?? [])
      .map((p) => `${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeToString(p.type)}`)
      .join(', ');
    const ret = sig?.type ? `: ${typeToString(sig.type)}` : '';
    return `${refl.name}(${params})${ret}`;
  }
  // class / interface / type-alias / constant — the name plus any type parameters.
  return `${refl.name}${typeParams(refl)}`;
}

/** Convert one package's barrel to the schema's `exports` array via TypeDoc. */
async function extractPackage(pkgSrcDir) {
  const app = await Application.bootstrapWithPlugins(
    {
      entryPoints: [path.join(pkgSrcDir, 'src', 'index.ts')],
      tsconfig: path.join(pkgSrcDir, 'tsconfig.json'),
      excludeExternals: true,
      excludeInternal: true,
      skipErrorChecking: true,
      logLevel: 'Error', // suppress "referenced but not included" warnings for excluded internals
    },
    [new TSConfigReader()],
  );

  const project = await app.convert();
  if (!project) return [];

  const exports = [];
  for (const refl of project.children ?? []) {
    const kind = KIND[refl.kind];
    if (!kind) continue; // skip anything not in the reference taxonomy
    exports.push({ name: refl.name, kind, signature: signatureOf(refl, kind) });
  }
  // Stable, name-sorted output so regenerations produce no spurious diffs.
  exports.sort((a, b) => a.name.localeCompare(b.name));
  return exports;
}

async function main() {
  const sdkRoot = process.argv[2];
  if (!sdkRoot) {
    console.error('Usage: node index.js /path/to/sukko-js');
    process.exit(1);
  }

  const output = { packages: [] };
  for (const pkg of packages) {
    const exports = await extractPackage(path.join(sdkRoot, pkg.dir));
    if (exports.length === 0) {
      // Never silently emit an empty package (a compile failure or an unbuilt sukko-js `dist/` would do
      // this). stderr only — stdout is the JSON. Surfaces the class of failure that unit tests can't.
      console.error(`WARNING: ${pkg.name} produced 0 exports — is sukko-js installed and built (dist/)?`);
    }
    output.packages.push({ name: pkg.name, dir: pkg.dir, exports });
  }

  console.log(JSON.stringify(output, null, 2));
}

module.exports = { typeToString, signatureOf, extractPackage };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
