"use strict";

const scoresWk2 = require("./data/scores-wk2.json");
const [distributionWk1, distributionWk2] = require("./data/history-wk2.json");

const {fastSlow} = require("../../src");

test("Expect distribution to match snapshot for wk2", () => {
  // Given
  const history = [distributionWk1];
  const scores = scoresWk2;
  const interval = {endTimeMs: 1569715200000, startTimeMs: 1569110400000};
  const targetPayout = 50000;
  const options = {
    fastPayoutProportion: 0.2,
  };

  // When
  const distribution = fastSlow.createDistribution(
    history,
    scores,
    interval,
    targetPayout,
    options
  );

  // Then
  expect(distribution).toEqual(distributionWk2);
});
