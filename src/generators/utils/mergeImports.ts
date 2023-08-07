import { RefsDictionary, RefsDictionaryType } from '../../types';

export function mergeImports(oldImports: RefsDictionary, newImports: RefsDictionary) {
  const result = { ...oldImports };

  Object.entries(newImports).forEach(([name, newImportValue]) => {
    const oldImportValue = oldImports[name];

    if (oldImportValue === RefsDictionaryType.GenerateAndImport) {
      return;
    }

    result[name] = newImportValue;
  });

  return result;
}
