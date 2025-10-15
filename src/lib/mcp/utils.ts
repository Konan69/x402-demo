export const toPrettyJson = (value: unknown): string =>
  JSON.stringify(value, null, 2);
