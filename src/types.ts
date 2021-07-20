export interface Dictionary<T> {
  [key: string]: T;
}

export enum RefsDictionaryType {
  GenerateAndImport,
  Generate,
}

export type RefsDictionary = Record<string, RefsDictionaryType>;

export type EnumLikeArray = Array<string | number>;

export enum ObjectType {
  Object = 'object',
  Response = 'response',
  Params = 'params',
}
