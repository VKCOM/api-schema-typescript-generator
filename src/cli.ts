import arg from 'arg';
import { isString, trimArray } from './utils';

export function parseArguments() {
  const args = arg(
    {
      '--help': Boolean,
      '--schemaDir': String,
      '--outDir': String,
      '--methods': [String],
      '-h': '--help',
    },
    {
      argv: process.argv.slice(2),
      permissive: true,
    },
  );

  const schemaDir = args['--schemaDir'];
  const outDir = args['--outDir'];

  return {
    help: args['--help'] || false,
    schemaDir: isString(schemaDir) ? schemaDir.trim() : null,
    outDir: isString(outDir) ? outDir.trim() : null,
    methods: trimArray(args['--methods'] || []),
  };
}
