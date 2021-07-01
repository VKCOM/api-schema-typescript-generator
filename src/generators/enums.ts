import { getEnumPropertyName, getInterfaceName } from '../helpers';
import { SchemaObject } from './SchemaObject';
import { TypeCodeBlock, TypeScriptCodeTypes } from './TypeCodeBlock';

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
