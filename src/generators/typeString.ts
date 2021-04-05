import { SchemaObject } from './SchemaObject';
import { Dictionary, RefsDictionary, RefsDictionaryType } from '../types';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import { getInterfaceName, getObjectNameByRef, joinOneOfValues, resolvePrimitiveTypesArray } from '../helpers';
import {
  baseBoolIntRef,
  baseOkResponseRef,
  basePropertyExistsRef,
  primitiveTypes,
  PropertyType,
  scalarTypes,
} from '../constants';
import { isString } from '../utils';
import { consoleLogErrorAndExit } from '../log';
import { generateInlineEnum } from '../generator';

function generateBaseType(object: SchemaObject, options: GenerateTypeStringOptions): GeneratorResultInterface {
  let codeBlocks: CodeBlocksArray = [];
  let typeString = 'any /* default type */';
  let imports: RefsDictionary = {};
  let description: string | undefined = '';

  if (object.enum) {
    const {
      value,
      codeBlocks: newCodeBlocks,
      description: newDescription,
    } = generateInlineEnum(object, {
      objectParentName: object.parentObjectName,
      skipEnumNamesConstant: options.skipEnumNamesConstant,
    });

    typeString = value;
    codeBlocks = newCodeBlocks;
    description = newDescription;
  } else if (isString(object.type)) {
    const primitive = primitiveTypes[object.type];
    if (!primitive) {
      consoleLogErrorAndExit(object.name, `Error, type "${object.type}" is not declared type`);
    }

    typeString = primitive;
  } else if (Array.isArray(object.type)) {
    const primitivesTypesArray = resolvePrimitiveTypesArray(object.type);
    if (primitivesTypesArray !== null) {
      typeString = primitivesTypesArray;
    }
  }

  return {
    codeBlocks,
    imports,
    value: typeString,
    description,
  };
}

export interface GenerateTypeStringOptions {
  /**
   * Determines whether enums will be inline to type value or them will be as separate interface block
   */
  skipEnumNamesConstant?: boolean;
}

export function generateTypeString(
  object: SchemaObject,
  objects: Dictionary<SchemaObject>,
  options: GenerateTypeStringOptions = {},
): GeneratorResultInterface {
  let codeBlocks: CodeBlocksArray = [];
  let typeString = 'any /* default type */';
  let imports: RefsDictionary = {};
  let description: string | undefined = '';

  if (object.oneOf) {
    const values = object.oneOf.map((oneOfObject) => {
      const { value, imports: newImports } = generateTypeString(oneOfObject, objects, options);
      imports = { ...imports, ...newImports };
      return value;
    });

    typeString = joinOneOfValues(values);
  } else if (object.type === PropertyType.ARRAY && object.items) {
    let depth = 1;
    let items = object.items;

    // Nested arrays
    while (true) {
      if (items.items) {
        items = items.items;
        depth++;
      } else {
        break;
      }
    }

    if (items.ref) {
      const refName = getObjectNameByRef(items.ref);
      const refObject = objects[refName];
      if (!refObject) {
        consoleLogErrorAndExit(`Error, object for "${refName}" ref is not found.`);
      }

      imports[refName] = RefsDictionaryType.NeedImport;
      typeString = getInterfaceName(refName) + '[]'.repeat(depth);
    } else {
      const {
        value,
        description: newDescription,
        imports: newImports,
        codeBlocks: newCodeBlocks,
      } = generateBaseType(items, options);

      if (value.endsWith('\'') || value.includes('|')) {
        typeString = `Array<${value}>` + '[]'.repeat(depth - 1); // Need decrement depth value because of Array<T> has its own depth
      } else {
        typeString = value + '[]'.repeat(depth);
      }

      description = newDescription;
      imports = { ...imports, ...newImports };
      codeBlocks = [...codeBlocks, ...newCodeBlocks];
    }
  } else if (object.type) {
    return generateBaseType(object, options);
  } else if (object.ref) {
    const refName = getObjectNameByRef(object.ref);

    switch (refName) {
      case baseOkResponseRef:
      case basePropertyExistsRef:
        typeString = '1';
        break;

      case baseBoolIntRef:
        typeString = '0 | 1';
        break;

      default: {
        const refObject = objects[refName];

        if (!refObject) {
          consoleLogErrorAndExit(`Error, object for "${refName}" ref is not found.`);
        }

        if (refObject.enum) {
          imports[refName] = RefsDictionaryType.NeedImport;
          typeString = getInterfaceName(refName);
        } else if (refObject.oneOf) {
          const values = refObject.oneOf.map((oneOfObject) => {
            const { value, imports: newImports } = generateTypeString(oneOfObject, objects, options);
            imports = { ...imports, ...newImports };
            return value;
          });

          typeString = joinOneOfValues(values);
        } else if (isString(refObject.type) && scalarTypes[refObject.type] && !refObject.ref) {
          typeString = scalarTypes[refObject.type];
        } else {
          imports[refName] = RefsDictionaryType.NeedImport;
          typeString = getInterfaceName(refName);
        }
      }
    }
  }

  return {
    codeBlocks,
    imports,
    value: typeString,
    description,
  };
}
