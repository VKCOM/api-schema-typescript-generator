import {
  baseBoolIntRef,
  baseOkResponseRef,
  basePropertyExistsRef,
  primitiveTypes,
  PropertyType,
  scalarTypes,
} from '../constants';
import { generateInlineEnum } from './enums';
import {
  formatArrayDepth,
  getInterfaceName,
  getObjectNameByRef,
  joinOneOfValues,
  resolvePrimitiveTypesArray,
} from '../helpers';
import { consoleLogErrorAndExit } from '../log';
import { Dictionary, RefsDictionary, RefsDictionaryType } from '../types';
import { isString } from '../utils';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import { SchemaObject } from './SchemaObject';

interface GenerateTypeStringOptions {
  objectParentName?: string;
  /**
   * Determines whether enums will be inline to type value or them will be as separate interface block
   */
  needEnumNamesConstant?: boolean;
}

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
      // TODO: Refactor
      // section_object_name -> property_name -> items => section_object_name_property_name_items enumNames
      objectParentName: options.objectParentName || object.parentObjectName,
      needEnumNamesConstant: options.needEnumNamesConstant,
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

export function generateTypeString(
  object: SchemaObject,
  objects: Dictionary<SchemaObject>,
  options: GenerateTypeStringOptions = {},
): GeneratorResultInterface {
  let codeBlocks: CodeBlocksArray = [];
  let typeString = 'any /* default type */';
  let imports: RefsDictionary = {};
  let description: string | undefined = '';

  options = {
    needEnumNamesConstant: true,
    ...options,
  };

  if (object.oneOf) {
    const values = object.oneOf.map((oneOfObject) => {
      const { value, imports: newImports } = generateTypeString(oneOfObject, objects);
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

      imports[refName] = RefsDictionaryType.GenerateAndImport;
      typeString = formatArrayDepth(getInterfaceName(refName), depth);
    } else {
      const {
        value,
        description: newDescription,
        imports: newImports,
        codeBlocks: newCodeBlocks,
      } = generateBaseType(items, {
        ...options,
        // TODO: Refactor
        objectParentName: object.parentObjectName,
      });

      typeString = formatArrayDepth(value, depth);
      description = newDescription;
      imports = { ...imports, ...newImports };
      codeBlocks = [...codeBlocks, ...newCodeBlocks];
    }
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
          imports[refName] = RefsDictionaryType.GenerateAndImport;
          typeString = getInterfaceName(refName);
        } else if (refObject.oneOf) {
          const values = refObject.oneOf.map((oneOfObject) => {
            const { value, imports: newImports } = generateTypeString(oneOfObject, objects);
            imports = { ...imports, ...newImports };
            return value;
          });

          typeString = joinOneOfValues(values);
        } else if (isString(refObject.type) && scalarTypes[refObject.type] && !refObject.ref) {
          typeString = scalarTypes[refObject.type];
        } else {
          imports[refName] = RefsDictionaryType.GenerateAndImport;
          typeString = getInterfaceName(refName);
        }
      }
    }
  } else if (object.type) {
    return generateBaseType(object, options);
  }

  return {
    codeBlocks,
    imports,
    value: typeString,
    description,
  };
}
