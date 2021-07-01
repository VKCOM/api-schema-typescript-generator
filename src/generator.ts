import { newLineChar } from './constants';
import { CodeBlocksArray, GeneratorResultInterface } from './generators/BaseCodeBlock';
import { SchemaObject } from './generators/SchemaObject';
import { TypeCodeBlock, TypeScriptCodeTypes } from './generators/TypeCodeBlock';
import { getEnumPropertyName, getInterfaceName, getSectionFromObjectName, joinOneOfValues } from './helpers';
import { Dictionary, ObjectType, RefsDictionary, RefsDictionaryType } from './types';
import { quoteJavaScriptValue, sortArrayAlphabetically, uniqueArray } from './utils';

export function generateImportsBlock(refs: RefsDictionary, section: string | null, type?: ObjectType): string {
  let importRefs = Object.entries(refs)
    .filter(([, type]) => type === RefsDictionaryType.GenerateAndImport)
    .map(([key]) => key);

  importRefs = uniqueArray(importRefs);

  const paths: Dictionary<string[]> = {};
  importRefs.forEach((objectName) => {
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

  const isNumericEnum = object.enum.some((value) => !!+value);
  const needEnumNamesDescription = !!enumNames;

  if (!enumNames) {
    const canUseEnumNames = !isNumericEnum;
    if (canUseEnumNames) {
      enumNames = [...object.enum];
    }
  }

  return {
    isNumericEnum,
    needEnumNamesDescription,
    enumNames: Array.isArray(enumNames) && enumNames.length ? enumNames : undefined,
  };
}

interface GenerateInlineEnumOptions {
  objectParentName?: string;
  needEnumNamesConstant?: boolean;
  refName?: string;
}

export function generateInlineEnum(object: SchemaObject, options: GenerateInlineEnumOptions = {}): GeneratorResultInterface {
  const {
    isNumericEnum,
    enumNames,
    needEnumNamesDescription,
  } = getEnumNames(object);

  options = {
    needEnumNamesConstant: true,
    ...options,
  };

  const imports: RefsDictionary = {};
  const codeBlocks: CodeBlocksArray = [];
  let descriptionLines: string[] = [];

  if (enumNames) {
    if (needEnumNamesDescription) {
      if (isNumericEnum && options.refName) {
        imports[options.refName] = RefsDictionaryType.Generate;

        descriptionLines.push('');
        descriptionLines.push('@note This enum have auto-generated constant with keys and values');
        descriptionLines.push(`@see ${getInterfaceName(options.refName)}`);
      }

      descriptionLines.push('');

      enumNames.forEach((name, index) => {
        const value = object.enum[index];

        if (needEnumNamesDescription) {
          descriptionLines.push(`\`${value}\` — ${name}`);
        }
      });
    }

    if (options.needEnumNamesConstant) {
      const enumName = options.objectParentName ? `${options.objectParentName} ${object.name} enumNames` : object.name;
      const enumInterfaceName = getInterfaceName(enumName);

      const codeBlock = new TypeCodeBlock({
        type: TypeScriptCodeTypes.ConstantObject,
        refName: enumName,
        interfaceName: enumInterfaceName,
        needExport: true,
        properties: [],
      });

      enumNames.forEach((name, index) => {
        const value = object.enum[index];

        codeBlock.addProperty({
          name: getEnumPropertyName(name.toString()),
          value,
          wrapValue: true,
        });
      });

      codeBlocks.push(codeBlock);
    }
  }

  const values = object.enum.map((value) => quoteJavaScriptValue(value));

  return {
    codeBlocks,
    imports,
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
      type: TypeScriptCodeTypes.ConstantObject,
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
