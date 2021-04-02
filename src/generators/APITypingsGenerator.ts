import {
  Dictionary,
  JSONSchemaMethodInfoInterface,
  JSONSchemaMethodsDefinitionsInterface,
  ObjectType,
  RefsDictionary,
} from '../types';
import { SchemaObject } from './SchemaObject';
import {
  createImportsBlock,
  getInterfaceName, getMethodSection, getObjectNameByRef,
  getSectionFromObjectName, isMethodNeeded, isPatternProperty, prepareBuildDirectory,
  prepareMethodsPattern,
  writeFile,
} from '../helpers';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import { TypeCodeBlock, TypeScriptCodeTypes } from './TypeCodeBlock';
import { arrayToMap, isObject, sortArrayAlphabetically, uniqueArray } from '../utils';
import {
  baseAPIParamsInterfaceName,
  baseBoolIntRef,
  baseOkResponseRef,
  basePropertyExistsRef, DEFAULT_API_VERSION,
  newLineChar,
} from '../constants';
import path from 'path';
import { CommentCodeBlock } from './CommentCodeBlock';
import { consoleLogError, consoleLogErrorAndExit, consoleLogInfo } from '../log';
import { generateStandaloneEnum } from '../generator';

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

  methodsDefinitions: JSONSchemaMethodsDefinitionsInterface;
  objects: Dictionary<SchemaObject>;
  responses: Dictionary<SchemaObject>;
}

export class APITypingsGenerator {
  constructor(options: APITypingsGeneratorOptions) {
    this.needEmit = options.needEmit;
    this.outDirPath = options.outDirPath;
    this.methodsPattern = prepareMethodsPattern(options.methodsPattern);

    this.methodsDefinitions = options.methodsDefinitions;
    this.methodsList = options.methodsDefinitions.methods;
    this.objects = this.convertJSONSchemaDictionary(options.objects);
    this.responses = this.convertJSONSchemaDictionary(options.responses);

    this.visitedRefs = {};
    this.generatedObjects = {};

    this.methodFilesMap = {};
    this.exports = {};

    this.ignoredResponses = {
      'storage.get': {
        'keysResponse': true,
      },
    };

    this.resultFiles = {};
  }

  needEmit!: APITypingsGeneratorOptions['needEmit'];
  outDirPath!: APITypingsGeneratorOptions['outDirPath'];
  methodsPattern!: Dictionary<boolean>;

  methodsDefinitions!: JSONSchemaMethodsDefinitionsInterface;
  methodsList!: JSONSchemaMethodsDefinitionsInterface['methods'];
  objects!: Dictionary<SchemaObject>;
  responses!: Dictionary<SchemaObject>;

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

  private appendToFileMap(section: string, imports: Dictionary<boolean>, codeBlocks: CodeBlocksArray) {
    const methodFile = this.methodFilesMap[section] || {
      imports: {},
      codeBlocks: [],
    };

    this.methodFilesMap[section] = {
      imports: {
        ...methodFile.imports,
        ...imports,
      },
      codeBlocks: [
        ...methodFile.codeBlocks,
        ...codeBlocks,
      ],
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
        const objectName = getObjectNameByRef(refName);
        allOfItem = this.objects[objectName];

        if (!allOfItem) {
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
          const objectName = getObjectNameByRef(allOfItem.ref);
          const refObject = this.objects[objectName];

          if (!refObject) {
            consoleLogErrorAndExit(`${object.name} ref object in allOf is not found`);
          }

          additionalProperties = this.getObjectProperties(refObject, deep + 1);
        }

        if (additionalProperties.length) {
          properties = [
            ...properties,
            ...additionalProperties,
          ];
        }
      });
    }

    if (deep === 0) {
      return this.filterObjectProperties(properties);
    } else {
      return properties;
    }
  }

  /*
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
    let imports: Dictionary<boolean> = {};
    let codeBlocks: CodeBlocksArray = [];

    const properties = this.getObjectProperties(object);
    const requiredProperties = arrayToMap(object.required);

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
      } = property.getTypeString(this.objects);

      imports = { ...imports, ...newImports };
      codeBlocks = [...codeBlocks, ...newCodeBlocks];

      codeBlock.addProperty({
        name: property.name,
        description: [property.description, description].join(newLineChar),
        value,
        isRequired: isPatternProperty(property.name) || requiredProperties[property.name],
      });
    });

    return {
      codeBlocks: [
        ...codeBlocks,
        codeBlock,
      ],
      imports,
      value: '',
    };
  }

  private getPrimitiveInterfaceCode(object: SchemaObject): GeneratorResultInterface | false {
    if (object.type === 'array' || object.oneOf) {
      return this.getObjectCodeBlockAsType(object);
    }

    if (object.enum) {
      const { codeBlocks } = generateStandaloneEnum(object);

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

    if (!object.type && object.ref) {
      result = this.getPrimitiveInterfaceCode(object);
    }

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

    if (!result) {
      consoleLogErrorAndExit('empty object result', object);
      return;
    }

    const { codeBlocks, imports } = result;
    const stringCodeBlocks = codeBlocks.map((codeBlock) => codeBlock.toString());

    const section = getSectionFromObjectName(object.name);

    delete imports[object.name];
    stringCodeBlocks.unshift(createImportsBlock(imports, section, ObjectType.Object));

    if (stringCodeBlocks.length > 0) {
      const code = stringCodeBlocks.join(newLineChar.repeat(2));
      this.registerResultFile(path.join('objects', section, `${getInterfaceName(object.name)}.ts`), code);
    }

    codeBlocks.forEach((codeBlock) => {
      if (codeBlock instanceof TypeCodeBlock && codeBlock.needExport && codeBlock.interfaceName) {
        this.registerExport(`./objects/${section}/${getInterfaceName(object.name)}.ts`, codeBlock.interfaceName);
      }
    });

    this.generateObjectsFromImports(imports);
  }

  private generateObjectsFromRefs(refs: RefsDictionary): void {
    Object.keys(refs).forEach((ref) => {
      const refName = getObjectNameByRef(ref);
      const refObject = this.objects[refName];
      if (!refObject) {
        consoleLogInfo(`"${ref}" ref is not found`);
        return;
      }

      this.generateObject(refObject);
    });
  }

  private generateObjectsFromImports(imports: Dictionary<boolean>) {
    Object.keys(imports).forEach((ref) => {
      const refName = getObjectNameByRef(ref);
      const refObject = this.objects[refName];
      if (!refObject) {
        consoleLogInfo(`"${ref}" ref is not found`);
        return;
      }

      this.generateObject(refObject);
    });
  }

  private generateMethodParams(methodInfo: JSONSchemaMethodInfoInterface) {
    const section = getMethodSection(methodInfo.name);
    const interfaceName = `${methodInfo.name} params`;

    const parametersRaw = Array.isArray(methodInfo.parameters) ? methodInfo.parameters : [];
    const requiredParams = parametersRaw.reduce<Dictionary<boolean>>((acc, param) => {
      if (param.required) {
        acc[param.name] = true;
      }
      return acc;
    }, {});

    const properties = parametersRaw.map((paramRaw) => {
      paramRaw = { ...paramRaw };

      // For method params "boolean" type means 1 or 0
      // Real "false" boolean value will be detected by API as true
      if (paramRaw.type === 'boolean') {
        delete paramRaw.type;
        paramRaw.$ref = baseBoolIntRef;
      }

      // For parameters of the "array" type, VK API still accepts only a comma-separated string
      // This may change in the future when the VK API starts accepting a json body
      if (paramRaw.type === 'array') {
        paramRaw.type = 'string';

        if (!paramRaw.description) {
          paramRaw.description = '';
        }

        if (paramRaw.items) {
          if (paramRaw.items.$ref) {
            this.generateObjectsFromRefs({
              [paramRaw.items.$ref]: true,
            });

            paramRaw.description += newLineChar.repeat(2) + paramRaw.items.$ref;
          }
        }
      }

      return new SchemaObject(paramRaw.name, paramRaw, interfaceName);
    });

    let imports: Dictionary<boolean> = {};
    let codeBlocks: CodeBlocksArray = [];

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.Interface,
      interfaceName: getInterfaceName(interfaceName),
      needExport: true,
      allowEmptyInterface: true,
      properties: [],
    });

    properties.forEach((property) => {
      const {
        imports: newImports,
        value,
        codeBlocks: newCodeBlocks,
      } = property.getTypeString(this.objects, { skipEnumNamesConstant: true });

      imports = { ...imports, ...newImports };
      codeBlocks = [...codeBlocks, ...newCodeBlocks];

      codeBlock.addProperty({
        name: property.name,
        description: property.description,
        value,
        isRequired: requiredParams[property.name],
      });
    });

    this.appendToFileMap(section, imports, [...codeBlocks, codeBlock]);
    this.generateObjectsFromImports(imports);
  }

  private getResponseObjectRef(object: SchemaObject): SchemaObject | undefined {
    const objectName = getObjectNameByRef(object.ref);

    if (this.responses[objectName]) {
      return this.responses[objectName];
    } else if (this.objects[objectName]) {
      return this.objects[objectName];
    }

    return undefined;
  }

  private getObjectCodeBlockAsType(object: SchemaObject): GeneratorResultInterface | false {
    let codeBlocks: CodeBlocksArray = [];
    let imports: Dictionary<boolean> = {};

    if (object.enum) {
      const { codeBlocks: newCodeBlocks } = generateStandaloneEnum(object);
      codeBlocks = [
        ...newCodeBlocks,
      ];
    } else {
      const { imports: newImports, value, codeBlocks: newCodeBlocks } = object.getTypeString(this.objects);
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
      codeBlocks = [
        ...codeBlocks,
        ...newCodeBlocks,
        codeBlock,
      ];
    }

    return {
      codeBlocks,
      imports,
      value: '',
    };
  }

  private getResponseCodeBlockAsType(object: SchemaObject, response: SchemaObject): GeneratorResultInterface | false {
    let codeBlocks: CodeBlocksArray = [];
    let imports: Dictionary<boolean> = {};

    if (response.enum) {
      const { codeBlocks: newCodeBlocks } = generateStandaloneEnum(response);
      codeBlocks = [
        ...newCodeBlocks,
      ];
    } else {
      const { imports: newImports, value, codeBlocks: newCodeBlocks } = response.getTypeString(this.objects);
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
      codeBlocks = [
        ...codeBlocks,
        ...newCodeBlocks,
        codeBlock,
      ];
    }

    return {
      codeBlocks,
      imports,
      value: '',
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
    let response: SchemaObject | undefined;

    if (nonBuildableRefs[objectName]) {
      return this.getObjectCodeBlockAsType(object);
    } else if (this.responses[objectName]) {
      response = this.responses[objectName];

      const { properties = [] } = response;
      const responseProperty = properties.find((property) => property.name === 'response');

      if (responseProperty) {
        response = responseProperty;
        if (response.ref) {
          return this.getResponseCodeBlockAsType(object, response);
        }
      } else {
        // Maybe this is a crutch?
        response.properties.forEach((property) => {
          if (response && property.parentObjectName === response.name) {
            response = property;
            return true;
          }

          return false;
        });
      }
    } else if (this.objects[objectName]) {
      response = this.objects[objectName];

      if (object.ref) {
        return this.getResponseCodeBlockAsType(object, object);
      }
    }

    // @ts-ignore
    while (response && response.ref) {
      response = this.getResponseObjectRef(response);
    }

    if (!response) {
      consoleLogErrorAndExit(`"${object.name}" has no response`);
      return false;
    }

    response.originalName = response.name;
    response.setName(object.name);

    let result: GeneratorResultInterface | false;

    switch (response.type) {
      case 'object':
        result = this.getObjectInterfaceCode(response);
        break;

      case 'integer':
      case 'string':
      case 'boolean':
      case 'array':
        return this.getResponseCodeBlockAsType(object, response);

      default:
        consoleLogErrorAndExit(response.name, 'unknown type');
        return false;
    }

    return result;
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

  private generateMethodParamsAndResponses(methodInfo: JSONSchemaMethodInfoInterface) {
    const { name } = methodInfo;
    const section = getMethodSection(name);

    if (!isObject(methodInfo.responses)) {
      consoleLogErrorAndExit(`"${name}" "responses" field is not an object.`);
      return;
    }

    if (Object.keys(methodInfo.responses).length === 0) {
      consoleLogErrorAndExit(`"${name}" "responses" field is empty.`);
      return;
    }

    // Comment with method name for visual sections in file
    const methodNameComment = new CommentCodeBlock([name]);
    if (methodInfo.description) {
      methodNameComment.appendLines([
        '',
        methodInfo.description,
      ]);
    }
    this.appendToFileMap(section, {}, [methodNameComment]);

    this.generateMethodParams(methodInfo);

    Object.entries(methodInfo.responses).forEach(([responseName, responseObject]) => {
      if (this.ignoredResponses[name] && this.ignoredResponses[name][responseName]) {
        return;
      }

      responseObject.name = `${name}_${responseName}`;
      this.generateResponse(section, new SchemaObject(responseObject.name, responseObject));
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
      const code = [
        createImportsBlock(imports, null),
        ...codeBlocks,
      ];

      this.registerResultFile(path.join('methods', `${section}.ts`), code.join(newLineChar.repeat(2)));
    });
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
