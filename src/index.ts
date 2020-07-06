import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { consoleLog, consoleLogErrorAndExit, parseArguments } from './cli';
import { APITypingsGenerator } from './generators/APITypingsGenerator';
import { prepareBuildDirectory } from './helpers';

const helpMessage = `
  Options:
  
  ${chalk.greenBright('--help')}          Shows this help.
  
  ${chalk.greenBright('--schemaDir')}     The relative path to directory with ${chalk.bold('methods.json')}, ${chalk.bold('objects.json')} and ${chalk.bold('responses.json')} files.
  
  ${chalk.greenBright('--outDir')}        The directory where the files will be generated.
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
    consoleLogErrorAndExit(`You should specify ${chalk.greenBright('outDir')}. ${helpHint}`);
    return;
  }

  if (!Array.isArray(methods) || !methods.length) {
    consoleLogErrorAndExit(`You should specify ${chalk.greenBright('methods')}. ${helpHint}`);
    return;
  }

  schemaDir = path.resolve(schemaDir);
  outDir = path.resolve(outDir);

  // Read and check required schema files

  let methodsList: any;
  let objectsDefinitions: any;
  let responsesDefinitions: any;

  try {
    methodsList = JSON.parse(fs.readFileSync(path.resolve(schemaDir, 'methods.json'), 'utf-8')).methods;
    if (!Array.isArray(methodsList) || !methodsList.length) {
      consoleLogErrorAndExit(`${chalk.greenBright('methods.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('methods.json')} file is invalid.`);
    return;
  }

  try {
    objectsDefinitions = JSON.parse(fs.readFileSync(path.resolve(schemaDir, 'objects.json'), 'utf-8')).definitions;
    if (!Object.keys(objectsDefinitions).length) {
      consoleLogErrorAndExit(`${chalk.greenBright('objects.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('objects.json')} file is invalid.`);
    return;
  }

  try {
    responsesDefinitions = JSON.parse(fs.readFileSync(path.resolve(schemaDir, 'responses.json'), 'utf-8')).definitions;
    if (!Object.keys(responsesDefinitions).length) {
      consoleLogErrorAndExit(`${chalk.greenBright('responses.json')} file is empty.`);
      return;
    }
  } catch (e) {
    consoleLogErrorAndExit(`${chalk.greenBright('responses.json')} file is invalid.`);
    return;
  }

  prepareBuildDirectory(outDir);

  const generator = new APITypingsGenerator({
    outDirPath: outDir,
    methods: methodsList,
    objects: objectsDefinitions,
    responses: responsesDefinitions,
    methodsPattern: methods.join(','),
  });

  generator.generate();

  const endTime = performance.now();

  consoleLog(`✨ Done in ${((endTime - startTime) / 1000).toFixed(2)}s.`);
}
