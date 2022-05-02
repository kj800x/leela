import fs from "fs-extra";
import execa from "execa";
import chalk from "chalk";

export async function executeSshDeploy(): Promise<void> {
  if (!fs.existsSync("./package.json")) {
    throw new Error("missing package.json");
  }
  const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

  const deployConfig = packageJson["ssh-deploy"] as {
    path: string;
    host: string;
    include: string[];
  };

  deployConfig.include = deployConfig.include || ["build"];

  if (!deployConfig) {
    throw new Error("package.json is missing ssh-deploy section");
  }

  console.log(chalk.cyan("Creating a fresh build folder..."));
  await execa("npm", ["run", "build"], { stdio: "inherit" });
  console.log(chalk.cyan("\nCreating build.tar.gz archive"));
  await execa("rm", ["-rf", "build.tar.gz"], { stdio: "inherit" });
  await execa("tar", ["-czvf", "build.tar.gz", ...deployConfig.include], {
    stdio: "inherit",
  });
  console.log(
    chalk.cyan(
      `\nUploading build.tar.gz archive to ssh host ${chalk.bold(
        deployConfig.host
      )}`
    )
  );

  await execa(
    "ssh",
    [
      `${deployConfig.host}`,
      `mkdir`,
      `-p`,
      `${deployConfig.path};`,
      `cd`,
      `${deployConfig.path};`,
      `rm`,
      `-rf`,
      ...deployConfig.include,
    ],
    { stdio: "inherit" }
  );
  await execa(
    "scp",
    ["build.tar.gz", `${deployConfig.host}:${deployConfig.path}/build.tar.gz`],
    { stdio: "inherit" }
  );
  console.log(
    chalk.cyan(
      `\nExtracting build.tar.gz on ssh host ${chalk.bold(deployConfig.host)}`
    )
  );
  await execa(
    "ssh",
    [
      `${deployConfig.host}`,
      `cd`,
      `${deployConfig.path};`,
      `rm`,
      `-rf`,
      `build/;`,
      `tar`,
      `-xzvf`,
      `build.tar.gz;`,
    ],
    { stdio: "inherit" }
  );
}
