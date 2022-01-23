import { AbstractMod } from "./AbstractMod";

export class NpmUseLatestMod extends AbstractMod {
  pkg: string;

  constructor(pkg: string) {
    super("package.json");
    this.pkg = pkg;
  }
}
