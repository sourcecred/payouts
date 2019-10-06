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
    (map, u) => ({
      ...map,
      [alias(u)]: u.intervalCred.slice(0, intervalIndex + 1).reduce(add, 0),
    }),
    {}
  );

const sumIntervalCred = ({users}, intervalIndex) =>
  users.reduce((sum, u) => sum + cred(u, intervalIndex), 0);

const fastComponent = ({users}, intervalIndex, totalPayout) => {
  const totalIntervalCred = sumIntervalCred({users}, intervalIndex);
  return users.reduce(
    (map, u) => ({
      ...map,
      [alias(u)]: Math.floor(
        (totalPayout * cred(u, intervalIndex)) / totalIntervalCred
      ),
    }),
    {}
  );
};

const createPastPayoutMap = (history) => {
  const result = {};
  for (const record of history) {
    for (const {alias: a, slow, fast} of record.payments) {
      result[a] = (result[a] || 0) + fast + slow;
    }
  }
  return result;
};

const createUnderpaidMap = (totalCredMap, pastPayoutMap, fastPayoutMap, targetPayoutPerCred) =>
  Object.keys(totalCredMap).reduce(
    (map, a) => {
      const target = Math.floor(totalCredMap[a] * targetPayoutPerCred);
      const past = pastPayoutMap[a] || 0;
      const fast = fastPayoutMap[a] || 0;
      const underPaid = target - past - fast;
      return {
        ...map,
        [a]: Math.max(underPaid, 0)
      };
    },
    {}
  );

const slowComponent = (history, {users}, intervalIndex, fastPayoutMap, targetPayout, totalSlowPayout) => {
  const pastPayoutMap = createPastPayoutMap(history);
  const totalCredMap = createTotalCredMap({users}, intervalIndex);
  const pastPayout = Object.values(pastPayoutMap).reduce(add, 0);
  const totalCred = Object.values(totalCredMap).reduce(add, 0);

  const targetPayoutPerCred = (pastPayout + targetPayout) / totalCred;
  const underPaidMap = createUnderpaidMap(totalCredMap, pastPayoutMap, fastPayoutMap, targetPayoutPerCred);
  const underPaid = Object.values(underPaidMap).reduce(add, 0);

  const payRatio = totalSlowPayout / underPaid;
  return Object.keys(underPaidMap).reduce(
    (map, a) => ({...map, [a]: Math.floor(underPaidMap[a] * payRatio)}),
    {}
  );
};

const createPayoutArray = ({users}, fastPayoutMap, slowPayoutMap) =>
  users.map((u) => {
    const a = alias(u);
    return {
      alias: a,
      fast: fastPayoutMap[a],
      slow: slowPayoutMap[a],
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
