import execa from "execa";
import path from "path";
// @ts-expect-error npm-api is untyped
import NpmApi from "npm-api";
import util from "util";
const glob = util.promisify(require("glob"));
import chalk from "chalk";
import process from "process";
import axios from "axios";

const npm = new NpmApi();

const GLOBAL_PACKAGES_TO_CHECK = ["@kj800x/leela", "@kj800x/localproxy-cli"];
const LOCAL_PACKAGES_TO_CHECK = [
  "@kj800x/localproxy-react-scripts",
  "@kj800x/localproxy-client",
  "@kj800x/localproxy-cli",
];
const CACHED_VERSION_RESULTS: { [key: string]: string } = {};
let GLOBAL_DIR = "";

interface PkgJson {
  dependencies: {
    [key: string]: string;
  };
  devDependencies: {
    [key: string]: string;
  };
}

async function getLatest(pkg: string) {
  if (!CACHED_VERSION_RESULTS[pkg]) {
    const repo = npm.repo(pkg);
    CACHED_VERSION_RESULTS[pkg] = (await repo.version("latest"))
      .version as string;
  }

  return CACHED_VERSION_RESULTS[pkg];
}

async function run(cmd: string, args: string[], opts?: execa.Options<string>) {
  if (process.env.LEELA_DEBUG) {
    console.log(
      `RUN: Running ${chalk.blue([cmd, ...args].join(" "))} in ${chalk.blue(
        path.resolve(opts?.cwd ?? ".")
      )}`
    );
  }
  return await execa(cmd, args, opts);
}

async function getActual(pkg: string) {
  if (!GLOBAL_DIR) {
    const { stdout } = await run("npm", ["root", "-g"]);
    GLOBAL_DIR = stdout;
  }

  try {
    return require(require.resolve(`${pkg}/package.json`, {
      paths: [GLOBAL_DIR],
    })).version;
  } catch (e) {
    if ((e as Error).message.includes("Cannot find module")) {
      return "[[NOT INSTALLED]]";
    }
    throw e;
  }
}

async function checkGlobalInstallsAreUpToDate({ fix }: GlobalArgs) {
  for (const globalPackage of GLOBAL_PACKAGES_TO_CHECK) {
    const expected = await getLatest(globalPackage);
    const actual = await getActual(globalPackage);
    if (expected === actual) {
      console.log(
        `✔️  Global package ${chalk.green(globalPackage)} (${chalk.green(
          actual
        )}) is up to date!`
      );
    } else if (fix) {
      console.log(
        `⚠️  Global package ${chalk.red(globalPackage)} is not up to date!`
      );
      console.log(
        `   ${chalk.green(expected)} is latest but ${chalk.red(
          actual
        )} is installed.`
      );
      console.log(`   Attempting to autofix.`);
      await run("npm", ["install", "-g", `${globalPackage}@latest`], {
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      });
    } else {
      console.log(
        `⚠️  Global package ${chalk.red(globalPackage)} is not up to date!`
      );
      console.log(
        `   ${chalk.green(expected)} is latest but ${chalk.red(
          actual
        )} is installed.`
      );
      console.log(
        `   Run ${chalk.blue(`npm install -g ${globalPackage}@latest`)} to fix.`
      );
      console.log();
    }
  }
}

async function checkLocalDeps(
  json: PkgJson,
  key: "dependencies" | "devDependencies",
  file: string,
  { push, fix, commit, globRoot }: LocalArgs
) {
  if (json && json[key]) {
    for (const localPackage of LOCAL_PACKAGES_TO_CHECK) {
      if (json[key][localPackage]) {
        const actual = json[key][localPackage];
        const expected = await getLatest(localPackage);
        if (actual === expected) {
          console.log(
            `✔️  Local package ${chalk.green(localPackage)} (${chalk.green(
              actual
            )}) is up to date! [in ${chalk.cyan(key)} of ${chalk.cyan(
              path.join(globRoot, file)
            )}]`
          );
        } else if (fix) {
          let stashed = false;
          console.log(
            `⚠️  Local package ${chalk.red(
              localPackage
            )} is not up to date! [in ${chalk.cyan(key)} of ${chalk.cyan(
              path.join(globRoot, file)
            )}]`
          );
          console.log(
            `   ${chalk.green(expected)} is latest but ${chalk.red(
              actual
            )} is installed.`
          );
          console.log(`   Attempting to autofix.`);
          console.log();
          if (commit && isInGit(path.resolve(globRoot, file))) {
            const { stdout, stderr } = await runGit(
              "stash",
              [],
              path.dirname(path.resolve(globRoot, file)),
              {
                stdin: "pipe",
                stdout: "pipe",
                stderr: "pipe",
              }
            );
            stashed = !`${stdout}${stderr}`.includes(
              "No local changes to save"
            );
          }
          await run("npm", ["install", "-E", `${localPackage}@latest`], {
            cwd: path.dirname(path.resolve(globRoot, file)),
            stderr: "inherit",
            stdin: "inherit",
            stdout: "inherit",
          });
          if (commit && isInGit(path.resolve(globRoot, file))) {
            await runGit(
              "add",
              [
                path.resolve(globRoot, file),
                path.resolve(globRoot, path.dirname(file), "package-lock.json"),
              ],
              path.dirname(path.resolve(globRoot, file))
            );
            await runGit(
              "commit",
              ["-m", `Upgrade ${localPackage} to ${expected}`],
              path.dirname(path.resolve(globRoot, file))
            );
            if (push) {
              await runGit(
                "push",
                [],
                path.dirname(path.resolve(globRoot, file))
              );
            }
            if (stashed) {
              await runGit(
                "stash",
                ["apply"],
                path.dirname(path.resolve(globRoot, file))
              );
            }
          }
        } else {
          console.log(
            `⚠️  Local package ${chalk.red(
              localPackage
            )} is not up to date! [in ${chalk.cyan(key)} of ${chalk.cyan(
              path.join(globRoot, file)
            )}]`
          );
          console.log(
            `   ${chalk.green(expected)} is latest but ${chalk.red(
              actual
            )} is installed.`
          );
          console.log(
            `   Run ${chalk.blue(
              `npm install -E ${localPackage}@latest`
            )} in the project to fix.`
          );
          console.log();
        }
      }
    }
  }
}

async function isInGit(file: string) {
  const { stdout, stderr } = await run("git", ["status"], {
    cwd: path.dirname(file),
    reject: false,
  });
  if ((stdout + stderr).includes("fatal: not a git repository")) {
    return false;
  }
  return true;
}

async function runGit(cmd: string, args: string[], cwd: string, options = {}) {
  return await run("git", [cmd, ...args], {
    cwd,
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
    reject: false,
    ...options,
  });
}

async function checkLocalInstallsAreUpToDate({
  pull,
  push,
  fix,
  commit,
  globRoot,
}: LocalArgs) {
  const packageJsons = await glob("**/package.json", {
    ignore: "**/node_modules/**",
    cwd: globRoot,
  });
  for (const packageJson of packageJsons) {
    const absJsonPath = path.resolve(globRoot, packageJson);
    if ((await isInGit(absJsonPath)) && pull) {
      await runGit("pull", [], path.dirname(absJsonPath));
    }
    const jsonPackageJson = require(absJsonPath);
    await checkLocalDeps(jsonPackageJson, "dependencies", packageJson, {
      pull,
      push,
      fix,
      commit,
      globRoot,
    });
    await checkLocalDeps(jsonPackageJson, "devDependencies", packageJson, {
      pull,
      push,
      fix,
      commit,
      globRoot,
    });
  }
}

async function getLocalproxyServerVersion(): Promise<string> {
  const currentVersion = (
    await axios({
      url: "http://localhost/__proxy__/api/version",
    })
  ).data;
  return currentVersion.trim();
}

async function getExpectedServerVersion(): Promise<string> {
  return (
    await axios({
      url: "https://raw.githubusercontent.com//kj800x/localproxy/master/localproxy-server/package.json",
    })
  ).data.version;
}

async function checkLocalproxyServerIsUpToDate() {
  const actual = await getLocalproxyServerVersion();
  const expected = await getExpectedServerVersion();

  if (actual === expected) {
    console.log(
      `✔️  System ${chalk.green("localproxy server")} (${chalk.green(
        actual
      )}) is up to date!`
    );
  } else {
    console.log(chalk.red(`⚠️  System localproxy server is not up to date!`));
    console.log(
      `   ${chalk.green(expected)} is latest but ${chalk.red(
        actual
      )} is installed.`
    );
    console.log(
      `   Download and install the latest release from\n   ${chalk.blue(
        `https://github.com/kj800x/localproxy/releases`
      )} to fix.`
    );
    console.log();
  }
}

interface RawArgs {
  fix: boolean;
  commit: boolean;
  push: boolean;
  pull: boolean;
  globRoot?: string;
}

interface GlobalArgs {
  fix: boolean;
}

interface LocalArgs {
  fix: boolean;
  commit: boolean;
  push: boolean;
  pull: boolean;
  globRoot: string;
}

function parseArgs(args: string[]): RawArgs {
  return {
    fix: args.includes("--fix"),
    commit: args.includes("--commit"),
    push: args.includes("--push"),
    pull: args.includes("--pull"),
    globRoot: args.filter(
      (arg) => !["--fix", "--commit", "--push", "--pull"].includes(arg)
    )[0],
  };
}

export async function doctor(args: string[]) {
  const { globRoot, fix, commit, push, pull } = parseArgs(args);
  await checkGlobalInstallsAreUpToDate({ fix });
  if (globRoot) {
    await checkLocalInstallsAreUpToDate({ fix, commit, push, pull, globRoot });
  }
  await checkLocalproxyServerIsUpToDate();

  console.log(`⚕️  The doctor is done! Reports will be found above.`);
}
