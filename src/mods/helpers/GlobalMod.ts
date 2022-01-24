import { AbstractMod } from "./AbstractMod";

export abstract class GlobalMod extends AbstractMod {
  constructor(fix: boolean) {
    super(fix);
  }

  async run(): Promise<void> {
    await this._run();
  }

  abstract _run(): Promise<void>;
}
