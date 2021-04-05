import { Dictionary, ObjectType } from './types';
import { quoteJavaScriptValue, sortArrayAlphabetically, uniqueArray } from './utils';
import { newLineChar } from './constants';
import { getEnumPropertyName, getInterfaceName, getSectionFromObjectName, joinOneOfValues } from './helpers';
import { CodeBlocksArray, GeneratorResultInterface } from './generators/BaseCodeBlock';
import { TypeCodeBlock, TypeScriptCodeTypes } from './generators/TypeCodeBlock';
import { SchemaObject } from './generators/SchemaObject';

export function generateImportsBlock(imports: Dictionary<boolean>, section: string | null, type?: ObjectType): string {
  const objectsToImport = uniqueArray(Object.keys(imports));
  const paths: Dictionary<string[]> = {};

  objectsToImport.forEach((objectName) => {
    const importSection = getSectionFromObjectName(objectName);
    const interfaceName = getInterfaceName(objectName);
    let path;

    if (type === ObjectType.Object) {
      if (section === importSection) {
        path = `./${interfaceName}`;
      } else {
        path = `../${importSection}/${interfaceName}`;
      }
    } else {
      path = `../objects/${importSection}/${interfaceName}`;
    }

    if (!paths[path]) {
      paths[path] = [];
    }
    paths[path].push(interfaceName);
  });

  const importLines: string[] = [];

  sortArrayAlphabetically(Object.keys(paths)).forEach((path) => {
    const interfaces = sortArrayAlphabetically(paths[path]).join(', ');
    importLines.push(`import { ${interfaces} } from '${path}';`);
  });

  return importLines.join(newLineChar);
}

function getEnumNames(object: SchemaObject) {
  let { enumNames } = object;

  const needEnumNamesDescription = !!enumNames;

  if (!enumNames) {
    const canUseEnumNames = !object.enum.some((value) => !!+value);
    if (canUseEnumNames) {
      enumNames = [...object.enum];
    }
  }

  return {
    needEnumNamesDescription,
    enumNames: Array.isArray(enumNames) && enumNames.length ? enumNames : undefined,
  };
}

interface GenerateInlineEnumOptions {
  objectParentName?: string;
  skipEnumNamesConstant?: boolean;
}

export function generateInlineEnum(object: SchemaObject, options: GenerateInlineEnumOptions = {}): GeneratorResultInterface {
  const {
    enumNames,
    needEnumNamesDescription,
  } = getEnumNames(object);

  const codeBlocks: CodeBlocksArray = [];
  let descriptionLines: string[] = [];

  if (enumNames) {
    const enumName = options.objectParentName ? `${options.objectParentName} ${object.name} enumNames` : object.name;
    const enumInterfaceName = getInterfaceName(enumName);

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.ConstantObject,
      refName: enumName,
      interfaceName: enumInterfaceName,
      needExport: true,
      properties: [],
    });

    if (needEnumNamesDescription) {
      descriptionLines.push('');
    }

    enumNames.forEach((name, index) => {
      const value = object.enum[index];

      codeBlock.addProperty({
        name: getEnumPropertyName(name.toString()),
        value,
        wrapValue: true,
      });

      if (needEnumNamesDescription) {
        descriptionLines.push(`\`${value}\` — ${name}`);
      }
    });

    if (!options.skipEnumNamesConstant) {
      codeBlocks.push(codeBlock);
    }
  }

  const values = object.enum.map((value) => quoteJavaScriptValue(value));

  return {
    codeBlocks,
    imports: {},
    value: joinOneOfValues(values, true),
    description: descriptionLines.join(newLineChar),
  };
}

interface GenerateStandaloneEnumOptions {
  objectParentName?: string;
}

export function generateStandaloneEnum(object: SchemaObject, options: GenerateStandaloneEnumOptions = {}): GeneratorResultInterface {
  const {
    enumNames,
  } = getEnumNames(object);

  if (enumNames) {
    const enumName = options.objectParentName ? `${options.objectParentName} ${object.name} enum` : object.name;
    const enumInterfaceName = getInterfaceName(enumName);

    const codeBlock = new TypeCodeBlock({
      type: TypeScriptCodeTypes.Enum,
      refName: enumName,
      interfaceName: enumInterfaceName,
      needExport: true,
      properties: [],
    });

    enumNames.forEach((name, index) => {
      codeBlock.addProperty({
        name: getEnumPropertyName(name.toString()),
        value: object.enum[index],
        wrapValue: true,
      });
    });

    return {
      codeBlocks: [
        codeBlock,
      ],
      imports: {},
      value: enumInterfaceName,
    };
  } else {
    const values = object.enum.map((value) => quoteJavaScriptValue(value));

    return {
      codeBlocks: [],
      imports: {},
      value: joinOneOfValues(values, true),
    };
  }
}
