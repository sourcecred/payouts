"use strict";

const {
  validateScoreFormat,
  findIntervalIndex,
  addressToAlias,
} = require("./scores");

// Some abbreviations.
const alias = (user) => addressToAlias(user.address);
const cred = (user, intervalIndex) => user.intervalCred[intervalIndex];

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

  return {
    interval,
    payments: createPayoutArray(scoreData, fastPayoutMap, fastPayoutMap),
  };
};

module.exports = {
  createDistribution,
};
