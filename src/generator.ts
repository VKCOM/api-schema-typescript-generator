import { SchemaObject } from './generators/SchemaObject';
import { CodeBlocksArray, GeneratorResultInterface } from './generators/BaseCodeBlock';
import { getEnumPropertyName, getInterfaceName, joinOneOfValues } from './helpers';
import { TypeCodeBlock, TypeScriptCodeTypes } from './generators/TypeCodeBlock';
import { quoteJavaScriptValue } from './utils';
import { newLineChar } from './constants';

interface GenerateInlineEnumOptions {
  objectParentName?: string;
  skipEnumNamesConstant?: boolean;
}

export function generateInlineEnum(object: SchemaObject, options: GenerateInlineEnumOptions = {}): GeneratorResultInterface {
  let { enumNames } = object;

  const needEnumNamesDescription = !!enumNames;

  if (!enumNames) {
    const canUseEnumNames = !object.enum.some((value) => !!+value);
    if (canUseEnumNames) {
      enumNames = [...object.enum];
    }
  }

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
      descriptionLines.push('');
      descriptionLines.push(`@see ${enumInterfaceName}`);

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
  let { enumNames } = object;

  if (!enumNames) {
    const canUseEnumNames = !object.enum.some((value) => !!+value);
    if (canUseEnumNames) {
      enumNames = [...object.enum];
    }
  }

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
