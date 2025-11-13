/**
 * Reverse mapping for special cases from envVarToPath function.
 * Maps config path (as dot-notation string) to environment variable name.
 */
export const SPECIAL_CASES_REVERSE: Record<string, string> = {
  'aws.useAwsSecrets': 'USE_AWS_SECRETS',
  env: 'NODE_ENV',
  port: 'PORT',
  configFiles: 'CONFIG_FILES',
};

/**
 * Checks if a path matches a special case and returns the env var name.
 */
export function getSpecialCaseEnvVar(path: string[]): string | null {
  const pathStr = path.join('.');
  return SPECIAL_CASES_REVERSE[pathStr] || null;
}
