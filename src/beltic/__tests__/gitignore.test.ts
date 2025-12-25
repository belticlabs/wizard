import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { updateGitignore, hasBelticEntries } from '../gitignore';

describe('gitignore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltic-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true });
  });

  describe('updateGitignore', () => {
    it('should create .gitignore if it does not exist', () => {
      const updated = updateGitignore(testDir);

      expect(updated).toBe(true);
      expect(fs.existsSync(path.join(testDir, '.gitignore'))).toBe(true);

      const content = fs.readFileSync(
        path.join(testDir, '.gitignore'),
        'utf-8',
      );
      expect(content).toContain('.beltic/');
      expect(content).toContain('*-private.pem');
    });

    it('should append to existing .gitignore', () => {
      fs.writeFileSync(
        path.join(testDir, '.gitignore'),
        'node_modules/\n',
      );

      const updated = updateGitignore(testDir);

      expect(updated).toBe(true);

      const content = fs.readFileSync(
        path.join(testDir, '.gitignore'),
        'utf-8',
      );
      expect(content).toContain('node_modules/');
      expect(content).toContain('.beltic/');
    });

    it('should not duplicate entries', () => {
      fs.writeFileSync(
        path.join(testDir, '.gitignore'),
        '.beltic/\n*-private.pem\n*.private.pem\n',
      );

      const updated = updateGitignore(testDir);

      expect(updated).toBe(false);
    });
  });

  describe('hasBelticEntries', () => {
    it('should return false when .gitignore does not exist', () => {
      expect(hasBelticEntries(testDir)).toBe(false);
    });

    it('should return false when .gitignore has no Beltic entries', () => {
      fs.writeFileSync(
        path.join(testDir, '.gitignore'),
        'node_modules/\ndist/\n',
      );

      expect(hasBelticEntries(testDir)).toBe(false);
    });

    it('should return true when .gitignore has .beltic/', () => {
      fs.writeFileSync(
        path.join(testDir, '.gitignore'),
        'node_modules/\n.beltic/\n',
      );

      expect(hasBelticEntries(testDir)).toBe(true);
    });

    it('should return true when .gitignore has Beltic comment', () => {
      fs.writeFileSync(
        path.join(testDir, '.gitignore'),
        '# Beltic entries\n',
      );

      expect(hasBelticEntries(testDir)).toBe(true);
    });
  });
});
