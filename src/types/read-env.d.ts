declare module 'read-env' {
  export default function readEnv(
    prefix?: string,
    options?: Record<string, unknown>,
  ): Record<string, unknown>;
}
