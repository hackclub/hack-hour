export function assertVal<T>(value: T): NonNullable<T> {
    if (value === null || value === undefined) {
        throw `Value is null or undefined.`;
    }
    return value;
}

export function assertEnv(envVar: string): string { 
    if (!process.env[envVar]) { 
      throw new Error(`Environment variable ${envVar} is not defined.`); 
    } else {
      return process.env[envVar] as string;
    }
  }
  