import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { createMockContext, createMockPi } from "../../../test/support.js";
import {
	ALWAYS_SETTINGS_PATH,
	lastGoal,
	registerGoal,
	registerGoalWithSettingsPath,
	requireGoalTool,
	requireLastGoal,
	restoreGoalForTest,
	settingsPath,
} from "./support/goal-fixture.js";

const CREATE_GOAL = "create_goal";
const QUEUE_SETTINGS_PATH = settingsPath("create-tool-queue.json");
writeFileSync(QUEUE_SETTINGS_PATH, '{"experimental":{"goals":true}}\n');

function invokeCreateGoal(
	mock: ReturnType<typeof createMockPi>,
	ctx: ReturnType<typeof createMockContext>["ctx"],
	params: Record<string, unknown>,
	signal = new AbortController().signal,
) {
	return requireGoalTool(mock, CREATE_GOAL).execute(
		"create-goal-call",
		params,
		signal,
		() => undefined,
		ctx,
	);
}

test("create_goal documents explicit intent and exposes bounded input", () => {
	const mock = createMockPi();
	registerGoal(mock.pi);
	const definition = mock.tools.find((tool) => tool.name === CREATE_GOAL);
	assert.ok(definition);
	assert.match(String(definition.description), /only when the user explicitly asks/i);
	assert.match(
		String((definition.promptGuidelines as string[] | undefined)?.join(" ")),
		/never infer this intent from an ordinary task/i,
	);
	const parameters = definition.parameters as {
		required?: string[];
		properties?: Record<string, { minimum?: number; maximum?: number; maxLength?: number }>;
	};
	assert.deepEqual(parameters.required, ["objective"]);
	assert.equal(parameters.properties?.objective?.maxLength, 4_000);
	assert.equal(parameters.properties?.token_budget?.minimum, 1);
	assert.equal(parameters.properties?.token_budget?.maximum, Number.MAX_SAFE_INTEGER);
});

test("create_goal starts the canonical lifecycle and excludes its calling turn", async () => {
	const mock = createMockPi({
		activeTools: [CREATE_GOAL, "goal_complete", "goal_blocked"],
	});
	registerGoal(mock.pi);
	const context = createMockContext();
	mock.events.get("session_start")?.[0]?.({}, context.ctx);

	const result = await invokeCreateGoal(mock, context.ctx, {
		objective: "  ship the requested change  ",
		token_budget: 50_000,
	});

	const started = requireLastGoal(mock);
	assert.equal(started.text, "ship the requested change");
	assert.equal(started.status, "active");
	assert.equal(started.tokenBudget, 50_000);
	assert.equal(started.iteration, 0);
	assert.equal(result.terminate, true);
	assert.deepEqual(result.details, {
		objective: "ship the requested change",
		goal_id: started.id,
		status: "started",
		token_budget: 50_000,
	});
	assert.equal(mock.sentUserMessages.length, 1);
	assert.match(mock.sentUserMessages[0]?.text ?? "", /ship the requested change/);
	assert.match(mock.sentUserMessages[0]?.text ?? "", new RegExp(started.id));

	await mock.events.get("agent_end")?.[0]?.(
		{ messages: [{ role: "assistant", stopReason: "stop", content: [] }] },
		context.ctx,
	);
	assert.equal(requireLastGoal(mock).iteration, 0);
	assert.equal(mock.sentUserMessages.length, 1);
});

test("create_goal never replaces active or stopped Goals", async () => {
	for (const status of [
		"active",
		"paused",
		"blocked",
		"usage_limited",
		"budget_limited",
	] as const) {
		const restored = restoreGoalForTest(status);
		const result = await invokeCreateGoal(restored.mock, restored.ctx, {
			objective: `replace ${status}`,
		});

		assert.equal(result.terminate, undefined);
		assert.match(result.content?.[0]?.text ?? "", /unfinished Goal already exists/i);
		assert.equal(requireLastGoal(restored.mock).id, restored.sessionGoal.id);
		assert.equal(requireLastGoal(restored.mock).status, status);
		assert.equal(restored.mock.sentUserMessages.length, 0);
	}
});

test("create_goal rejects a completed head while its queue is advancing", async () => {
	const mock = createMockPi({
		activeTools: [CREATE_GOAL, "goal_complete", "goal_blocked"],
	});
	registerGoalWithSettingsPath(mock.pi, QUEUE_SETTINGS_PATH);
	const context = createMockContext();
	mock.events.get("session_start")?.[0]?.({}, context.ctx);
	await mock.commands.get("goal")?.handler("first", context.ctx);
	await mock.commands.get("goal")?.handler("add second", context.ctx);
	const first = requireLastGoal(mock);
	await requireGoalTool(mock, "goal_complete").execute(
		"complete-first",
		{ goal_id: first.id, summary: "Verified the first Goal completely." },
		new AbortController().signal,
		() => undefined,
		context.ctx,
	);

	const result = await invokeCreateGoal(mock, context.ctx, { objective: "third" });
	assert.match(result.content?.[0]?.text ?? "", /unfinished Goal already exists/i);
	assert.equal(requireLastGoal(mock).status, "complete");
	assert.equal(mock.sentUserMessages.length, 1);
});

test("create_goal validates direct calls and rolls back a failed kickoff", async () => {
	for (const params of [
		{ objective: "" },
		{ objective: "valid", token_budget: 0 },
		{ objective: "valid", token_budget: Number.MAX_SAFE_INTEGER + 1 },
	]) {
		const mock = createMockPi({
			activeTools: [CREATE_GOAL, "goal_complete", "goal_blocked"],
		});
		registerGoalWithSettingsPath(mock.pi, ALWAYS_SETTINGS_PATH);
		const context = createMockContext();
		mock.events.get("session_start")?.[0]?.({}, context.ctx);
		const result = await invokeCreateGoal(mock, context.ctx, params);
		assert.equal(result.terminate, undefined);
		assert.equal(lastGoal(mock), null);
		assert.equal(mock.sentUserMessages.length, 0);
	}

	const failed = createMockPi({
		activeTools: [CREATE_GOAL, "goal_complete", "goal_blocked"],
	});
	registerGoal(failed.pi);
	const context = createMockContext();
	failed.events.get("session_start")?.[0]?.({}, context.ctx);
	failed.rawPi.sendUserMessage = () => {
		throw new Error("delivery unavailable");
	};
	const result = await invokeCreateGoal(failed, context.ctx, { objective: "will roll back" });
	assert.equal(result.terminate, undefined);
	assert.match(result.content?.[0]?.text ?? "", /activation failed/i);
	assert.equal(lastGoal(failed), null);
	assert.equal(context.statuses.get("goal"), undefined);
});

test("concurrent create_goal calls admit exactly one Goal", async () => {
	const mock = createMockPi({
		activeTools: [CREATE_GOAL, "goal_complete", "goal_blocked"],
	});
	registerGoal(mock.pi);
	const context = createMockContext();
	mock.events.get("session_start")?.[0]?.({}, context.ctx);

	const results = await Promise.all([
		invokeCreateGoal(mock, context.ctx, { objective: "first request" }),
		invokeCreateGoal(mock, context.ctx, { objective: "second request" }),
	]);

	assert.equal(results.filter((result) => result.terminate === true).length, 1);
	assert.equal(
		results.filter((result) =>
			/unfinished Goal already exists/i.test(result.content?.[0]?.text ?? ""),
		).length,
		1,
	);
	assert.equal(requireLastGoal(mock).text, "first request");
	assert.equal(mock.sentUserMessages.length, 1);
});
