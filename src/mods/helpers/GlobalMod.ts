import { AbstractMod } from "./AbstractMod";

export abstract class GlobalMod extends AbstractMod {
  abstract _run(): Promise<void>;

  async run(): Promise<void> {
    await this._run();
  }
}
