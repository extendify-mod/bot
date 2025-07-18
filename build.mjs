import { spawn } from "child_process";
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import path from "path";

const WATCH = process.argv.includes("watch");

/**
 * Credit to nin0
 * @type {import("esbuild").Plugin}
 */
const makeAllPackagesExternalPlugin = {
  name: "make-all-packages-external",
  setup(build) {
    const filter = /(oceanic\.js)/;
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      external: true
    }));
  }
};

mkdirSync("./data", { recursive: true });

const gradlewPath = path.join(process.cwd(), "arscstringextractor", process.platform === "win32" ? "gradlew.bat" : "gradlew");
const gradle = spawn(gradlewPath, ["build"], {
  cwd: "./arscstringextractor",
  stdio: "inherit",
  shell: process.platform === "win32"
});

gradle.on("exit", async () => {
  copyFileSync(
    path.join(process.cwd(), "arscstringextractor/build/libs/arscstringextractor.jar"),
    path.join(process.cwd(), "data/arscstringextractor.jar")
  );

  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    plugins: [makeAllPackagesExternalPlugin],
    platform: "node",
    target: "esnext",
    outfile: "dist/index.js",
    minify: !WATCH,
    treeShaking: true,
    sourcemap: "inline"
  });

  if (WATCH) {
    const proc = spawn("node", ["--env-file=.env.dev", "dist/index.js", "dev"], {
      stdio: "inherit"
    });
    proc.on("exit", (c) => process.exit(c));
    proc.on("close", (c) => process.exit(c));
  }
});
