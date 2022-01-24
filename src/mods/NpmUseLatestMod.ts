// @ts-nocheck

import { PackageMod } from "./helpers/PackageMod";

export class NpmUseLatestMod extends PackageMod {
  pkg: string;

  constructor(pkg: string) {
    super("package.json");
    this.pkg = pkg;
  }
}
