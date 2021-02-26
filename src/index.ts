import path from 'path';
import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { parseArguments } from './cli';
import { consoleLog, consoleLogErrorAndExit, consoleLogInfo } from './log';
import { APITypingsGenerator } from './generators/APITypingsGenerator';
import { readJSONFile } from './helpers';

const helpMessage = `
  Options:

  ${chalk.greenBright('--help')}          Shows this help.

  ${chalk.greenBright('--schemaDir')}     The relative path to directory with ${chalk.bold('methods.json')}, ${chalk.bold('objects.json')} and ${chalk.bold('responses.json')} files.

  ${chalk.greenBright('--outDir')}        The directory where the files will be generated.
                  If you skip this param, script will work in linter mode without emitting files to file system.
                  ${chalk.bold('Please note')} that this folder will be cleared after starting the generation.

  ${chalk.greenBright('--methods')}       List of methods to generate responses and all needed objects.
                  Example:
                  - ${chalk.bold('\'*\'')} - to generate all responses and objects.
                  - ${chalk.bold('\'messages.*, users.get, groups.isMember\'')} - to generate all methods from messages section, users.get and groups.isMember.
`;

export async function main() {
  console.log(chalk.bold('VK API Schema TypeScript generator'));
  const startTime = performance.now();

  const args = parseArguments();
  let { help, schemaDir, outDir, methods } = args;

  if (help) {
    console.log(helpMessage);
    return;
  }

  const helpHint = `Use ${chalk.greenBright('--help')} to see all options.`;

  if (!schemaDir) {
    consoleLogErrorAndExit(`You should specify ${chalk.greenBright('schemaDir')}. ${helpHint}`);
    return;
  }

  if (!outDir) {
    consoleLogInfo(`${chalk.greenBright('outDir')} option is empty. ${helpHint}`);
    consoleLogInfo('Script will work in linter mode without emitting files to file system.');
  }

  if (!Array.isArray(methods) || !methods.length) {
    consoleLogErrorAndExit(`You should specify ${chalk.greenBright('methods')}. ${helpHint}`);
    return;
  }

  schemaDir = path.resolve(schemaDir);
  outDir = outDir ? path.resolve(outDir) : '';

  // Read and check required schema files

  let methodsDefinitions: any;
  let objectsDefinitions: any;
  let responsesDefinitions: any;

  try {
    methodsDefinitions = await readJSONFile(path.resolve(schemaDir, 'methods.json'));
    if (!methodsDefinitions || !Array.isArray(methodsDefinitions.methods) || !methodsDefinitions.methods.length) {
      consoleLogErrorAndExit(`${chalk.greenBright('methods.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('methods.json')} file is invalid.`);
    return;
  }

  try {
    objectsDefinitions = (await readJSONFile(path.resolve(schemaDir, 'objects.json'))).definitions;
    if (!Object.keys(objectsDefinitions).length) {
      consoleLogErrorAndExit(`${chalk.greenBright('objects.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('objects.json')} file is invalid.`);
    return;
  }

  try {
    responsesDefinitions = (await readJSONFile(path.resolve(schemaDir, 'responses.json'))).definitions;
    if (!Object.keys(responsesDefinitions).length) {
      consoleLogErrorAndExit(`${chalk.greenBright('responses.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('responses.json')} file is invalid.`);
    return;
  }

  const needEmit = !!outDir;

  const generator = new APITypingsGenerator({
    needEmit,
    outDirPath: outDir,
    methodsDefinitions,
    objects: objectsDefinitions,
    responses: responsesDefinitions,
    methodsPattern: methods.join(','),
  });

  generator.generate();

  const endTime = performance.now();

  consoleLog(`✨ Done in ${((endTime - startTime) / 1000).toFixed(2)}s.`);
}
