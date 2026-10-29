import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(path, entry.name)]
        : [],
  );
}
const allowed: Record<string, string[]> = {
  core: [],
  contracts: ['core'],
  utils: [],
  'design-tokens': [],
  state: ['core', 'contracts'],
  hooks: ['core', 'contracts', 'state'],
  'ui-desktop': ['core', 'design-tokens', 'utils'],
  'ui-mobile': ['core', 'design-tokens', 'utils'],
};
it('mantém o grafo de pacotes acíclico e a UI sem serviços ou acesso nativo a dados', () => {
  for (const [pkg, dependencies] of Object.entries(allowed)) {
    for (const path of files(`packages/${pkg}/src`)) {
      const source = readFileSync(path, 'utf8');
      const imports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(
        (m) => m[1],
      );
      for (const target of imports) {
        if (target.startsWith('@ydown/'))
          expect(dependencies, `${path} -> ${target}`).toContain(target.split('/')[1]);
        if (['core', 'contracts', 'state', 'hooks', 'utils'].includes(pkg))
          expect(target).not.toMatch(/^(react-native|expo|@tauri|node:)/);
        if (pkg === 'core') expect(target).not.toBe('react');
        expect(target).not.toMatch(/apps\//);
      }
      if (pkg.startsWith('ui-'))
        expect(source).not.toMatch(
          /localStorage|AsyncStorage|expo-file-system|@tauri-apps|fetch\(/,
        );
    }
  }
});
