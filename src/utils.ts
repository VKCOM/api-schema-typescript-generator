import { Dictionary } from './types';

export function isString(object: any): object is string {
  return typeof object === 'string';
}

export function isObject(object: any): boolean {
  return Object.prototype.toString.call(object) === '[object Object]';
}

export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function uniqueArray<T = any>(array: T[]): T[] {
  return array.filter((v, i, a) => a.indexOf(v) === i);
}

export function sortArrayAlphabetically(array: string[]): string[] {
  return array.sort((a: string, b: string) => a.localeCompare(b));
}

export function arrayToMap(array: any[]): Dictionary<boolean> {
  if (!array) {
    return {};
  }

  return array.reduce((acc, value) => {
    acc[value] = true;
    return acc;
  }, {});
}

export function trimStringDoubleSpaces(string: string): string {
  return string.trim().replace(/\s\s+/g, ' ');
}

export function quoteJavaScriptValue(value: string | number) {
  return isString(value) ? `'${value}'` : value;
}
