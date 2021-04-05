import { Dictionary, ObjectType } from './types';
import { sortArrayAlphabetically, uniqueArray } from './utils';
import { newLineChar } from './constants';
import { getInterfaceName, getSectionFromObjectName } from './helpers';

export function generateImportsBlock(imports: Dictionary<boolean>, section: string | null, type?: ObjectType): string {
  const objectsToImport = uniqueArray(Object.keys(imports));
  const paths: Dictionary<string[]> = {};

  objectsToImport.forEach((objectName) => {
    const importSection = getSectionFromObjectName(objectName);
    const interfaceName = getInterfaceName(objectName);
    let path;

    if (type === ObjectType.Object) {
      if (section === importSection) {
        path = `./${interfaceName}`;
      } else {
        path = `../${importSection}/${interfaceName}`;
      }
    } else {
      path = `../objects/${importSection}/${interfaceName}`;
    }

    if (!paths[path]) {
      paths[path] = [];
    }
    paths[path].push(interfaceName);
  });

  const importLines: string[] = [];

  sortArrayAlphabetically(Object.keys(paths)).forEach((path) => {
    const interfaces = sortArrayAlphabetically(paths[path]).join(', ');
    importLines.push(`import { ${interfaces} } from '${path}';`);
  });

  return importLines.join(newLineChar);
}
