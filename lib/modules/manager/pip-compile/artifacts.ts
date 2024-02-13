import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import * as pipRequirements from '../pip_requirements';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  extractHeaderCommand,
  getExecOptions,
  getRegistryUrlVarsFromPackageFile,
} from './common';

export function constructPipCompileCmd(
  content: string,
  outputFileName: string,
  haveCredentials: boolean,
  additionalArgs: string[] = [],
): string {
  const headerArguments = extractHeaderCommand(content, outputFileName);
  if (headerArguments.isCustomCommand) {
    throw new Error(
      'Detected custom command, header modified or set by CUSTOM_COMPILE_COMMAND',
    );
  }
  if (headerArguments.outputFile) {
    // TODO(not7cd): This file path can be relative like `reqs/main.txt`
    const file = upath.parse(outputFileName).base;
    if (headerArguments.outputFile !== file) {
      // we don't trust the user-supplied output-file argument;
      // TODO(not7cd): allow relative paths
      logger.warn(
        { outputFile: headerArguments.outputFile, actualPath: file },
        'pip-compile was previously executed with an unexpected `--output-file` filename',
      );
      // headerArguments.outputFile = file;
      // headerArguments.argv.forEach((item, i) => {
      //   if (item.startsWith('--output-file=')) {
      //     headerArguments.argv[i] = `--output-file=${quote(file)}`;
      //   }
      // });
    }
  } else {
    logger.debug(`pip-compile: implicit output file (${outputFileName})`);
  }
  // safeguard against index url leak if not explicitly set by an option
  if (!headerArguments.noEmitIndexUrl && !headerArguments.emitIndexUrl) {
    headerArguments.argv.splice(1, 0, '--no-emit-index-url');
  }
  for (const arg of additionalArgs) {
    if (arg.startsWith('--upgrade-package=')) {
      headerArguments.argv.push(arg);
    }
  }
  return headerArguments.argv.map(quote).join(' ');
}

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!config.lockFiles) {
    logger.warn(
      { packageFileName: inputFileName },
      'pip-compile: No lock files associated with a package file',
    );
    return null;
  }
  logger.debug(
    `pipCompile.updateArtifacts(${inputFileName}->${JSON.stringify(
      config.lockFiles,
    )})`,
  );
  const result: UpdateArtifactsResult[] = [];
  for (const outputFileName of config.lockFiles) {
    const existingOutput = await readLocalFile(outputFileName, 'utf8');
    if (!existingOutput) {
      logger.debug('pip-compile: No output file found');
      return null;
    }
    try {
      await writeLocalFile(inputFileName, newInputContent);
      // TODO(not7cd): use --upgrade option instead deleting
      if (config.isLockFileMaintenance) {
        await deleteLocalFile(outputFileName);
      }
      const additionalArgs: string[] = [];
      updatedDeps.forEach((dep) => {
        if (dep.isLockfileUpdate) {
          additionalArgs.push(
            `--upgrade-package=${dep.depName}==${dep.newVersion}`,
          );
        }
      });
      const packageFile = pipRequirements.extractPackageFile(newInputContent);
      const registryUrlVars = getRegistryUrlVarsFromPackageFile(packageFile);
      const cmd = constructPipCompileCmd(
        existingOutput,
        outputFileName,
        registryUrlVars.haveCredentials,
        additionalArgs,
      );
      const execOptions = await getExecOptions(
        config,
        inputFileName,
        registryUrlVars.environmentVars,
      );
      logger.trace({ cmd }, 'pip-compile command');
      logger.trace({ env: execOptions.extraEnv }, 'pip-compile extra env vars');
      await exec(cmd, execOptions);
      const status = await getRepoStatus();
      if (!status?.modified.includes(outputFileName)) {
        return null;
      }
      result.push({
        file: {
          type: 'addition',
          path: outputFileName,
          contents: await readLocalFile(outputFileName, 'utf8'),
        },
      });
    } catch (err) {
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'pip-compile: Failed to run command');
      result.push({
        artifactError: {
          lockFile: outputFileName,
          stderr: err.message,
        },
      });
    }
  }
  logger.debug('pip-compile: Returning updated output file(s)');
  return result;
}
