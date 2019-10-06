"use strict";

const {mapHistoricalData} = require("./history");
const {
  validateScoreFormat,
  findIntervalIndex,
  addressToAlias,
} = require("./scores");

// Some abbreviations.
const add = (a, b) => a + b;
const alias = (user) => addressToAlias(user.address);

const fastComponent = (perAlias, targetFastPayout) => {
  const map = new Map();
  for (const [alias, user] of perAlias) {
    map.set(alias, Math.floor(targetFastPayout * user.intervalCredFraction));
  }
  return map;
};

const findTargetPayoutPerCred = (pastPayout, targetPayout, newCred) =>
  (pastPayout + targetPayout) / newCred;

const createUnderpaidMap = (perAlias, fastPayoutMap, targetPayoutPerCred) => {
  const map = new Map();
  for (const [alias, user] of perAlias) {
    const target = Math.floor(user.lifetimeCred * targetPayoutPerCred);
    const past = user.pastPayout || 0;
    const fast = fastPayoutMap.get(alias) || 0;
    const underPaid = target - past - fast;
    map.set(alias, Math.max(underPaid, 0));
  }
  return map;
};

const slowComponent = (
  perAlias,
  fastPayoutMap,
  targetPayoutPerCred,
  targetSlowPayout
) => {
  const underPaidMap = createUnderpaidMap(
    perAlias,
    fastPayoutMap,
    targetPayoutPerCred
  );
  const underPaid = Array.from(underPaidMap.values()).reduce(add, 0);

  const payRatio = targetSlowPayout / underPaid;
  const map = new Map();
  for (const [alias, u] of underPaidMap) {
    map.set(alias, Math.floor(u * payRatio));
  }
  return map;
};

const mutateExtendPerAlias = (
  perAlias,
  fastPayoutMap,
  slowPayoutMap,
  targetPayoutPerCred
) => {
  for (const [alias, user] of perAlias) {
    user.targetPayout = Math.floor(user.lifetimeCred * targetPayoutPerCred);
    user.newPayout =
      fastPayoutMap.get(alias) + slowPayoutMap.get(alias) + user.pastPayout;
  }
};

const createPayoutArray = ({users}, fastPayoutMap, slowPayoutMap) =>
  users.map((u) => {
    const a = alias(u);
    return {
      alias: a,
      fast: fastPayoutMap.get(a),
      slow: slowPayoutMap.get(a),
    };
  });

const createDistribution = (history, scores, interval, targetPayout, opts) => {
  const options = {
    fastPayoutProportion: 0.2,
    ...opts,
  };

  const scoreData = validateScoreFormat(scores);
  const intervalIndex = findIntervalIndex(interval, scoreData);
  if (intervalIndex === -1) {
    throw new Error(
      `The interval ${JSON.stringify(
        interval
      )} could not be found in the scores file`
    );
  }

  const {
    pastPayout,
    intervalCred,
    newCred,
    pastCred,
    perAlias,
  } = mapHistoricalData(history, scoreData, intervalIndex);

  const targetFastPayout = opts.fastPayoutProportion * targetPayout;
  const targetSlowPayout = (1 - opts.fastPayoutProportion) * targetPayout;
  const targetPayoutPerCred = findTargetPayoutPerCred(
    pastPayout,
    targetPayout,
    newCred
  );

  const fastPayoutMap = fastComponent(perAlias, targetFastPayout);
  const slowPayoutMap = slowComponent(
    perAlias,
    fastPayoutMap,
    targetPayoutPerCred,
    targetSlowPayout
  );

  const actualFastPayout = Array.from(fastPayoutMap.values()).reduce(add, 0);
  const actualSlowPayout = Array.from(slowPayoutMap.values()).reduce(add, 0);
  const actualPayout = actualFastPayout + actualSlowPayout;
  const newPayout = pastPayout + actualPayout;

  mutateExtendPerAlias(
    perAlias,
    fastPayoutMap,
    slowPayoutMap,
    targetPayoutPerCred
  );

  const explain = {
    total: {
      pastPayout,
      newPayout,
      pastCred,
      newCred,
    },
    interval: {
      targetPayout,
      actualPayout,
      actualPayoutFraction: actualPayout / targetPayout,
      intervalCred,
    },
    slow: {
      targetPayout: targetSlowPayout,
      actualPayout: actualSlowPayout,
      actualPayoutFraction: actualSlowPayout / targetSlowPayout,
      targetPayoutPerCred,
    },
    fast: {
      targetPayout: targetFastPayout,
      actualPayout: actualFastPayout,
      actualPayoutFraction: actualFastPayout / targetFastPayout,
    },
    perAlias,
  };

  return {
    record: {
      interval,
      payments: createPayoutArray(scoreData, fastPayoutMap, slowPayoutMap),
    },
    explain,
  };
};

module.exports = {
  createDistribution,
};
