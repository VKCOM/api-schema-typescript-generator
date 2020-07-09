import arg from 'arg';
import { inspect } from 'util';
import chalk from 'chalk';
import { isString } from './utils';

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
    methods: args['--methods'] || [],
  };
}

function getInspectArgs(args: any[]) {
  return args.map((arg) => {
    if (typeof arg === 'object') {
      return inspect(arg, {
        showHidden: false,
        depth: null,
        colors: true,
      });
    } else {
      return arg;
    }
  });
}

export function consoleLog(...args: any[]) {
  console.log(...getInspectArgs(args));
}

export function consoleLogInfo(...args: any[]) {
  console.log(`${chalk.cyanBright.bold('info')}`, ...getInspectArgs(args));
}

export function consoleLogErrorAndExit(...args: any[]) {
  console.log(`${chalk.redBright.bold('error')}`, ...getInspectArgs(args));
  process.exit(1);
}
