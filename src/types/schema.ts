export type Format = 'json' | 'int32' | 'int64';

/**
 * Enum values text representations
 */
export type EnumNames = [string, ...string[]];

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9_]+$".
 */
export type ResponseProperty = {
  [k: string]: unknown;
};

/**
 * Possible custom errors
 */
export type MethodErrors = Array<{
  $ref?: string;
}>;

/**
 * VK API declaration
 */
export interface API {
  errors?: {
    [k: string]: Error;
  };
  methods?: Method[];
  definitions?: {
    [k: string]: Response;
  };
  $schema?: string;
  title?: string;
  description?: string;
  termsOfService?: string;
  version?: string;
}

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-z][a-z0-9_]+$".
 */
export interface Error {
  /**
   * Error code
   */
  code: number;
  /**
   * Error description
   */
  description: string;
  /**
   * Array of error subcodes
   */
  subcodes?: ErrorSubcode[];
  global?: boolean;
  disabled?: boolean;
}

export interface ErrorSubcode {
  subcode?: number;
  description?: string;
  $comment?: string;
  $ref?: string;
}

export interface Method {
  /**
   * Method name
   */
  name: string;
  /**
   * Method description
   */
  description?: string;
  timeout?: number;
  /**
   * Input parameters for method
   */
  access_token_type: Array<'open' | 'user' | 'group' | 'service'>;
  /**
   * Input parameters for method
   */
  parameters?: Parameter[];
  /**
   * References to response objects
   */
  responses: {
    [k: string]: Response;
  };
  emptyResponse?: boolean;
  errors?: MethodErrors;
}

export interface Parameter {
  /**
   * Parameter name
   */
  name: string;
  format?: Format;
  /**
   * Parameter type
   */
  type: 'array' | 'boolean' | 'integer' | 'number' | 'string';
  items?: {
    $ref: string;
  };
  maxItems?: number;
  minItems?: number;
  maximum?: number;
  minimum?: number;
  $ref?: string;
  enum?: [unknown, ...unknown[]];
  enumNames?: EnumNames;
  /**
   * Default property value
   */
  default?: {
    [k: string]: unknown;
  };
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  /**
   * Parameter description
   */
  description?: string;
}

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^([a-zA-Z0-9_]+)?[rR]esponse$".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^([a-zA-Z0-9_]+)?[rR]esponse$".
 */
export interface Response {
  type?: string;
  description?: string;
  allOf?: Response[];
  items?: any[];
  required?: unknown[];
  title?: string;
  oneOf?: unknown[];
  $ref?: string;
  properties?: {
    [k: string]: ResponseProperty;
  };
  additionalProperties?: boolean;
}
