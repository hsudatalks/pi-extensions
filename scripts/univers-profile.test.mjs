import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	codexOAuthCredential,
	configureUniversProfile,
	inspectUniversProfile,
	mergePackages,
} from "./univers-profile.mjs";

function jwt(exp) {
	return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "univers-pi-profile-"));
	const agentDir = join(root, "agent");
	for (const name of ["pi-goal", "pi-subagents"]) {
		const sourceDir = join(agentDir, "univers", "node_modules", "@narumitw", name, "src");
		mkdirSync(sourceDir, { recursive: true });
		writeFileSync(join(sourceDir, "index.ts"), "export {};\n");
	}
	const codexAuthPath = join(root, "codex-auth.json");
	writeFileSync(
		codexAuthPath,
		JSON.stringify({
			auth_mode: "chatgpt",
			tokens: {
				access_token: jwt(2_000_000_000),
				refresh_token: "refresh",
				account_id: "account",
			},
		}),
	);
	return { root, agentDir, codexAuthPath };
}

test("configures a complete filtered Univers profile without leaking credentials", () => {
	const { agentDir, codexAuthPath } = fixture();
	const result = configureUniversProfile({
		agentDir,
		codexAuthPath,
		forkRef: "abc123",
		opencodeKey: "opencode-secret",
	});
	assert.deepEqual(result, {
		mainModel: true,
		forkPackage: true,
		openCodeAuth: true,
		codexAuth: true,
		agents: true,
		subagents: true,
		goal: true,
	});
	const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8"));
	assert.equal(settings.defaultProvider, "opencode-go");
	assert.equal(settings.defaultModel, "deepseek-v4-flash");
	assert.equal(settings.packages.length, 2);
	assert.deepEqual(settings.packages[0].extensions, ["src/index.ts"]);
	assert.equal(settings.packages[0].source.endsWith("/@narumitw/pi-goal"), true);
	assert.equal(settings.packages[1].source.endsWith("/@narumitw/pi-subagents"), true);
	const auth = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf8"));
	assert.equal(auth["openai-codex"].accountId, "account");
	assert.equal(auth["openai-codex"].expires, 2_000_000_000_000);
	assert.equal(statSync(join(agentDir, "auth.json")).mode & 0o777, 0o600);
	assert.equal(
		readFileSync(join(agentDir, "agents", "validator.md"), "utf8").includes("luna:high"),
		true,
	);
	assert.equal(JSON.stringify(settings).includes("opencode-secret"), false);
	writeFileSync(join(agentDir, "agents", "validator.md"), "stale");
	assert.equal(inspectUniversProfile({ agentDir, forkRef: "abc123" }).agents, false);
});

test("preserves unrelated packages and credentials across idempotent upgrades", () => {
	const { agentDir, codexAuthPath } = fixture();
	configureUniversProfile({ agentDir, codexAuthPath, forkRef: "old", opencodeKey: "key" });
	const settingsPath = join(agentDir, "settings.json");
	const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
	settings.packages.unshift("npm:other-extension");
	writeFileSync(settingsPath, JSON.stringify(settings));
	chmodSync(settingsPath, 0o600);
	configureUniversProfile({ agentDir, codexAuthPath, forkRef: "new" });
	const upgraded = JSON.parse(readFileSync(settingsPath, "utf8"));
	assert.equal(upgraded.packages[0], "npm:other-extension");
	assert.equal(upgraded.packages.length, 3);
	assert.equal(upgraded.packages[1].source.endsWith("/@narumitw/pi-goal"), true);
	assert.equal(upgraded.packages[2].source.endsWith("/@narumitw/pi-subagents"), true);
	assert.equal(inspectUniversProfile({ agentDir, forkRef: "new" }).openCodeAuth, true);
});

test("rejects non-subscription Codex auth and missing OpenCode auth", () => {
	assert.throws(() => codexOAuthCredential({ auth_mode: "apikey" }), /ChatGPT subscription/);
	const { agentDir, codexAuthPath } = fixture();
	assert.throws(
		() => configureUniversProfile({ agentDir, codexAuthPath, forkRef: "main" }),
		/OpenCode Go authentication is missing/,
	);
});

test("replaces only managed goal, subagent, and fork package entries", () => {
	assert.deepEqual(
		mergePackages(
			[
				"npm:@narumitw/pi-goal",
				"npm:@narumitw/pi-subagents@0.1.0",
				"npm:@narumitw/pi-usage",
				{ source: "git:github.com/hsudatalks/pi-extensions@old" },
			],
			"/home/test/.pi/agent",
		).map((entry) => (typeof entry === "string" ? entry : entry.source)),
		[
			"npm:@narumitw/pi-usage",
			"/home/test/.pi/agent/univers/node_modules/@narumitw/pi-goal",
			"/home/test/.pi/agent/univers/node_modules/@narumitw/pi-subagents",
		],
	);
});
