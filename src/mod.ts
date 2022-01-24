import { CheckLocalproxyServerMod } from "./mods/CheckLocalproxyServerMod";
import { AbstractMod } from "./mods/helpers/AbstractMod";
import { NpmAuditMod } from "./mods/NpmAuditMod";
import { NpmUseLatestGlobalMod } from "./mods/NpmUseLatestGlobalMod";
import { NpmUseLatestMod } from "./mods/NpmUseLatestMod";
import { PinDependenciesMod } from "./mods/PinDependenciesMod";

type ModName =
  | "pin-dependencies"
  | "npm-use-latest"
  | "npm-use-latest-global"
  | "npm-audit"
  | "check-server";

export function createMod(modName: ModName, args: string[]): AbstractMod {
  switch (modName) {
    case "check-server": {
      return new CheckLocalproxyServerMod();
    }
    case "pin-dependencies": {
      return new PinDependenciesMod(args[0]);
    }
    case "npm-audit": {
      return new NpmAuditMod();
    }
    case "npm-use-latest": {
      return new NpmUseLatestMod(args[0]);
    }
    case "npm-use-latest-global": {
      return new NpmUseLatestGlobalMod(args[0]);
    }
    default: {
      throw new Error(`Unrecognized mod: ${modName}`);
    }
  }
}

/*
Run mod:
if global:
- just run it (pass in --fix argument)

if pkgJson:


*/
