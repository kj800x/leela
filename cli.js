const process = require("process");
const execa = require("execa");
const path = require("path");
const thisPackageJson = require("./package.json");
const { doctor } = require("./doctor");

const isStart = (args) => args.length === 0;
const isYarn = (args) => args[0] === "yarn";
const isInit = (args) => args[0] === "init";
const isVersion = (args) => args[0] === "version";
const isDoctor = (args) => args[0] === "doctor";
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

async function runYarn(args) {
  const cmd = first(args);

  const npmArgs = NPM_COMMANDS.includes(cmd) ? args : ["run", ...args];

  await execa("npm", npmArgs, {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
}

const getScriptName = (lScript) =>
  path.dirname(lScript).split("/")[path.dirname(lScript).split("/").length - 1];

async function main(_node, leelaScript, ...args) {
  switch (true) {
    case isStart(args): {
      await execa("npm", ["start", ...rest(args)], {
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      });
      break;
    }
    case isVersion(args): {
      console.log(thisPackageJson.version);
      break;
    }
    case isInit(args): {
      console.error(`${getScriptName(leelaScript)} init not yet implemented`);
      break;
    }
    case isDoctor(args): {
      await doctor(args);
      break;
    }
    case isProxy(args): {
      require("@kj800x/localproxy-cli/cli");
      break;
    }
    case isYarn(args): {
      await runYarn(rest(args));
      break;
    }
    default: {
      await runYarn(args);
      break;
    }
  }
}

main(...process.argv).catch((error) => {
  if (
    process.env[`${getScriptName(process.argv[1]).toUpperCase()}_DEBUG`] ===
    "true"
  ) {
    console.error(error);
  }
});
