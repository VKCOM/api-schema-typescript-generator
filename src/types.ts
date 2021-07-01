export interface Dictionary<T> {
  [key: string]: T;
}

export enum RefsDictionaryType {
  GenerateAndImport,
  Generate,
}

export type RefsDictionary = Record<string, RefsDictionaryType>;

export enum ObjectType {
  Object = 'object',
  Response = 'response',
  Params = 'params',
}

export interface JSONSchemaPropertyInterface {
  type?: 'integer' | 'string' | 'boolean' | 'array';
  items?: JSONSchemaPropertyInterface;
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

export interface JSONSchemaMethodsDefinitionsInterface {
  $schema: string;
  version: string;
  title: string;
  description: string;
  termsOfService: string;
  methods: JSONSchemaMethodInfoInterface[];
}

export interface JSONSchemaMethodInfoInterface {
  name: string;
  description?: string;
  access_token_type?: string[];
  parameters?: JSONSchemaMethodParameter[];
  responses: Dictionary<Dictionary<string>>;
  errors?: Array<Dictionary<any>>;
  emptyResponse?: boolean;
}
