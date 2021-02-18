import { Dictionary } from './types';

export function flatten<T>(input: Array<T | T[]>): T[] {
  const stack = [...input];
  const result: T[] = [];
  while (stack.length) {
    const next = stack.pop();
    if (next) {
      if (Array.isArray(next)) {
        stack.push(...next);
      } else {
        result.push(next);
      }
    }
  }
  return result.reverse();
}

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

/**
 * Removes empty string array elements from start and end of array, trim array elements and returns the new array
 *
 * @example trimArray(['', 'First', '', 'Second', '', '']) => ['First', '', 'Second']
 */
export function trimArray(array: string[]): string[] {
  let trimmedArray = array.map((v) => v.trim());

  while (trimmedArray[0] === '') {
    trimmedArray.shift();
  }

  while (trimmedArray[trimmedArray.length - 1] === '') {
    trimmedArray.pop();
  }

  return trimmedArray;
}
