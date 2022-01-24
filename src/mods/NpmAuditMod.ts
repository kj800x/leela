// @ts-nocheck

import { PackageMod } from "./helpers/PackageMod";

export class NpmAuditMod extends PackageMod {
  constructor() {
    super("package.json");
  }
}
