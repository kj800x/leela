const execa = require("execa");
const path = require("path");
const NpmApi = require("npm-api");
const util = require("util");
const glob = util.promisify(require("glob"));

const npm = new NpmApi();

const GLOBAL_PACKAGES_TO_CHECK = [
  /*"@kj800x/leela",*/ "@kj800x/localproxy-cli",
];
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

async function getActual(package) {
  if (!GLOBAL_DIR) {
    const { stdout } = await execa("npm", ["root", "-g"]);
    GLOBAL_DIR = stdout;
  }

  return require(require.resolve(`${package}/package.json`, {
    paths: [GLOBAL_DIR],
  })).version;
}

async function checkGlobalInstallsAreUpToDate() {
  for (const globalPackage of GLOBAL_PACKAGES_TO_CHECK) {
    const expected = await getLatest(globalPackage);
    const actual = await getActual(globalPackage);
    if (expected !== actual) {
      console.log(`⚠️  Global package ${globalPackage} is not up to date!`);
      console.log(`   ${expected} is latest but ${actual} is installed.`);
      console.log(`   Run \`npm install -g ${globalPackage}@latest\` to fix.`);
      console.log();
    } else {
      console.log(`✔️  Global package ${globalPackage} is up to date!`);
    }
  }
}

async function checkLocalDeps(json, key, file) {
  if (json && json[key]) {
    for (const localPackage of LOCAL_PACKAGES_TO_CHECK) {
      if (json[key][localPackage]) {
        const actual = json[key][localPackage];
        const expected = await getLatest(localPackage);
        if (actual === expected) {
          console.log(
            `✔️  Local package ${localPackage} is up to date! [in "${key}" of "${file}"]`
          );
        } else {
          console.log(
            `⚠️  Local package ${localPackage} is not up to date! [in "${key}" of "${file}"]`
          );
          console.log(`   ${expected} is latest but ${actual} is installed.`);
          console.log(
            `   Run \`npm install -E ${localPackage}@latest\` in the project to fix.`
          );
          console.log();
        }
      }
    }
  }
}

async function checkLocalInstallsAreUpToDate() {
  const packageJsons = await glob("**/package.json", {
    ignore: "**/node_modules/**",
  });
  for (const packageJson of packageJsons) {
    const jsonPackageJson = require(path.resolve(".", packageJson));
    await checkLocalDeps(jsonPackageJson, "dependencies", packageJson);
    await checkLocalDeps(jsonPackageJson, "devDependencies", packageJson);
  }
}
async function checkLocalproxyServerIsUpToDate() {
  console.log(
    "❓ The doctor doesn't yet support checking your localproxy server version."
  );
}
async function doctor() {
  await checkGlobalInstallsAreUpToDate();
  await checkLocalInstallsAreUpToDate();
  await checkLocalproxyServerIsUpToDate();

  console.log(`⚕️  The doctor is done! Reports will be found above.`);
}

module.exports = { doctor };
