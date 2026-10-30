import path from 'path';
import { Dictionary } from '../types';
import { APITypingsGenerator } from './APITypingsGenerator';
import { SchemaObject } from './SchemaObject';

function generateObjects(value: object, additionalObjects: Dictionary<object> = {}) {
  const objects: Dictionary<object> = {
    example_value: value,
    example_container: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { $ref: '#/definitions/example_value' },
        },
      },
    },
    ...additionalObjects,
  };
  const generator = new APITypingsGenerator({
    needEmit: false,
    outDirPath: '',
    methodsPattern: '*',
    methodsDefinitions: {
      methods: [
        {
          name: 'example.get',
          access_token_type: ['user'],
          parameters: [
            {
              name: 'items',
              type: 'array',
              items: { $ref: '#/definitions/example_container' },
            },
          ],
          responses: { response: { $ref: '#/definitions/base_ok_response' } },
        },
      ],
    },
    objects: objects as Dictionary<SchemaObject>,
    responses: {},
    errors: {},
  });

  generator.generate();

  return generator.resultFiles;
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test.each([
  {
    name: 'a type array with oneOf',
    schema: {
      type: ['string', 'integer', 'boolean', 'object', 'array'],
      oneOf: [
        { type: 'string' },
        { type: 'integer' },
        { type: 'boolean' },
        { type: 'object', additionalProperties: true },
        { type: 'array', items: { type: 'object', additionalProperties: true } },
      ],
    },
    expected:
      'string | number | boolean | { [key: string]: unknown } | { [key: string]: unknown }[]',
  },
  {
    name: 'a type array without oneOf',
    schema: { type: ['string', 'integer', 'boolean'] },
    expected: 'string | number | boolean',
  },
  {
    name: 'oneOf without a type',
    schema: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
    expected: 'string | number',
  },
  {
    name: 'oneOf with an object type',
    schema: {
      type: 'object',
      oneOf: [{ type: 'object' }, { type: 'array', items: { type: 'integer' } }],
    },
    expected: '{ [key: string]: unknown } | number[]',
  },
])('generates a named union for $name referenced by array items', ({ schema, expected }) => {
  const files = generateObjects(schema);

  expect(files[path.join('objects', 'example', 'ExampleValue.ts')]).toContain(
    `export type ExampleValue = ${expected};`,
  );
  expect(files[path.join('objects', 'example', 'ExampleContainer.ts')]).toContain(
    "import { ExampleValue } from './ExampleValue';",
  );
  expect(files[path.join('objects', 'example', 'ExampleContainer.ts')]).toContain(
    'values?: ExampleValue[];',
  );
});

test('generates and imports objects referenced by a named union', () => {
  const files = generateObjects(
    {
      oneOf: [
        { type: 'string' },
        { $ref: '#/definitions/example_payload' },
        { type: 'array', items: { $ref: '#/definitions/example_payload' } },
      ],
    },
    { example_payload: { type: 'object', properties: { id: { type: 'integer' } } } },
  );

  expect(files[path.join('objects', 'example', 'ExampleValue.ts')]).toContain(
    "import { ExamplePayload } from './ExamplePayload';",
  );
  expect(files[path.join('objects', 'example', 'ExampleValue.ts')]).toContain(
    'export type ExampleValue = string | ExamplePayload | ExamplePayload[];',
  );
  expect(files[path.join('objects', 'example', 'ExamplePayload.ts')]).toContain('id?: number;');
});

test('preserves interfaces for ordinary objects referenced by array items', () => {
  const files = generateObjects({ type: 'object', properties: { id: { type: 'integer' } } });

  expect(files[path.join('objects', 'example', 'ExampleValue.ts')]).toContain(
    'export interface ExampleValue {',
  );
  expect(files[path.join('objects', 'example', 'ExampleValue.ts')]).toContain('id?: number;');
});
