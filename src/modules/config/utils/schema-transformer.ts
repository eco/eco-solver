import { z } from 'zod';

/**
 * Converts a nested path to an environment variable name
 * Examples:
 * - ['mongodb', 'uri'] → 'MONGODB_URI'
 * - ['evm', 'chainId'] → 'EVM_CHAIN_ID'
 * - ['redis', 'options', 'retryStrategy'] → 'REDIS_OPTIONS_RETRY_STRATEGY'
 * - ['evm', 'network', '10', 'rpcUrls', '0'] → 'EVM_NETWORK_10_RPC_URLS_0'
 */
export function pathToEnvVar(path: string[]): string {
  return path
    .map((segment) => {
      // Convert camelCase to SNAKE_CASE
      return segment.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    })
    .join('_');
}

/**
 * Converts an environment variable name to a nested path
 * Examples:
 * - 'MONGODB_URI' → ['mongodb', 'uri']
 * - 'EVM_CHAIN_ID' → ['evm', 'chainId']
 * - 'EVM_NETWORK_10_RPC_URLS_0' → ['evm', 'network', '10', 'rpcUrls', '0']
 */
export function envVarToPath(envVar: string): string[] {
  // Special cases that don't follow the standard pattern
  const specialCases: Record<string, string[]> = {
    USE_AWS_SECRETS: ['aws', 'useAwsSecrets'],
    NODE_ENV: ['env'],
    PORT: ['port'],
  };

  if (specialCases[envVar]) {
    return specialCases[envVar];
  }

  const parts = envVar.split('_').map((p) => p.toLowerCase());
  const result: string[] = [];

  // Define patterns with their lengths and combined forms
  const patterns: Array<{ parts: string[]; combined: string }> = [
    // Three-part patterns
    { parts: ['intent', 'source', 'address'], combined: 'intentSourceAddress' },
    { parts: ['secret', 'access', 'key'], combined: 'secretAccessKey' },
    { parts: ['retry', 'delay', 'ms'], combined: 'retryDelayMs' },
    // Four-part patterns
    { parts: ['max', 'retries', 'per', 'request'], combined: 'maxRetriesPerRequest' },
    // Two-part patterns
    { parts: ['chain', 'config'], combined: 'chainConfig' },
    { parts: ['rpc', 'urls'], combined: 'rpcUrls' },
    { parts: ['rpc', 'url'], combined: 'rpcUrl' },
    { parts: ['ws', 'url'], combined: 'wsUrl' },
    { parts: ['chain', 'id'], combined: 'chainId' },
    { parts: ['private', 'key'], combined: 'privateKey' },
    { parts: ['wallet', 'address'], combined: 'walletAddress' },
    { parts: ['inbox', 'address'], combined: 'inboxAddress' },
    { parts: ['secret', 'key'], combined: 'secretKey' },
    { parts: ['program', 'id'], combined: 'programId' },
    { parts: ['retry', 'strategy'], combined: 'retryStrategy' },
    { parts: ['retry', 'delay'], combined: 'retryDelay' },
    { parts: ['retry', 'attempts'], combined: 'retryAttempts' },
    { parts: ['access', 'key'], combined: 'accessKeyId' },
    { parts: ['backoff', 'type'], combined: 'backoffType' },
    { parts: ['backoff', 'delay'], combined: 'backoffDelay' },
    { parts: ['pool', 'size'], combined: 'poolSize' },
  ];

  // Sort patterns by length (descending) to match longer patterns first
  patterns.sort((a, b) => b.parts.length - a.parts.length);

  let i = 0;
  while (i < parts.length) {
    // Check if it's a number (array index)
    if (/^\d+$/.test(parts[i])) {
      result.push(parts[i]);
      i++;
      continue;
    }

    // Try to match patterns
    let matched = false;
    for (const pattern of patterns) {
      if (i + pattern.parts.length <= parts.length) {
        const slice = parts.slice(i, i + pattern.parts.length);
        if (slice.every((part, idx) => part === pattern.parts[idx])) {
          result.push(pattern.combined);
          i += pattern.parts.length;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      result.push(parts[i]);
      i++;
    }
  }

  return result;
}

/**
 * Type definition for schema traversal
 */
interface SchemaPath {
  path: string[];
  schema: z.ZodTypeAny;
}

/**
 * Recursively traverses a Zod schema and collects all paths with their schemas
 */
export function traverseSchema(schema: z.ZodTypeAny, currentPath: string[] = []): SchemaPath[] {
  const paths: SchemaPath[] = [];

  // Handle different Zod types
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      paths.push(...traverseSchema(value as z.ZodTypeAny, [...currentPath, key]));
    }
  } else if (schema instanceof z.ZodArray) {
    // For arrays, we don't know the indices ahead of time,
    // but we can indicate this is an array path
    paths.push({ path: currentPath, schema });
  } else if (schema instanceof z.ZodRecord) {
    // For records (objects with dynamic keys), we also don't know the keys ahead of time
    paths.push({ path: currentPath, schema });
  } else if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    // Unwrap optional/default and continue traversing
    paths.push(...traverseSchema(schema._def.innerType as z.ZodTypeAny, currentPath));
  } else if (schema instanceof z.ZodUnion) {
    // For unions, we need to handle this specially
    // Add the union schema itself so it can be matched
    paths.push({ path: currentPath, schema });
  } else {
    // Leaf node - add the path
    paths.push({ path: currentPath, schema });
  }

  return paths;
}

/**
 * Transforms flat environment variables to nested configuration based on a Zod schema
 */
export function transformEnvVarsToConfig(
  envVars: Record<string, any>,
  schema: z.ZodObject<any>,
): Record<string, any> {
  const config: Record<string, any> = {};
  const schemaPaths = traverseSchema(schema);

  // Process each environment variable
  for (const [envVar, value] of Object.entries(envVars)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const path = envVarToPath(envVar);

    // Find matching schema path
    const schemaPath = findMatchingSchemaPath(path, schemaPaths);
    if (schemaPath) {
      const transformedValue = transformValue(value, schemaPath.schema);
      // Pass schema information to setNestedValue for proper handling
      setNestedValue(config, path, transformedValue, schemaPaths);
    }
  }

  return config;
}

/**
 * Finds a matching schema path for the given environment variable path
 */
function findMatchingSchemaPath(envPath: string[], schemaPaths: SchemaPath[]): SchemaPath | null {
  // Direct match
  const directMatch = schemaPaths.find(
    (sp) =>
      sp.path.length === envPath.length && sp.path.every((segment, i) => segment === envPath[i]),
  );

  if (directMatch) {
    return directMatch;
  }

  // Check if we have a partial match to a union
  // For example, if envPath is ['evm', 'wallets', 'kernel', 'signer', 'privateKey']
  // and we have a union at ['evm', 'wallets', 'kernel', 'signer']
  for (const schemaPath of schemaPaths) {
    if (
      schemaPath.schema instanceof z.ZodUnion &&
      envPath.length > schemaPath.path.length &&
      schemaPath.path.every((segment, i) => segment === envPath[i])
    ) {
      // We found a union in the path, now check if any union option has the remaining properties
      const remainingPath = envPath.slice(schemaPath.path.length);
      const unionOptions = (schemaPath.schema as z.ZodUnion<any>).options;
      
      // Try to find which union option matches
      for (const option of unionOptions) {
        if (option instanceof z.ZodObject) {
          // Navigate through the object to find the property
          let currentSchema: z.ZodTypeAny = option;
          let found = true;
          
          for (const segment of remainingPath) {
            if (currentSchema instanceof z.ZodObject) {
              const shape = currentSchema.shape;
              if (shape && shape[segment]) {
                currentSchema = shape[segment] as z.ZodTypeAny;
              } else {
                found = false;
                break;
              }
            } else {
              found = false;
              break;
            }
          }
          
          if (found) {
            return { path: envPath, schema: currentSchema };
          }
        }
      }
    }
  }

  // Check for array paths
  // For example, envPath ['database', 'connections', '0', 'url']
  // should match schema path ['database', 'connections'] if it's an array
  for (const schemaPath of schemaPaths) {
    if (
      schemaPath.schema instanceof z.ZodArray &&
      envPath.length > schemaPath.path.length &&
      schemaPath.path.every((segment, i) => segment === envPath[i])
    ) {
      // Check if next segment is a number (array index)
      const nextSegmentIndex = schemaPath.path.length;
      if (nextSegmentIndex < envPath.length && /^\d+$/.test(envPath[nextSegmentIndex])) {
        // Get the array element schema
        const arraySchema = schemaPath.schema as z.ZodArray<any>;
        let elementSchema: z.ZodTypeAny = arraySchema.element;

        // If there are more segments after the array index, navigate deeper
        if (nextSegmentIndex + 1 < envPath.length) {
          const remainingPath = envPath.slice(nextSegmentIndex + 1);

          // Navigate through the object schema to find the final property schema
          for (const segment of remainingPath) {
            if (elementSchema instanceof z.ZodObject) {
              const shape = elementSchema.shape;
              if (shape && shape[segment]) {
                elementSchema = shape[segment] as z.ZodTypeAny;
              } else {
                // Can't navigate further, return what we have
                break;
              }
            } else {
              // Can't navigate further, return what we have
              break;
            }
          }
        }

        return { path: envPath, schema: elementSchema };
      }
    }

    // Check for record paths (objects with dynamic keys)
    // For example, envPath ['evm', 'chainConfig', '8453', 'rpcUrl']
    // should match schema path ['evm', 'chainConfig'] if it's a record
    if (
      schemaPath.schema instanceof z.ZodRecord &&
      envPath.length > schemaPath.path.length &&
      schemaPath.path.every((segment, i) => segment === envPath[i])
    ) {
      const nextSegmentIndex = schemaPath.path.length;
      if (nextSegmentIndex < envPath.length) {
        // Get the record value schema
        const recordSchema = schemaPath.schema as z.ZodRecord;
        let valueSchema: z.ZodTypeAny = recordSchema._def.valueType as z.ZodTypeAny;

        // If there are more segments after the record key, navigate deeper
        if (nextSegmentIndex + 1 < envPath.length) {
          const remainingPath = envPath.slice(nextSegmentIndex + 1);

          // Navigate through the object schema to find the final property schema
          for (const segment of remainingPath) {
            if (valueSchema instanceof z.ZodObject) {
              const shape = valueSchema.shape;
              if (shape && shape[segment]) {
                valueSchema = shape[segment] as z.ZodTypeAny;
              } else {
                // Can't navigate further, return what we have
                break;
              }
            } else {
              // Can't navigate further, return what we have
              break;
            }
          }
        }

        return { path: envPath, schema: valueSchema };
      }
    }
  }

  return null;
}

/**
 * Transforms a string value based on the Zod schema type
 */
function transformValue(value: string, schema: z.ZodTypeAny): any {
  // Handle wrapped types
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return transformValue(value, schema._def.innerType as z.ZodTypeAny);
  }

  // Handle unions - for unions, just return the value as-is
  // The actual validation will happen when the schema is parsed
  if (schema instanceof z.ZodUnion) {
    return value;
  }

  // Handle different schema types
  if (schema instanceof z.ZodNumber) {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  if (schema instanceof z.ZodBoolean) {
    return value === 'true' || value === '1';
  }

  if (schema instanceof z.ZodArray) {
    // Try parsing as JSON array first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall back to comma-separated values
      return value.split(',').map((v) => v.trim());
    }
  }

  if (schema instanceof z.ZodObject) {
    // Try parsing as JSON object
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Default: return as string
  return value;
}

/**
 * Sets a value in a nested object structure
 */
function setNestedValue(
  obj: Record<string, any>,
  path: string[],
  value: any,
  schemaPaths?: SchemaPath[],
): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];

    // Check if next key is a number
    if (/^\d+$/.test(nextKey)) {
      // Determine if this should be an array or object based on schema
      let shouldBeArray = true;

      if (schemaPaths) {
        // Find the schema for the current path up to this point
        const currentPath = path.slice(0, i + 1);
        const schemaPath = schemaPaths.find(
          (sp) =>
            sp.path.length === currentPath.length &&
            sp.path.every((segment, idx) => segment === currentPath[idx]),
        );

        if (schemaPath && schemaPath.schema instanceof z.ZodRecord) {
          shouldBeArray = false;
        }
      }

      if (shouldBeArray) {
        // Handle as array
        if (!current[key]) {
          current[key] = [];
        }
        // Ensure array is large enough
        const index = parseInt(nextKey);
        while (current[key].length <= index) {
          current[key].push(null);
        }
        if (i === path.length - 2) {
          current[key][index] = value;
          return;
        }
        if (!current[key][index]) {
          current[key][index] = {};
        }
        current = current[key][index];
        i++; // Skip the index in next iteration
      } else {
        // Handle as object with numeric key
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    } else {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
  }

  const lastKey = path[path.length - 1];
  current[lastKey] = value;
}

/**
 * Generates all possible environment variable names for a given schema
 * This is useful for documentation and validation
 */
export function generateEnvVarNames(schema: z.ZodObject<any>): string[] {
  const paths = traverseSchema(schema);
  return paths.map(({ path }) => pathToEnvVar(path));
}
