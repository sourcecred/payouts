"use strict";

const {
  validateScoreFormat,
  findIntervalIndex,
  addressToAlias,
} = require("./scores");

// Some abbreviations.
const add = (a, b) => a + b;
const alias = (user) => addressToAlias(user.address);
const cred = (user, intervalIndex) => user.intervalCred[intervalIndex];

const createTotalCredMap = ({users}, intervalIndex) =>
  users.reduce(
    (map, u) => {
      map.set(alias(u), u.intervalCred.slice(0, intervalIndex + 1).reduce(add, 0));
      return map;
    },
    new Map()
  );

const sumIntervalCred = ({users}, intervalIndex) =>
  users.reduce((sum, u) => sum + cred(u, intervalIndex), 0);

const fastComponent = ({users}, intervalIndex, totalPayout) => {
  const totalIntervalCred = sumIntervalCred({users}, intervalIndex);
  return users.reduce(
    (map, u) => {
      map.set(alias(u), Math.floor(
        (totalPayout * cred(u, intervalIndex)) / totalIntervalCred
      ));
      return map;
    },
    new Map()
  );
};

const createPastPayoutMap = (history) => {
  const result = new Map();
  for (const record of history) {
    for (const {alias: a, slow, fast} of record.payments) {
      const payoutSoFar = (result.get(a) || 0);
      result.set(a, payoutSoFar + fast + slow);
    }
  }
  return result;
};

const createUnderpaidMap = (totalCredMap, pastPayoutMap, fastPayoutMap, targetPayoutPerCred) =>
  Array.from(totalCredMap.keys()).reduce(
    (map, a) => {
      const target = Math.floor(totalCredMap.get(a) * targetPayoutPerCred);
      const past = pastPayoutMap.get(a) || 0;
      const fast = fastPayoutMap.get(a) || 0;
      const underPaid = target - past - fast;
      map.set(a, Math.max(underPaid, 0));
      return map;
    },
    new Map()
  );

const slowComponent = (history, {users}, intervalIndex, fastPayoutMap, targetPayout, totalSlowPayout) => {
  const pastPayoutMap = createPastPayoutMap(history);
  const totalCredMap = createTotalCredMap({users}, intervalIndex);
  const pastPayout = Array.from(pastPayoutMap.values()).reduce(add, 0);
  const totalCred = Array.from(totalCredMap.values()).reduce(add, 0);

  const targetPayoutPerCred = (pastPayout + targetPayout) / totalCred;
  const underPaidMap = createUnderpaidMap(totalCredMap, pastPayoutMap, fastPayoutMap, targetPayoutPerCred);
  const underPaid = Array.from(underPaidMap.values()).reduce(add, 0);

  const payRatio = totalSlowPayout / underPaid;
  return Array.from(underPaidMap.keys()).reduce(
    (map, a) => {
      map.set(a, Math.floor(underPaidMap.get(a) * payRatio));
      return map;
    },
    new Map()
  );
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

  const totalFastPayout = opts.fastPayoutProportion * targetPayout;
  const totalSlowPayout = (1 - opts.fastPayoutProportion) * targetPayout;

  const fastPayoutMap = fastComponent(
    scoreData,
    intervalIndex,
    totalFastPayout
  );

  const slowPayoutMap = slowComponent(
    history,
    scoreData,
    intervalIndex,
    fastPayoutMap,
    targetPayout,
    totalSlowPayout
  );

  return {
    interval,
    payments: createPayoutArray(scoreData, fastPayoutMap, slowPayoutMap),
  };
};

module.exports = {
  createDistribution,
};
