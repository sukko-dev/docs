const { test } = require('node:test');
const assert = require('node:assert');

// Importing must NOT run main() — verifies the require.main === module guard.
const { typeToString, signatureOf } = require('./index.js');

test('typeToString renders the type shapes the reference needs', () => {
  assert.equal(typeToString({ type: 'intrinsic', name: 'string' }), 'string');
  assert.equal(
    typeToString({
      type: 'reference',
      name: 'Promise',
      typeArguments: [{ type: 'intrinsic', name: 'void' }],
    }),
    'Promise<void>',
  );
  assert.equal(
    typeToString({ type: 'array', elementType: { type: 'intrinsic', name: 'number' } }),
    'number[]',
  );
  assert.equal(
    typeToString({
      type: 'union',
      types: [
        { type: 'literal', value: 'web' },
        { type: 'literal', value: 'android' },
      ],
    }),
    '"web" | "android"',
  );
  assert.equal(typeToString({ type: 'reflection' }), 'object'); // inline object type
  assert.equal(typeToString(undefined), 'unknown'); // missing type falls back
});

test('signatureOf builds a typed function signature', () => {
  const fn = {
    name: 'buildChannel',
    signatures: [
      {
        parameters: [
          { name: 'tenant', type: { type: 'intrinsic', name: 'string' } },
          { name: 'suffix', type: { type: 'intrinsic', name: 'string' } },
        ],
        type: { type: 'intrinsic', name: 'string' },
      },
    ],
  };
  assert.equal(signatureOf(fn, 'function'), 'buildChannel(tenant: string, suffix: string): string');
});

test('signatureOf marks optional parameters', () => {
  const fn = {
    name: 'history',
    signatures: [
      {
        parameters: [
          { name: 'channel', type: { type: 'intrinsic', name: 'string' } },
          { name: 'limit', flags: { isOptional: true }, type: { type: 'intrinsic', name: 'number' } },
        ],
        type: { type: 'intrinsic', name: 'void' },
      },
    ],
  };
  assert.equal(signatureOf(fn, 'function'), 'history(channel: string, limit?: number): void');
});

test('signatureOf renders a class/type name with its type parameters', () => {
  assert.equal(signatureOf({ name: 'SukkoClient' }, 'class'), 'SukkoClient');
  assert.equal(
    signatureOf({ name: 'TypedMessage', typeParameters: [{ name: 'T' }] }, 'type'),
    'TypedMessage<T>',
  );
  assert.equal(signatureOf({ name: 'CLOSE_CODES' }, 'constant'), 'CLOSE_CODES');
});
