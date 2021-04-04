import { isObject, isString } from '../utils';
import { Dictionary, RefsDictionary, RefsDictionaryType } from '../types';
import {
  baseBoolIntRef,
  baseOkResponseRef,
  basePropertyExistsRef,
  primitiveTypes,
  PropertyType,
  scalarTypes,
} from '../constants';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import {
  getInterfaceName,
  getObjectNameByRef,
  joinOneOfValues,
  resolvePrimitiveTypesArray,
  transformPatternPropertyName,
} from '../helpers';
import { consoleLogErrorAndExit } from '../log';
import { generateInlineEnum } from '../generator';

export interface SchemaObjectToTypeOptions {
  /**
   * Determines whether enums will be inline to type value or them will be as separate interface block
   */
  skipEnumNamesConstant?: boolean;
}

export class SchemaObject {
  constructor(name: string, object: any, parentName?: string) {
    if (!isObject(object)) {
      consoleLogErrorAndExit(`[SchemaObject] "${name}" is not an object.`, { name, object, parentName });
      return;
    }

    this.name = name;

    if (parentName) {
      this.parentObjectName = parentName;
    }

    if (isString(object.type)) {
      this.type = object.type;
    } else if (Array.isArray(object.type)) {
      this.type = object.type;
    }

    if (isString(object.description)) {
      this.description = object.description;
    }

    if (isString(object.$ref)) {
      this.ref = object.$ref;
    }

    if (Array.isArray(object.enum)) {
      this.enum = object.enum;
    }

    if (Array.isArray(object.enumNames)) {
      this.enumNames = object.enumNames;
    }

    if (Array.isArray(object.required)) {
      this.required = object.required;
    } else {
      this.required = [];
    }

    this.properties = [];

    if (object.properties) {
      Object.entries(object.properties).forEach(([propertyName, property]: [string, any]) => {
        this.properties.push(new SchemaObject(propertyName, property, name));
      });
    }

    if (object.patternProperties) {
      Object.entries(object.patternProperties).forEach(([propertyName, property]: [string, any]) => {
        this.properties.push(new SchemaObject(transformPatternPropertyName(propertyName), property, name));
      });
    }

    if (isObject(object.items)) {
      this.items = new SchemaObject(name + '_items', object.items, this.name);
    }

    if (Array.isArray(object.oneOf) && object.oneOf.length > 0) {
      this.oneOf = object.oneOf.map((item: any) => new SchemaObject(name, item));
    }

    if (Array.isArray(object.allOf) && object.allOf.length > 0) {
      this.allOf = object.allOf.map((item: any) => new SchemaObject(name, item));
    }

    // Crutch
    // if (this.oneOf && this.oneOf.length === 1) {
    //   this.allOf = [this.oneOf[0]];
    //   this.oneOf = undefined;
    // }
  }

  name!: string;
  originalName!: string;
  parentObjectName!: string;

  type!: string | string[];
  readonly description!: string;
  readonly ref!: string;
  required!: string[];
  readonly enum!: Array<string | number>;
  readonly enumNames!: Array<string | number>;
  properties!: SchemaObject[];
  readonly items!: SchemaObject;
  readonly oneOf!: SchemaObject[];
  readonly allOf!: SchemaObject[];

  public setName(name: string) {
    this.name = name;

    if (Array.isArray(this.properties)) {
      this.properties.forEach((property) => property.parentObjectName = name);
    }
  }

  public getTypeString(
    objects: Dictionary<SchemaObject>,
    options: SchemaObjectToTypeOptions = {},
  ): GeneratorResultInterface {
    const { type } = this;

    let codeBlocks: CodeBlocksArray = [];
    let typeString = 'any /* default type */';
    let imports: RefsDictionary = {};
    let description: string | undefined = '';

    if (this.oneOf) {
      const values = this.oneOf.map((oneOfObject) => {
        const { value, imports: newImports } = oneOfObject.getTypeString(objects);
        imports = { ...imports, ...newImports };
        return value;
      });

      typeString = joinOneOfValues(values);
    } else if (type === PropertyType.ARRAY && this.items) {
      let depth = 1;
      let items = this.items;

      // Nested arrays
      while (true) {
        if (items.items) {
          items = items.items;
          depth++;
        } else {
          break;
        }
      }

      if (isString(items.type) && primitiveTypes[items.type]) {
        typeString = primitiveTypes[items.type] + '[]'.repeat(depth);
      } else if (Array.isArray(items.type)) {
        const primitivesTypesArray = resolvePrimitiveTypesArray(items.type);
        if (primitivesTypesArray !== null) {
          typeString = `Array<${primitivesTypesArray}>` + '[]'.repeat(depth);
        }
      } else if (items.ref) {
        const refName = getObjectNameByRef(items.ref);
        const refObject = objects[refName];
        if (!refObject) {
          consoleLogErrorAndExit(`Error, object for "${refName}" ref is not found.`);
        }

        imports[refName] = RefsDictionaryType.NeedImport;
        typeString = getInterfaceName(refName) + '[]'.repeat(depth);
      }
    } else if (this.type) {
      if (isString(this.type)) {
        const primitive = primitiveTypes[this.type];
        if (!primitive) {
          consoleLogErrorAndExit(this.name, `Error, type "${this.type}" is not declared type`);
        }

        typeString = primitive;
      } else if (Array.isArray(type)) {
        const primitivesTypesArray = resolvePrimitiveTypesArray(this.type);
        if (primitivesTypesArray !== null) {
          typeString = primitivesTypesArray;
        }
      }

      if (this.enum) {
        const {
          value,
          codeBlocks: newCodeBlocks,
          description: newDescription,
        } = generateInlineEnum(this, {
          objectParentName: this.parentObjectName,
          skipEnumNamesConstant: options.skipEnumNamesConstant,
        });

        typeString = value;
        codeBlocks = newCodeBlocks;
        description = newDescription;
      }
    } else if (this.ref) {
      const refName = getObjectNameByRef(this.ref);

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
              const { value, imports: newImports } = oneOfObject.getTypeString(objects);
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
}
