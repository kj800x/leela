import path from "path";
import { findPackageJsons } from "../../findPackageJsons";
import { AbstractMod } from "./AbstractMod";
import fs from "fs-extra";

function isInGit(p: string): boolean {
  if (!fs.statSync(p).isDirectory()) {
    p = path.dirname(p);
  }
  do {
    if (fs.existsSync(path.join(p, ".git"))) {
      return true;
    }
    p = path.dirname(p);
  } while (path.dirname(p) !== p);
  return false;
}

interface StashState {
  gitPath: string;
  usedStash: boolean;
  oldBranch: string;
}

async function stash(p: string): Promise<StashState> {
  return {
    gitPath: p,
  };
}

async function unstash(stashState: StashState): Promise<void> {
  return;
}

export abstract class PackageMod extends AbstractMod {
  rootDir: string;

  constructor(fix: boolean, rootDir: string) {
    super(fix);
    this.rootDir = rootDir;
  }

  abstract _run(packageJson: string): Promise<void>;

  /**
   * 
  - search for package.json, excluding files in node_modules folders
  - for each package.json:
    - check to see if we're in a git repo
      - error out if we aren't - we don't want to mutate
    - stash the state of the repo and get back to master
    - create a new branch
    - apply changes
    - push branch
    - open PR
    - branch back
    - pop stash
 */

  async run(): Promise<void> {
    const pkgJsons = findPackageJsons(this.rootDir, 4);

    for (const pkgJson of pkgJsons) {
      const inGit = isInGit(pkgJson);

      const stashState = await stash(pkgJson);

      await unstash(stashState);

      console.log({ pkgJson, inGit });
    }
  }
}
