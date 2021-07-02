import { BaseCodeBlock } from './BaseCodeBlock';
import { newLineChar } from '../constants';
import { areQuotesNeededForProperty, joinCommentLines } from '../helpers';
import { consoleLogErrorAndExit } from '../log';
import { quoteJavaScriptValue, trimStringDoubleSpaces } from '../utils';

export enum TypeScriptCodeTypes {
  Interface = 'interface',
  Enum = 'enum',
  ConstantObject = 'constant_object',
  Type = 'type',
}

export interface TypeCodeBlockProperty {
  name: string;
  value: string | number;
  description?: string;
  isRequired?: boolean;
  wrapValue?: boolean;
}

export interface TypeCodeBlockOptions {
  type: TypeScriptCodeTypes;
  refName?: string;
  interfaceName: string;
  extendsInterfaces?: string[];
  allowEmptyInterface?: boolean;
  description?: string;
  properties: TypeCodeBlockProperty[];
  value?: string;
  needExport?: boolean;
}

export class TypeCodeBlock extends BaseCodeBlock {
  constructor(options: TypeCodeBlockOptions) {
    super();

    this.options = options;

    this.type = options.type;
    this.refName = options.refName;
    this.interfaceName = options.interfaceName;
    this.extendsInterfaces = options.extendsInterfaces;
    this.description = options.description;
    this.properties = options.properties;
    this.value = options.value;
    this.needExport = options.needExport;
  }

  readonly options!: TypeCodeBlockOptions;

  readonly type!: TypeCodeBlockOptions['type'];
  readonly refName!: TypeCodeBlockOptions['refName'];
  readonly interfaceName!: TypeCodeBlockOptions['interfaceName'];
  readonly extendsInterfaces!: TypeCodeBlockOptions['extendsInterfaces'];
  readonly description!: TypeCodeBlockOptions['description'];
  readonly properties: TypeCodeBlockOptions['properties'];
  readonly value!: TypeCodeBlockOptions['value'];
  readonly needExport!: TypeCodeBlockOptions['needExport'];

  addProperty(property: TypeCodeBlockProperty) {
    this.properties.push(property);
  }

  private getPropertiesCode() {
    const quoteChar = this.properties.some((property) => areQuotesNeededForProperty(property.name)) ? '\'' : '';

    return this.properties.map((property) => {
      let divider = '';
      let lineEnd = '';

      switch (this.type) {
        case TypeScriptCodeTypes.Interface:
          divider = property.isRequired ? ':' : '?:';
          lineEnd = ';';
          break;
        case TypeScriptCodeTypes.ConstantObject:
          divider = ':';
          lineEnd = ',';
          break;
        case TypeScriptCodeTypes.Enum:
          divider = ' =';
          lineEnd = ',';
          break;
      }

      let value = property.wrapValue ? quoteJavaScriptValue(property.value) : property.value;
      let propertyCode = [
        `  ${quoteChar}${property.name}${quoteChar}${divider} ${value}${lineEnd}`,
      ];

      if (property.description) {
        const commentLines = joinCommentLines(2, property.description);
        if (commentLines.length) {
          propertyCode.unshift(commentLines.join(newLineChar));
        }
      }

      return propertyCode.join(newLineChar);
    }).join(newLineChar);
  }

  toString(): string {
    const hasProperties = this.properties.length > 0;
    const exportKeyword = this.needExport ? 'export' : '';

    let propertiesCode = this.getPropertiesCode();
    let before: string[] = [];
    let code = '';

    if (this.refName) {
      before.push(`// ${this.refName}`);
    }

    if (this.description) {
      before = [
        ...before,
        ...joinCommentLines(0, this.description),
      ];
    }

    switch (this.type) {
      case TypeScriptCodeTypes.Interface: {
        if (!hasProperties) {
          if (this.options.allowEmptyInterface) {
            propertiesCode = '';
          } else {
            propertiesCode = [
              '  // empty interface',
              '  [key: string]: any;',
            ].join(newLineChar);
          }
        }

        const extendsInterfaces = Array.isArray(this.extendsInterfaces) && this.extendsInterfaces.length ?
          this.extendsInterfaces.join(', ') :
          '';

        code = [
          trimStringDoubleSpaces(`${exportKeyword} interface ${this.interfaceName} ${extendsInterfaces} {`),
          propertiesCode,
          '}',
        ].join(propertiesCode.length ? newLineChar : '');
        break;
      }

      case TypeScriptCodeTypes.Enum:
        code = [
          trimStringDoubleSpaces(`${exportKeyword} enum ${this.interfaceName} {`),
          propertiesCode,
          '}',
        ].join(newLineChar);
        break;

      case TypeScriptCodeTypes.ConstantObject:
        code = [
          trimStringDoubleSpaces(`${exportKeyword} const ${this.interfaceName} = {`),
          propertiesCode,
          '} as const;',
        ].join(newLineChar);
        break;

      case TypeScriptCodeTypes.Type:
        if (!this.value) {
          consoleLogErrorAndExit(`"${this.interfaceName}" type has empty value`);
        }

        code = [
          trimStringDoubleSpaces(`${exportKeyword} type ${this.interfaceName} = ${this.value};`),
        ].join(newLineChar);
        break;
    }

    return [
      before.join(newLineChar),
      code,
    ].join(newLineChar).trim();
  }
}
