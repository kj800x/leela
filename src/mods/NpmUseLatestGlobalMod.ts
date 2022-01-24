// @ts-nocheck

import { GlobalMod } from "./helpers/GlobalMod";

export class NpmUseLatestGlobalMod extends GlobalMod {
  pkg: string;

  constructor(pkg: string) {
    super("global");
    this.pkg = pkg;
  }
}
