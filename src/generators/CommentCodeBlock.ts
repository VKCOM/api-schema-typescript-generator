import { BaseCodeBlock } from './BaseCodeBlock';
import { newLineChar, spaceChar } from '../constants';

export class CommentCodeBlock extends BaseCodeBlock {
  constructor(lines: string[] = []) {
    super();
    this.lines = lines;
  }

  lines: string[];

  appendLines(lines: string[]) {
    this.lines = [...this.lines, ...lines];
  }

  toString(): string {
    const inner = this.lines.map((line) => spaceChar + `* ${line}`.trim());

    return ['/**', ...inner, ' */'].join(newLineChar);
  }
}
