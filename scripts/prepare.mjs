import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const huskyBinary = path.resolve(
	"node_modules/.bin",
	process.platform === "win32" ? "husky.cmd" : "husky",
);

if (existsSync(huskyBinary)) {
	const result = spawnSync(huskyBinary, { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
