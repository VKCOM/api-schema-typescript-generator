import { newLineChar } from './constants';
import { getInterfaceName, getSectionFromObjectName } from './helpers';
import { Dictionary, ObjectType, RefsDictionary, RefsDictionaryType } from './types';
import { sortArrayAlphabetically, uniqueArray } from './utils';

export function generateImportsBlock(
  refs: RefsDictionary,
  section: string | null,
  type?: ObjectType,
): string {
  let importRefs = Object.entries(refs)
    .filter(([, type]) => type === RefsDictionaryType.GenerateAndImport)
    .map(([key]) => key);

  importRefs = uniqueArray(importRefs);

  const paths: Dictionary<string[]> = {};
  importRefs.forEach((objectName) => {
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
