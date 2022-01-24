export abstract class AbstractMod {
  fix: boolean;

  constructor(fix: boolean) {
    this.fix = fix;
  }

  abstract run(): Promise<void>;
}
