const execa = require("execa");
const path = require("path");
const NpmApi = require("npm-api");
const util = require("util");
const glob = util.promisify(require("glob"));
const chalk = require("chalk");
const process = require("process");
const http = require("http");
const axios = require("axios");

const npm = new NpmApi();

const GLOBAL_PACKAGES_TO_CHECK = ["@kj800x/leela", "@kj800x/localproxy-cli"];
const LOCAL_PACKAGES_TO_CHECK = [
  "@kj800x/localproxy-react-scripts",
  "@kj800x/localproxy-client",
  "@kj800x/localproxy-cli",
];
const CACHED_VERSION_RESULTS = {};
let GLOBAL_DIR = "";

async function getLatest(package) {
  if (!CACHED_VERSION_RESULTS[package]) {
    const repo = npm.repo(package);
    CACHED_VERSION_RESULTS[package] = (await repo.version("latest")).version;
  }

  return CACHED_VERSION_RESULTS[package];
}

async function run(cmd, args, opts) {
  if (process.env.LEELA_DEBUG) {
    console.log(
      `RUN: Running ${chalk.blue([cmd, ...args].join(" "))} in ${chalk.blue(
        path.resolve((opts || {}).cwd || ".")
      )}`
    );
  }
  return await execa(cmd, args, opts);
}

async function getActual(package) {
  if (!GLOBAL_DIR) {
    const { stdout } = await run("npm", ["root", "-g"]);
    GLOBAL_DIR = stdout;
  }

  try {
    return require(require.resolve(`${package}/package.json`, {
      paths: [GLOBAL_DIR],
    })).version;
  } catch (e) {
    if (e.message.includes("Cannot find module")) {
      return "[[NOT INSTALLED]]";
    }
    throw e;
  }
}

async function checkGlobalInstallsAreUpToDate({ fix }) {
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
  json,
  key,
  file,
  { push, fix, commit, globRoot }
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

async function isInGit(file) {
  const { stdout, stderr } = await run("git", ["status"], {
    cwd: path.dirname(file),
    reject: false,
  });
  if ((stdout + stderr).includes("fatal: not a git repository")) {
    return false;
  }
  return true;
}

async function runGit(cmd, args, cwd, options = {}) {
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
}) {
  const packageJsons = await glob("**/package.json", {
    ignore: "**/node_modules/**",
    cwd: globRoot,
  });
  for (const packageJson of packageJsons) {
    const absJsonPath = path.resolve(globRoot, packageJson);
    if (isInGit(absJsonPath) && pull) {
      await runGit("pull", [], path.dirname(absJsonPath));
    }
    const jsonPackageJson = require(absJsonPath);
    await checkLocalDeps(jsonPackageJson, "dependencies", packageJson, {
      push,
      fix,
      commit,
      globRoot,
    });
    await checkLocalDeps(jsonPackageJson, "devDependencies", packageJson, {
      push,
      fix,
      commit,
      globRoot,
    });
  }
}

async function getLocalproxyServerVersion() {
  const currentVersion = (
    await axios({
      url: "http://localhost/__proxy__/api/version",
    })
  ).data;
  return currentVersion.trim();
}

async function getExpectedServerVersion() {
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

function parseArgs(args) {
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

async function doctor(args) {
  const { globRoot, fix, commit, push, pull } = parseArgs(args);
  await checkGlobalInstallsAreUpToDate({ fix });
  if (globRoot) {
    await checkLocalInstallsAreUpToDate({ fix, commit, push, pull, globRoot });
  }
  await checkLocalproxyServerIsUpToDate();

  console.log(`⚕️  The doctor is done! Reports will be found above.`);
}

module.exports = { doctor };
