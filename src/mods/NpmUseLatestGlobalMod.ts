import { AbstractMod } from "./AbstractMod";

export class NpmUseLatestGlobalMod extends AbstractMod {
  pkg: string;

  constructor(pkg: string) {
    super("global");
    this.pkg = pkg;
  }
}
