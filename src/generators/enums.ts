import { newLineChar } from '../constants';
import { getEnumPropertyName, getInterfaceName, joinOneOfValues } from '../helpers';
import { RefsDictionaryType } from '../types';
import { quoteJavaScriptValue } from '../utils';
import { CodeBlocksArray, GeneratorResultInterface } from './BaseCodeBlock';
import { SchemaObject } from './SchemaObject';
import { TypeCodeBlock, TypeScriptCodeTypes } from './TypeCodeBlock';

export function isNumericEnum(object: SchemaObject): boolean {
  return object.enum.some((value) => !!+value);
}

export function getEnumNamesIdentifier(name: string) {
  if (!name) {
    throw new Error('[getEnumNamesIdentifier] empty name');
  }

  return `${name} enumNames`.trim();
}

export function generateEnumConstantObject(object: SchemaObject, objectName: string, enumNames: Array<string | number>) {
  const enumInterfaceName = getInterfaceName(objectName);

  const codeBlock = new TypeCodeBlock({
    type: TypeScriptCodeTypes.ConstantObject,
    refName: objectName,
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

  return codeBlock;
}

/**
 * Generates enum as union type with constant object if necessary
 */
export function generateEnumAsUnionType(object: SchemaObject): GeneratorResultInterface {
  const { codeBlocks, value, description } = generateInlineEnum(object, {
    refName: getEnumNamesIdentifier(object.name),
  });

  const unionType = new TypeCodeBlock({
    type: TypeScriptCodeTypes.Type,
    refName: object.name,
    interfaceName: getInterfaceName(object.name),
    description: [
      object.description,
      description,
    ].join(newLineChar),
    needExport: true,
    properties: [],
    value,
  });

  codeBlocks.push(unionType);

  return {
    codeBlocks,
    imports: {},
    value: '',
  };
}

function getEnumNames(object: SchemaObject) {
  let { enumNames } = object;

  const isNumeric = isNumericEnum(object);
  const needEnumNamesDescription = !!enumNames;

  if (!enumNames) {
    const canUseEnumNames = !isNumeric;
    if (canUseEnumNames) {
      enumNames = [...object.enum];
    }
  }

  return {
    isNumericEnum: isNumeric,
    needEnumNamesDescription,
    enumNames: Array.isArray(enumNames) && enumNames.length ? enumNames : undefined,
  };
}

interface GenerateInlineEnumOptions {
  objectParentName?: string;
  needEnumNamesConstant?: boolean;
  refType?: RefsDictionaryType.Generate;
  refName?: string;
}

export function generateInlineEnum(object: SchemaObject, options: GenerateInlineEnumOptions = {}): GeneratorResultInterface {
  const {
    isNumericEnum,
    enumNames,
    needEnumNamesDescription,
  } = getEnumNames(object);

  options = {
    needEnumNamesConstant: isNumericEnum,
    ...options,
  };

  const codeBlocks: CodeBlocksArray = [];
  let descriptionLines: string[] = [];

  if (enumNames) {
    if (needEnumNamesDescription) {
      if (isNumericEnum && options.refName) {
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

    if (isNumericEnum && options.needEnumNamesConstant) {
      const enumName = getEnumNamesIdentifier(`${options.objectParentName || ''} ${object.name}`);

      const codeBlock = generateEnumConstantObject(object, enumName, enumNames);
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
