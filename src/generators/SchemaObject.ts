import { isObject, isString } from '../utils';
import {
  transformPatternPropertyName,
} from '../helpers';
import { consoleLogErrorAndExit } from '../log';

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
  }

  name!: string;
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
      this.properties.forEach((property) => {
        property.parentObjectName = name;
      });
    }
  }

  public clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this) as NonNullable<SchemaObject>;
  }
}
