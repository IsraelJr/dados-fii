import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT, patrimonyThresholdPercent, portfolioValueChangeDecision } from "../src/lib/portfolioNotificationPolicy.ts";

test("free plan keeps a fixed 3% patrimony threshold and paid plans can customize it", () => {
  assert.equal(patrimonyThresholdPercent(false, 0.5), FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT);
  assert.equal(patrimonyThresholdPercent(false, 12), FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT);
  assert.equal(patrimonyThresholdPercent(true, 1.7), 1.7);
  assert.equal(patrimonyThresholdPercent(true, 0.1), 0.5);
  assert.equal(patrimonyThresholdPercent(true, 80), 20);
  assert.equal(patrimonyThresholdPercent(true, "invalid"), FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT);
});

test("small daily movements keep the reference until the cumulative 3% threshold is reached", () => {
  const below = portfolioValueChangeDecision({
    currentValue: 10_299,
    referenceValue: 10_000,
    thresholdPercent: 3,
    dataComplete: true,
    dividendChanged: false,
    configurationChanged: false,
  });
  assert.equal(below.shouldNotify, false);
  assert.equal(below.shouldRebaseline, false);
  assert.equal(below.reason, "below_threshold");

  const up = portfolioValueChangeDecision({
    currentValue: 10_300,
    referenceValue: 10_000,
    thresholdPercent: 3,
    dataComplete: true,
    dividendChanged: false,
    configurationChanged: false,
  });
  assert.equal(up.shouldNotify, true);
  assert.equal(up.direction, "up");
  assert.equal(up.changePercent, 3);

  const down = portfolioValueChangeDecision({
    currentValue: 9_700,
    referenceValue: 10_000,
    thresholdPercent: 3,
    dataComplete: true,
    dividendChanged: false,
    configurationChanged: false,
  });
  assert.equal(down.shouldNotify, true);
  assert.equal(down.direction, "down");
  assert.equal(down.changePercent, -3);
});

test("dividend, wallet and preference changes rebaseline instead of creating a false patrimony alert", () => {
  const dividend = portfolioValueChangeDecision({ currentValue: 9_000, referenceValue: 10_000, thresholdPercent: 3, dataComplete: true, dividendChanged: true, configurationChanged: false });
  assert.equal(dividend.shouldNotify, false);
  assert.equal(dividend.shouldRebaseline, true);
  assert.equal(dividend.reason, "dividend_changed");

  const configuration = portfolioValueChangeDecision({ currentValue: 15_000, referenceValue: 10_000, thresholdPercent: 1, dataComplete: true, dividendChanged: false, configurationChanged: true });
  assert.equal(configuration.shouldNotify, false);
  assert.equal(configuration.shouldRebaseline, true);
  assert.equal(configuration.reason, "configuration_changed");
});

test("incomplete quotes never create or replace the patrimony reference", () => {
  const decision = portfolioValueChangeDecision({ currentValue: 4_000, referenceValue: 10_000, thresholdPercent: 3, dataComplete: false, dividendChanged: false, configurationChanged: false });
  assert.equal(decision.shouldNotify, false);
  assert.equal(decision.shouldRebaseline, false);
  assert.equal(decision.reason, "incomplete_data");
});
