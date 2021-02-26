import chalk from 'chalk';
import { inspect } from 'util';

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

export function consoleLogError(...args: any[]) {
  console.log(`${chalk.redBright.bold('error')}`, ...getInspectArgs(args));
}

export function consoleLogErrorAndExit(...args: any[]) {
  consoleLogError(...args);
  process.exit(1);
}
