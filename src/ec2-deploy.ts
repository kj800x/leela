import fs from "fs-extra";
import execa from "execa";
import chalk from "chalk";

export async function executeEc2Deploy(): Promise<void> {
  if (!fs.existsSync("./package.json")) {
    throw new Error("missing package.json");
  }
  const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

  const deployConfig = packageJson["ec2-deploy"] as {
    path: string;
    host: string;
  };

  if (!deployConfig) {
    throw new Error("package.json is missing ec2-deploy section");
  }

  console.log(chalk.cyan("Creating a fresh build folder..."));
  await execa("npm", ["run", "build"], { stdio: "inherit" });
  console.log(chalk.cyan("\nCreating build.tar.gz archive"));
  await execa("rm", ["-rf", "build.tar.gz"], { stdio: "inherit" });
  await execa("tar", ["-czvf", "build.tar.gz", "build"], { stdio: "inherit" });
  console.log(
    chalk.cyan(
      `\nUploading build.tar.gz archive to ec2 host ${chalk.bold(
        deployConfig.host
      )}`
    )
  );
  await execa(
    "scp",
    ["build.tar.gz", `${deployConfig.host}:${deployConfig.path}/build.tar.gz`],
    { stdio: "inherit" }
  );
  console.log(
    chalk.cyan(
      `\nExtracting build.tar.gz on ec2 host ${chalk.bold(deployConfig.host)}`
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
