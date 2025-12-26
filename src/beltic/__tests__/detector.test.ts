import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectCodebase, getSourceFiles } from '../detector';

describe('detector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltic-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true });
  });

  describe('detectCodebase', () => {
    it('should detect TypeScript project', async () => {
      // Create tsconfig.json
      fs.writeFileSync(
        path.join(testDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: {} }),
      );

      // Create package.json
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test agent',
        }),
      );

      const result = await detectCodebase(testDir);

      expect(result.language).toBe('typescript');
      expect(result.agentName).toBe('test-agent');
      expect(result.agentVersion).toBe('1.0.0');
      expect(result.agentDescription).toBe('Test agent');
    });

    it('should detect Python project', async () => {
      // Create pyproject.toml
      fs.writeFileSync(
        path.join(testDir, 'pyproject.toml'),
        `[project]
name = "test-agent"
version = "0.1.0"
description = "A test Python agent"`,
      );

      const result = await detectCodebase(testDir);

      expect(result.language).toBe('python');
      expect(result.agentName).toBe('test-agent');
    });

    it('should detect standalone deployment type by default', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test' }),
      );

      const result = await detectCodebase(testDir);

      expect(result.deploymentType).toBe('standalone');
    });

    it('should detect serverless deployment type', async () => {
      fs.writeFileSync(path.join(testDir, 'serverless.yml'), 'service: test');
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test' }),
      );

      const result = await detectCodebase(testDir);

      expect(result.deploymentType).toBe('serverless');
    });

    it('should detect Anthropic model provider', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: {
            '@anthropic-ai/sdk': '^0.20.0',
          },
        }),
      );
      fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({}));

      const result = await detectCodebase(testDir);

      expect(result.modelProvider).toBe('anthropic');
    });

    it('should detect OpenAI model provider', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: {
            openai: '^4.0.0',
          },
        }),
      );
      fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({}));

      const result = await detectCodebase(testDir);

      expect(result.modelProvider).toBe('openai');
    });
  });

  describe('getSourceFiles', () => {
    it('should return TypeScript source files', async () => {
      fs.mkdirSync(path.join(testDir, 'src'));
      fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), 'export {}');
      fs.writeFileSync(path.join(testDir, 'src', 'agent.ts'), 'export {}');
      fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

      const files = await getSourceFiles(testDir, 'typescript');

      expect(files).toContain('src/index.ts');
      expect(files).toContain('src/agent.ts');
    });

    it('should respect limit parameter', async () => {
      fs.mkdirSync(path.join(testDir, 'src'));
      for (let i = 0; i < 30; i++) {
        fs.writeFileSync(path.join(testDir, 'src', `file${i}.ts`), 'export {}');
      }

      const files = await getSourceFiles(testDir, 'typescript', 10);

      expect(files.length).toBeLessThanOrEqual(10);
    });
  });
});
