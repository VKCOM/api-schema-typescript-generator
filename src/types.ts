export interface Dictionary<T> {
  [key: string]: T;
}

export enum ObjectType {
  Object = 'object',
  Response = 'response',
  Params = 'params',
}

export interface JSONSchemaPropertyInterface {
  type?: 'integer' | 'string' | 'boolean' | 'array';
  $ref?: string;
  minimum?: number;
  format?: 'uri';
  description?: string;
}

export interface JSONSchemaObjectInterface {
  type: 'object';
  properties?: JSONSchemaPropertyInterface[];
  required?: string[];
}

export interface JSONSchemaMethodParameter extends JSONSchemaPropertyInterface {
  name: string;
  required?: boolean;
}

export interface JSONSchemaMethodInterface {
  name: string;
  description?: string;
  access_token_type?: string[];
  parameters?: JSONSchemaMethodParameter[];
  responses: Dictionary<Dictionary<string>>;
  errors?: Array<Dictionary<any>>;
  emptyResponse?: boolean;
}
