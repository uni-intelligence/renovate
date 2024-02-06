// managers supported by pip-tools Python package
export type SupportedManagers =
  | 'pip_requirements'
  | 'pip_setup'
  | 'setup-cfg'
  | 'pep621';

export interface PipCompileArgs {
  command: string;
  isCustomCommand: boolean;
  outputFile?: string;
  extra?: string[];
  constraint?: string[];
  sourceFiles: string[]; // positional arguments
  argv: string[]; // all arguments as a list
}

// https://pip.pypa.io/en/stable/reference/requirements-file-format/#supported-options
// this is a subset of pip options
export interface GlobalRequirementsFileOptions {
  indexUrl?: string;
  extraIndexUrl?: string[];
  requirements?: string[];
  constraints?: string[];
}
