export const isInternalPath = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\/(?![\/\\])/.test(value) &&
  !/[\\\r\n]/.test(value);

export const resolveAuthRedirect = (value: unknown): string =>
  isInternalPath(value) ? value : "/tours";
