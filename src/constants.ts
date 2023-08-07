import { EOL } from 'os';
import { Dictionary } from './types';

export const DEFAULT_API_VERSION = '5.131';

export const PropertyType = {
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  STRING: 'string',
  ARRAY: 'array',
  OBJECT: 'object',
  MIXED: 'mixed',
} as const;

export const scalarTypes: Dictionary<string> = {
  integer: 'number',
  boolean: 'boolean',
  number: 'number',
  string: 'string',
};

export const primitiveTypes: Dictionary<string> = {
  ...scalarTypes,
  array: 'any[]',
  object: '{ [key: string]: unknown }',
  mixed: 'any /* mixed primitive */',
};

export const spaceChar = ' ';
export const tabChar = spaceChar.repeat(2);
export const newLineChar = EOL;

export const baseBoolIntRef = 'base_bool_int';
export const baseOkResponseRef = 'base_ok_response';
export const basePropertyExistsRef = 'base_property_exists';

export const baseAPIParamsInterfaceName = 'BaseAPIParams';
