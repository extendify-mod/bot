export function parsePackages(content: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  for (const pkg of content.split("\n\n")) {
    if (pkg.length === 0) {
      continue;
    }

    const obj: Record<string, string> = {};
    for (const line of pkg.split("\n")) {
      if (!line.includes(": ")) {
        continue;
      }

      const parts = line.split(": ");
      obj[parts[0].toLowerCase().trim()] = parts[1].trim();
    }

    if (Object.keys(obj).length !== 0) {
      result.push(obj);
    }
  }

  return result;
}
