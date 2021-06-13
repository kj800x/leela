#!/usr/bin/env node

const process = require("process");
const execa = require("execa");
const path = require("path");
const fs = require("fs-extra");
const glob = require("glob");
const chalk = require("chalk");
const figures = require("figures");
const cliSelect = require("cli-select");
const thisPackageJson = require("./package.json");
const { doctor } = require("./doctor");

const isStart = (args) => args.length === 0;
const isYarn = (args) => args[0] === "yarn";
const isInit = (args) => args[0] === "init";
const isVersion = (args) => args[0] === "version";
const isDoctor = (args) => args[0] === "doctor";
const isAlias = (args) => args[0] === "alias";
const isProxy = (args) => args[0] === "proxy";
const rest = ([_first, ...rest]) => rest;
const first = ([first]) => first;

const NPM_COMMANDS = `access, adduser, audit, bin, bugs, c, cache, ci, cit,
clean-install, clean-install-test, completion, config,
create, ddp, dedupe, deprecate, dist-tag, docs, doctor,
edit, explore, fund, get, help, help-search, hook, i, init,
install, install-ci-test, install-test, it, link, list, ln,
login, logout, ls, org, outdated, owner, pack, ping, prefix,
profile, prune, publish, rb, rebuild, repo, restart, root,
run, run-script, s, se, search, set, shrinkwrap, star,
stars, start, stop, t, team, test, token, tst, un,
uninstall, unpublish, unstar, up, update, v, version, view,
whoami`
  .split("\n")
  .join(" ")
  .split(", ");

const GUARDED_COMMANDS = ["start", "publish", "run"];

// It seems like the lockfile is sometimes written after the node_modules during an update, so
// sometimes we see the lockfile modified time is milliseconds after the node_modules modified time.
// node_modules and the lockfile can differ by this many milliseconds and still be counted up-to-date
const NM_LOCK_WINDOW = 2000;

const getScriptName = (lScript) =>
  lScript.split("/")[lScript.split("/").length - 1];

function hasStartScript(pkgJsonPath) {
  if (!fs.existsSync(pkgJsonPath)) {
    return false;
  }

  try {
    const json = require(pkgJsonPath);
    return !!(json && json.scripts && json.scripts.start);
  } catch (e) {
    return false;
  }
}

async function checkStartLocation() {
  const BASE_PATH = path.resolve(".");

  const pkgPath = path.resolve(BASE_PATH, "package.json");

  if (hasStartScript(pkgPath)) {
    return;
  }

  const pkgJsons = glob.sync("**/package.json", {
    cwd: BASE_PATH,
    ignore: "**/node_modules/**",
  });

  const options = pkgJsons.filter((e) =>
    hasStartScript(path.resolve(BASE_PATH, e))
  );

  if (options.length === 0) {
    return;
  }

  console.log("What would you like to start?");
  let result;
  try {
    result = await cliSelect({
      values: options,
      valueRenderer: (value, selected) => {
        if (selected) {
          return chalk.green(chalk.underline(value));
        }

        return value;
      },
      selected: " " + chalk.green(figures.circleFilled),
      unselected: " " + figures.circle,
    });
  } catch (e) {
    console.log("   " + chalk.blueBright("--Cancelled--"));
    return;
  }

  console.log("   " + chalk.blueBright(result.value));

  await execa(process.argv[0], [process.argv[1]], {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
    reject: false,
    cwd: path.dirname(path.resolve(BASE_PATH, result.value)),
  });

  process.exit(0);
}

function upToDateGuard(scriptName) {
  const BASE_PATH = path.resolve(".");

  const nmPath = path.resolve(BASE_PATH, "node_modules");
  const lockPath = path.resolve(BASE_PATH, "package-lock.json");
  const pkgPath = path.resolve(BASE_PATH, "package.json");

  let hadError = false;

  if (!fs.existsSync(pkgPath)) {
    return;
  }
  if (!fs.existsSync(nmPath)) {
    console.error(chalk.red("Missing node_modules"));
    hadError = true;
  } else if (!fs.existsSync(lockPath)) {
    console.error(chalk.red("Missing package-lock.json"));
    hadError = true;
  } else {
    const lockStats = fs.statSync(lockPath);
    const nmStats = fs.statSync(nmPath);
    if (nmStats.mtimeMs < lockStats.mtimeMs - NM_LOCK_WINDOW) {
      console.error(chalk.red("node_modules are out of date"));
      hadError = true;
    }
  }

  if (hadError) {
    console.error(`To fix, run ${chalk.cyan(`${scriptName} yarn`)}`);
    process.exit(1);
  }
}

function buildNpmArgs(args, scriptName) {
  const cmd = first(args);

  if (GUARDED_COMMANDS.includes(cmd)) {
    upToDateGuard(scriptName);
  }

  if (NPM_COMMANDS.includes(cmd)) {
    return args;
  }

  if (cmd == null) {
    return ["install"];
  }

  return ["run", ...args];
}

async function runYarn(args, scriptName) {
  const npmArgs = buildNpmArgs(args, scriptName);
  if (
    npmArgs[0] === "start" ||
    (npmArgs[0] === "run" && npmArgs[1] === "start")
  ) {
    await checkStartLocation();
  }

  await execa("npm", npmArgs, {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
    reject: false,
  });
}

async function main(_node, leelaScript, ...args) {
  switch (true) {
    case isStart(args): {
      upToDateGuard(getScriptName(leelaScript));
      await checkStartLocation();
      await execa("npm", ["start", ...rest(args)], {
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
        reject: false,
      });
      break;
    }
    case isVersion(args): {
      console.log(thisPackageJson.version);
      break;
    }
    case isAlias(args): {
      if (!args[1]) {
        console.warn("Name argument missing");
        console.warn(`Usage: ${getScriptName(leelaScript)} alias [name]`);
        process.exit(1);
      }

      const linkFrom = leelaScript;
      const linkTo = path.resolve(path.dirname(leelaScript), args[1]);
      await execa("ln", ["-s", linkFrom, linkTo]);
      console.log(
        `${chalk.cyanBright(args[1])} ${chalk.green("alias created")}`
      );
      break;
    }
    case isInit(args): {
      console.error(`${getScriptName(leelaScript)} init not yet implemented`);
      break;
    }
    case isDoctor(args): {
      await doctor(rest(args));
      break;
    }
    case isProxy(args): {
      upToDateGuard(getScriptName(leelaScript));
      require("@kj800x/localproxy-cli/cli");
      break;
    }
    case isYarn(args): {
      await runYarn(rest(args), getScriptName(leelaScript));
      break;
    }
    default: {
      await runYarn(args, getScriptName(leelaScript));
      break;
    }
  }
}

main(...process.argv).catch(console.error);
