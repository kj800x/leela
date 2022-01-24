import fs from "fs-extra";
import path from "path";

export function findPackageJsons(
  dir: string,
  recursionDepth: number
): string[] {
  if (recursionDepth === 0) {
    return [];
  }

  const files = fs.readdirSync(dir);

  return [
    ...files
      .filter((file) => file === "package.json")
      .map((file) => path.join(dir, file)),
    ...files
      .filter((file) => fs.statSync(path.join(dir, file)).isDirectory())
      .filter(
        (file) =>
          file !== "node_modules" &&
          file !== "PackageCache" &&
          file !== ".github"
      )
      .flatMap((file) =>
        findPackageJsons(path.join(dir, file), recursionDepth - 1)
      ),
  ];
}
