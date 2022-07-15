import { baseBoolIntRef, newLineChar } from '../constants';
import { getInterfaceName, getObjectNameByRef } from '../helpers';
import { RefsDictionary, RefsDictionaryType } from '../types';
import * as Schema from '../types/schema';

interface NormalizeMethodInfoResult {
  method: Schema.Method;
  parameterRefs: RefsDictionary;
}

/**
 * Patches for method definition
 */
export function normalizeMethodInfo(method: Schema.Method): NormalizeMethodInfoResult {
  const parameterRefs: RefsDictionary = {};

  method.parameters?.forEach((parameter) => {
    // For method params "boolean" type means 1 or 0
    // Real "false" boolean value will be detected by API as true
    if (parameter.type === 'boolean') {
      // @ts-expect-error
      delete parameter.type;
      parameter.$ref = baseBoolIntRef;
    }

    // For parameters of the "array" type, VK API still accepts only a comma-separated string
    // This may change in the future when the VK API starts accepting a json body
    if (parameter.type === 'array') {
      parameter.type = 'string';
    }

    if (!parameter.description) {
      parameter.description = '';
    }

    if (parameter.items && parameter.items.$ref) {
      const ref = parameter.items?.$ref;
      parameterRefs[ref] = RefsDictionaryType.Generate;

      parameter.description += newLineChar.repeat(2) + [
        `@see ${getInterfaceName(getObjectNameByRef(ref))} (${ref})`,
      ].join(newLineChar);
    }
  });

  return {
    method,
    parameterRefs,
  };
}
