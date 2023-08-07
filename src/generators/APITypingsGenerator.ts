import * as Schema from '../types/schema';
import { Dictionary, ObjectType, RefsDictionary } from '../types';
import { generateEnumAsUnionType } from './enums';
import { normalizeMethodInfo } from './methods';
import { SchemaObject } from './SchemaObject';
import {
  getInterfaceName,
  getMethodSection,
  getObjectNameByRef,
  getSectionFromObjectName,
  isMethodNeeded,
  isPatternProperty,
  prepareBuildDirectory,
  prepareMethodsPattern,
  writeFile,
} from '../helpers';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import { TypeCodeBlock, TypeScriptCodeTypes } from './TypeCodeBlock';
import { isObject, sortArrayAlphabetically, uniqueArray } from '../utils';
import {
  baseAPIParamsInterfaceName,
  baseBoolIntRef,
  baseOkResponseRef,
  basePropertyExistsRef,
  DEFAULT_API_VERSION,
  newLineChar,
} from '../constants';
import path from 'path';
import { CommentCodeBlock } from './CommentCodeBlock';
import { consoleLogError, consoleLogErrorAndExit, consoleLogInfo } from '../log';
import { generateImportsBlock } from '../generator';
import { generateTypeString } from './typeString';
import { ErrorInterface } from '../types/schema';
import { mergeImports } from './utils/mergeImports';

interface APITypingsGeneratorOptions {
  needEmit: boolean;

  /**
   * Path for generated typings
   */
  outDirPath: string;
  /**
   * List of methods to generate responses and all needed objects
   * "*" to generate all responses and objects
   *
   * For example: "messages.*, users.get, groups.isMember"
   */
  methodsPattern: string;

  methodsDefinitions: Schema.API;
  objects: Dictionary<SchemaObject>;
  responses: Dictionary<SchemaObject>;
  errors: Dictionary<ErrorInterface>;
}

export class APITypingsGenerator {
  constructor(options: APITypingsGeneratorOptions) {
    this.needEmit = options.needEmit;
    this.outDirPath = options.outDirPath;
    this.methodsPattern = prepareMethodsPattern(options.methodsPattern);

    this.methodsDefinitions = options.methodsDefinitions;
    this.methodsList = options.methodsDefinitions.methods || [];
    this.objects = this.convertJSONSchemaDictionary(options.objects);
    this.responses = this.convertJSONSchemaDictionary(options.responses);
    this.errors = options.errors;

    this.visitedRefs = {};
    this.generatedObjects = {};

    this.methodFilesMap = {};
    this.exports = {};

    this.ignoredResponses = {
      'storage.get': {
        keysResponse: true,
      },
    };

    this.resultFiles = {};
  }

  needEmit!: APITypingsGeneratorOptions['needEmit'];
  outDirPath!: APITypingsGeneratorOptions['outDirPath'];
  methodsPattern!: Dictionary<boolean>;

  methodsDefinitions!: Schema.API;
  methodsList!: NonNullable<Schema.API['methods']>;
  objects!: Dictionary<SchemaObject>;
  responses!: Dictionary<SchemaObject>;
  errors!: Dictionary<ErrorInterface>;

  visitedRefs!: Dictionary<boolean>;
  generatedObjects!: Dictionary<boolean>;

  methodFilesMap!: Dictionary<Omit<GeneratorResultInterface, 'value'>>;
  exports!: Dictionary<Dictionary<boolean>>;

  ignoredResponses!: Dictionary<Dictionary<boolean>>;

  resultFiles!: Dictionary<string>;

  private convertJSONSchemaDictionary(objects: any) {
    const dictionary: Dictionary<SchemaObject> = {};
    Object.keys(objects).forEach((name: string) => {
      dictionary[name] = new SchemaObject(name, objects[name]);
    });
    return dictionary;
  }

  private registerExport(path: string, name: string) {
    const pathExports: Dictionary<boolean> = this.exports[path] || {};

    this.exports = {
      ...this.exports,
      [path]: {
        ...pathExports,
        [name]: true,
      },
    };
  }

  private registerResultFile(path: string, content: string) {
    this.resultFiles[path] = content;
  }

  private appendToFileMap(section: string, imports: RefsDictionary, codeBlocks: CodeBlocksArray) {
    const methodFile = this.methodFilesMap[section] || {
      imports: {},
      codeBlocks: [],
    };

    this.methodFilesMap[section] = {
      imports: mergeImports(methodFile.imports, imports),
      codeBlocks: [...methodFile.codeBlocks, ...codeBlocks],
    };
  }

  collectAllOf(object: SchemaObject, deep = 0): SchemaObject[] {
    if (!object.allOf) {
      return [];
    }

    if (deep === 0) {
      this.visitedRefs = {};
    }

    let allOf: SchemaObject[] = [];

    object.allOf.forEach((allOfItem) => {
      if (allOfItem.ref && !this.visitedRefs[allOfItem.ref]) {
        this.visitedRefs[allOfItem.ref] = true;
        const refName = allOfItem.ref;

        const tempAllOfItem = this.getObjectByRef(refName);
        if (tempAllOfItem) {
          allOfItem = tempAllOfItem;
        } else {
          consoleLogErrorAndExit(`${refName} ref not found`);
        }
      }

      if (allOfItem.allOf) {
        allOf = [...allOf, ...this.collectAllOf(allOfItem, deep + 1)];
      } else {
        allOf.push(allOfItem);
      }
    });

    return allOf;
  }

  getObjectProperties(object: SchemaObject, deep = 0): SchemaObject[] {
    let properties = object.properties || [];

    if (object.allOf) {
      this.collectAllOf(object).forEach((allOfItem) => {
        object.required = uniqueArray([...object.required, ...allOfItem.required]);

        let additionalProperties: SchemaObject[] = [];

        if (allOfItem.properties) {
          additionalProperties = allOfItem.properties;
        } else if (allOfItem.ref) {
          const refObject = this.getObjectByRef(allOfItem.ref);
          if (!refObject) {
            consoleLogErrorAndExit(`${object.name} ref object in allOf is not found`);
            return;
          }

          additionalProperties = this.getObjectProperties(refObject, deep + 1);
        }

        if (additionalProperties.length) {
          properties = [...properties, ...additionalProperties];
        }
      });
    }

    if (deep === 0) {
      return this.filterObjectProperties(properties);
    } else {
      return properties;
    }
  }

  /**
   * Filter properties with same name
   * If an object uses allOf, some nested objects may have the same properties
   */
  private filterObjectProperties(properties: SchemaObject[]): SchemaObject[] {
    const propertyNames: Dictionary<true> = {};

    return properties.filter((property) => {
      if (propertyNames[property.name]) {
        return false;
      } else {
        propertyNames[property.name] = true;
        return true;
      }
    });
  }

  private getObjectInterfaceCode(object: SchemaObject): GeneratorResultInterface | false {
    let imports: RefsDictionary = {};
    let codeBlocks: CodeBlocksArray = [];

    const properties = this.getObjectProperties(object);

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.Interface,
      refName: object.name,
      interfaceName: getInterfaceName(object.name),
      needExport: true,
      description: object.oneOf ? 'Object has oneOf' : '',
      properties: [],
    });

    if (object.oneOf) {
      return this.getPrimitiveInterfaceCode(object);
    }

    properties.forEach((property) => {
      const {
        imports: newImports,
        value,
        codeBlocks: newCodeBlocks,
        description,
      } = generateTypeString(property, this.objects, {
        objectParentName: object.name,
      });

      imports = mergeImports(imports, newImports);
      codeBlocks = [...codeBlocks, ...newCodeBlocks];

      codeBlock.addProperty({
        name: property.name,
        description: [property.description, description].join(newLineChar),
        value,
        isRequired: isPatternProperty(property.name) || property.isRequired,
      });
    });

    return {
      codeBlocks: [...codeBlocks, codeBlock],
      imports,
      value: '',
    };
  }

  private getPrimitiveInterfaceCode(object: SchemaObject): GeneratorResultInterface | false {
    if (object.type === 'array' || object.oneOf) {
      return this.getObjectCodeBlockAsType(object);
    }

    if (object.enum) {
      const { codeBlocks } = generateEnumAsUnionType(object);

      return {
        codeBlocks: codeBlocks,
        imports: {},
        value: '',
      };
    } else {
      return this.getObjectCodeBlockAsType(object);
    }
  }

  private generateObject(object: SchemaObject) {
    if (this.generatedObjects[object.name]) {
      return;
    }
    this.generatedObjects[object.name] = true;

    let result: GeneratorResultInterface | false = false;

    if (object.ref && object.type === 'object') {
      result = this.getPrimitiveInterfaceCode(object);
    } else {
      switch (object.type) {
        case 'object':
          result = this.getObjectInterfaceCode(object);
          break;

        case 'string':
        case 'number':
        case 'integer':
        case 'array':
        case 'boolean':
          result = this.getPrimitiveInterfaceCode(object);
          break;

        default:
          if (!result) {
            consoleLogErrorAndExit(getInterfaceName(object.name), 'Unknown type of object', object);
          }
      }
    }

    if (!result) {
      consoleLogErrorAndExit('empty object result', object);
      return;
    }

    const { codeBlocks, imports } = result;
    const stringCodeBlocks = codeBlocks.map((codeBlock) => codeBlock.toString());

    const section = getSectionFromObjectName(object.name);

    delete imports[object.name];
    stringCodeBlocks.unshift(generateImportsBlock(imports, section, ObjectType.Object));

    if (stringCodeBlocks.length > 0) {
      const code = stringCodeBlocks.join(newLineChar.repeat(2));
      this.registerResultFile(
        path.join('objects', section, `${getInterfaceName(object.name)}.ts`),
        code,
      );
    }

    codeBlocks.forEach((codeBlock) => {
      if (codeBlock instanceof TypeCodeBlock && codeBlock.needExport && codeBlock.interfaceName) {
        this.registerExport(
          `./objects/${section}/${getInterfaceName(object.name)}.ts`,
          codeBlock.interfaceName,
        );
      }
    });

    this.generateObjectsFromImports(imports);
  }

  private getObjectByRef(ref: string): SchemaObject | undefined {
    const refName = getObjectNameByRef(ref);
    return this.objects[refName];
  }

  private generateObjectsFromRefs(refs: RefsDictionary): void {
    Object.keys(refs).forEach((ref) => {
      const refObject = this.getObjectByRef(ref);
      if (!refObject) {
        consoleLogInfo(`"${ref}" ref is not found`);
        return;
      }

      this.generateObject(refObject);
    });
  }

  private generateObjectsFromImports(imports: RefsDictionary) {
    Object.keys(imports).forEach((ref) => {
      const refObject = this.getObjectByRef(ref);
      if (!refObject) {
        consoleLogInfo(`"${ref}" ref is not found`);
        return;
      }

      this.generateObject(refObject);
    });
  }

  private generateMethodParams(methodInfo: SchemaObject) {
    const section = getMethodSection(methodInfo.name);
    const interfaceName = `${methodInfo.name} params`;

    let imports: RefsDictionary = {};
    let codeBlocks: CodeBlocksArray = [];

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.Interface,
      interfaceName: getInterfaceName(interfaceName),
      needExport: true,
      allowEmptyInterface: true,
      properties: [],
    });

    methodInfo.parameters.forEach((property) => {
      const {
        imports: newImports,
        value,
        codeBlocks: newCodeBlocks,
      } = generateTypeString(property, this.objects, {
        needEnumNamesConstant: false,
      });

      imports = mergeImports(imports, newImports);
      codeBlocks = [...codeBlocks, ...newCodeBlocks];

      codeBlock.addProperty({
        name: property.name,
        description: property.description,
        value,
        isRequired: property.isRequired,
      });
    });

    this.appendToFileMap(section, imports, [...codeBlocks, codeBlock]);
    this.generateObjectsFromImports(imports);
  }

  private getResponseObjectRef(ref: string): SchemaObject | undefined {
    const objectName = getObjectNameByRef(ref);

    if (this.responses[objectName]) {
      return this.responses[objectName];
    }

    return this.getObjectByRef(ref);
  }

  private getObjectCodeBlockAsType(object: SchemaObject): GeneratorResultInterface | false {
    let codeBlocks: CodeBlocksArray = [];
    let imports: RefsDictionary = {};

    if (object.enum) {
      const { codeBlocks: newCodeBlocks } = generateEnumAsUnionType(object);
      codeBlocks = [...newCodeBlocks];
    } else {
      const {
        imports: newImports,
        value,
        codeBlocks: newCodeBlocks,
      } = generateTypeString(object, this.objects);
      const codeBlock = new TypeCodeBlock({
        type: TypeScriptCodeTypes.Type,
        refName: object.name,
        interfaceName: getInterfaceName(object.name),
        description: object.description,
        needExport: true,
        properties: [],
        value,
      });

      imports = newImports;
      codeBlocks = [...codeBlocks, ...newCodeBlocks, codeBlock];
    }

    return {
      codeBlocks,
      imports,
      value: '',
    };
  }

  private getResponseCodeBlockAsType(
    object: SchemaObject,
    response: SchemaObject,
  ): GeneratorResultInterface | false {
    const { imports, value, codeBlocks, description } = generateTypeString(response, this.objects, {
      objectParentName: ' ', // TODO: Refactor
    });

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.Type,
      refName: object.name,
      interfaceName: getInterfaceName(object.name),
      description: [object.description, description || ''].join(newLineChar),
      needExport: true,
      properties: [],
      value,
    });

    return {
      codeBlocks: [...codeBlocks, codeBlock],
      imports,
      value: '',
      description,
    };
  }

  private getResponseCodeBlock(object: SchemaObject): GeneratorResultInterface | false {
    if (!object.ref) {
      consoleLogError(`response schema object "${object.name}" has no ref`, object);
      return false;
    }

    const nonBuildableRefs: Dictionary<boolean> = {
      [baseBoolIntRef]: true,
      [baseOkResponseRef]: true,
      [basePropertyExistsRef]: true,
    };

    const objectName = getObjectNameByRef(object.ref);
    if (nonBuildableRefs[objectName]) {
      return this.getObjectCodeBlockAsType(object);
    }

    let response = this.getResponseObjectRef(object.ref);
    if (!response) {
      consoleLogError(`response schema object "${object.name}" has no response`, object);
      return false;
    }

    // VK API JSON Schema specific heuristic
    if (response.properties.length === 1 && response.properties[0].name === 'response') {
      response = response.properties[0];
    }

    if (response.ref) {
      return this.getResponseCodeBlockAsType(object, response);
    }

    response = response.clone();
    response.setName(object.name);

    switch (response.type) {
      case 'object':
        return this.getObjectInterfaceCode(response);

      case 'integer':
      case 'string':
      case 'boolean':
      case 'array':
        return this.getResponseCodeBlockAsType(object, response);

      default:
        consoleLogErrorAndExit(response.name, 'unknown type', response.type);
        return false;
    }
  }

  public generateResponse(section: string, response: SchemaObject) {
    const result = this.getResponseCodeBlock(response);
    if (!result) {
      return;
    }

    const { codeBlocks, imports } = result;

    this.appendToFileMap(section, imports, codeBlocks);
    this.generateObjectsFromImports(imports);
  }

  private generateMethodParamsAndResponses(method: Schema.Method) {
    const { name: methodName } = method;
    const section = getMethodSection(methodName);

    if (!isObject(method.responses)) {
      consoleLogErrorAndExit(`"${methodName}" "responses" field is not an object.`);
      return;
    }

    if (Object.keys(method.responses).length === 0) {
      consoleLogErrorAndExit(`"${methodName}" "responses" field is empty.`);
      return;
    }

    // Comment with method name for visual sections in file
    const methodNameComment = new CommentCodeBlock([methodName]);
    if (method.description) {
      methodNameComment.appendLines(['', method.description]);
    }
    this.appendToFileMap(section, {}, [methodNameComment]);

    const { method: normalizedMethod, parameterRefs } = normalizeMethodInfo(method);

    method = normalizedMethod;
    this.generateObjectsFromRefs(parameterRefs);

    this.generateMethodParams(new SchemaObject(method.name, method));

    Object.entries(method.responses).forEach(([responseName, responseObject]) => {
      if (this.ignoredResponses[methodName] && this.ignoredResponses[methodName][responseName]) {
        return;
      }

      const name = `${methodName}_${responseName}`;
      this.generateResponse(section, new SchemaObject(name, responseObject));
    });
  }

  private generateMethods() {
    consoleLogInfo('creating method params and responses...');

    this.methodsList.forEach((methodInfo) => {
      if (isMethodNeeded(this.methodsPattern, methodInfo.name)) {
        this.generateMethodParamsAndResponses(methodInfo);
      }
    });

    Object.keys(this.methodFilesMap).forEach((section) => {
      const { imports, codeBlocks } = this.methodFilesMap[section];
      codeBlocks.forEach((codeBlock) => {
        if (codeBlock instanceof TypeCodeBlock && codeBlock.needExport && codeBlock.interfaceName) {
          this.registerExport(`./methods/${section}`, codeBlock.interfaceName);
        }
      });
      const code = [generateImportsBlock(imports, null), ...codeBlocks];

      this.registerResultFile(
        path.join('methods', `${section}.ts`),
        code.join(newLineChar.repeat(2)),
      );
    });
  }

  private generateErrors() {
    consoleLogInfo('creating errors...');

    const code: string[] = [];

    Object.entries(this.errors)
      .reduce<Array<ErrorInterface & { name: string }>>((acc, [name, error]) => {
        acc.push({ name, ...error });
        return acc;
      }, [])
      .sort((errorA, errorB) => {
        return errorA.code - errorB.code;
      })
      .forEach((error) => {
        const errorConstantName = error.name.toUpperCase();

        code.push(
          new TypeCodeBlock({
            type: TypeScriptCodeTypes.Const,
            interfaceName: errorConstantName,
            needExport: true,
            value: String(error.code),
            properties: [],
            description: [error.description, error.$comment || ''].join(newLineChar.repeat(2)),
          }).toString(),
        );

        this.registerExport('./common/errors', errorConstantName);
      });

    this.registerResultFile(path.join('common', 'errors.ts'), code.join(newLineChar.repeat(2)));
  }

  private createCommonTypes() {
    consoleLogInfo('creating common types...');
    const code: string[] = [];

    const apiVersion = this.methodsDefinitions.version || DEFAULT_API_VERSION;
    code.push(`export const API_VERSION = '${apiVersion}'`);

    code.push('export type ValueOf<T> = T[keyof T];');

    code.push(
      new TypeCodeBlock({
        type: TypeScriptCodeTypes.Interface,
        interfaceName: getInterfaceName(baseAPIParamsInterfaceName),
        needExport: true,
        properties: [
          {
            name: 'v',
            value: 'string',
            isRequired: true,
          },
          {
            name: 'access_token',
            value: 'string',
            isRequired: true,
          },
          {
            name: 'lang',
            value: 'number',
          },
          {
            name: 'device_id',
            value: 'string',
          },
        ],
      }).toString(),
    );

    this.registerExport('./common/common', 'API_VERSION');
    this.registerExport('./common/common', getInterfaceName(baseAPIParamsInterfaceName));
    this.registerResultFile(path.join('common', 'common.ts'), code.join(newLineChar.repeat(2)));
  }

  /**
   * This method creates index.ts file with exports of all generated params, responses and objects
   */
  private createIndexExports() {
    consoleLogInfo('creating index.ts exports...');

    const blocks: string[] = [];
    let exportedObjects: Dictionary<boolean> = {};

    sortArrayAlphabetically(Object.keys(this.exports)).forEach((path) => {
      const objects = Object.keys(this.exports[path]);
      if (!objects.length) {
        return;
      }

      const blockLines: string[] = [];

      blockLines.push('export {');
      sortArrayAlphabetically(objects).forEach((object) => {
        if (exportedObjects[object]) {
          return;
        }
        blockLines.push(`  ${object},`);
        exportedObjects[object] = true;
      });
      blockLines.push(`} from '${path.replace('.ts', '')}';`);

      blocks.push(blockLines.join(newLineChar));
    });

    this.registerResultFile('index.ts', blocks.join(newLineChar.repeat(2)));
    consoleLogInfo(`${Object.keys(exportedObjects).length} objects successfully generated`);
  }

  public generate() {
    consoleLogInfo('generate');

    this.generateMethods();
    this.generateErrors();

    if (this.needEmit) {
      this.createCommonTypes();
      this.createIndexExports();

      consoleLogInfo('prepare out directory');
      prepareBuildDirectory(this.outDirPath);

      consoleLogInfo('write files');
      Object.keys(this.resultFiles).forEach((filePath) => {
        const fileContent = this.resultFiles[filePath];
        writeFile(path.join(this.outDirPath, filePath), fileContent);
      });
    }
  }
}
