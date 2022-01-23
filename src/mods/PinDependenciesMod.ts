import { AbstractMod } from "./AbstractMod";

export class PinDependenciesMod extends AbstractMod {
  constructor() {
    super("package.json");
  }
}
