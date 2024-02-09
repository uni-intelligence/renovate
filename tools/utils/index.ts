import fs from 'fs-extra';
import { logger } from '../../lib/logger';

export const newFiles = new Set();

/**
 * Get environment variable or empty string.
 * Used for easy mocking.
 * @param {string} key variable name
 * @returns {string}
 */
export function getEnv(key: string): string {
  return process.env[key] ?? '';
}

/**
 * Find all module directories.
 * @param {string} dirname dir to search in
 * @returns {string[]}
 */
export function findModules(dirname: string): string[] {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .sort();
}

/**
 * @param {string} input
 * @returns {string}
 */
export function camelCase(input: string): string {
  return input
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (char, index) =>
      index === 0 ? char.toLowerCase() : char.toUpperCase(),
    )
    .replace(/-/g, '');
}

/**
 * @param {string } file
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function updateFile(file: string, code: string): Promise<void> {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    if (!code) {
      logger.error({ file }, 'Missing content');
    }
    await fs.outputFile(file, code ?? '', { encoding: 'utf8' });
  }
  newFiles.add(file);
}

/**
 * @param {string } file
 * @returns {Promise<string | null>}
 */
export function readFile(file: string): Promise<string> {
  if (fs.existsSync(file)) {
    return fs.readFile(file, 'utf8');
  }
  return Promise.resolve('');
}

/**
 *
 * @param  val
 */
export function parsePositiveInt(val: string | undefined): number {
  if (!val) {
    return 0;
  }
  const r = Number.parseInt(val, 10);
  if (!Number.isFinite(r) || r < 0) {
    throw new Error(`Invalid number: ${val}`);
  }

  return r;
}

/**
 *
 * @param val
 */
export function parseVersion(val: string | undefined): string | undefined {
  if (!val) {
    return val;
  }

  if (!/^\d+\.\d+\.\d+(?:-.+)?$/.test(val)) {
    throw new Error(`Invalid version: ${val}`);
  }

  return val;
}
