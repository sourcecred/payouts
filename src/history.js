"use strict";

const {addressToAlias} = require("./scores");

// Some abbreviations.
const add = (a, b) => a + b;
const alias = (user) => addressToAlias(user.address);

const createPastPayoutMap = (history) => {
  const result = new Map();
  for (const record of history) {
    for (const {alias: a, slow, fast} of record.payments) {
      const payoutSoFar = result.get(a) || 0;
      result.set(a, payoutSoFar + fast + slow);
    }
  }
  return result;
};

exports.mapHistoricalData = (history, {users}, intervalIndex) => {
  const pastPayoutMap = createPastPayoutMap(history);
  const missingAliasses = new Set(pastPayoutMap.keys());

  // First per-user pass.
  const map = new Map();
  for (const user of users) {
    const a = alias(user);
    const pastPayout = pastPayoutMap.get(a) || 0;
    const intervalCred = user.intervalCred[intervalIndex];
    const lifetimeCred = user.intervalCred
      .slice(0, intervalIndex + 1)
      .reduce(add, 0);
    map.set(a, {pastPayout, intervalCred, lifetimeCred});
    missingAliasses.delete(a);
  }

  // Regardless of things like blacklisting, scores should probably not remove aliases.
  if (missingAliasses.size) {
    const aliasList = Array.from(missingAliasses.values()).join(", ");
    throw new Error(
      `Aliasses with past payout are missing from current scores: ${aliasList}`
    );
  }

  // Find totals.
  let pastPayout = 0;
  let intervalCred = 0;
  let newCred = 0;
  for (const user of map.values()) {
    pastPayout += user.pastPayout;
    intervalCred += user.intervalCred;
    newCred += user.lifetimeCred;
  }
  const pastCred = newCred - intervalCred;

  // Having the totals, find fractions per user.
  for (const user of map.values()) {
    user.intervalCredFraction = user.intervalCred / intervalCred;
    user.lifetimeCredFraction = user.lifetimeCred / newCred;
  }

  return {pastPayout, intervalCred, newCred, pastCred, perAlias: map};
};
