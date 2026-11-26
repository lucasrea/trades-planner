/** Optional text fields of a multipart upload. Blank or missing is undefined. */
export function readFormFields<K extends string>(form: FormData, names: readonly K[]): Partial<Record<K, string>> {
  const fields: Partial<Record<K, string>> = {};
  for (const name of names) {
    const value = form.get(name);
    if (typeof value === "string" && value.trim()) fields[name] = value.trim();
  }
  return fields;
}
