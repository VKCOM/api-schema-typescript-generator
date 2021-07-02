import { RefsDictionary } from '../types';

export abstract class BaseCodeBlock {
  toString(): string {
    return '';
  }
}

export type CodeBlocksArray = BaseCodeBlock[];

export interface GeneratorResultInterface {
  codeBlocks: CodeBlocksArray;
  imports: RefsDictionary;
  value: string;
  description?: string;
}
