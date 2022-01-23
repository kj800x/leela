import { AbstractMod } from "./AbstractMod";

export abstract class PackageMod extends AbstractMod {
  abstract _run(packageJson: string): Promise<void>;

  async run(rootDir): Promise<void> {
    await this._run();
  }
}
