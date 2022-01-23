import { AbstractMod } from "./AbstractMod";

export class NpmAuditMod extends AbstractMod {
  constructor() {
    super("package.json");
  }
}
