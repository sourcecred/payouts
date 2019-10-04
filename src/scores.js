"use strict";

const EXPECTED_SCORE_VERSION = "0.2.0";
const EXPECTED_SCORE_TYPE = "sourcecred/cli/scores";

const validateScoreFormat = (plainObject) => {
  const [versionHeader, scoreData] = plainObject;

  if (
    versionHeader.version !== EXPECTED_SCORE_VERSION ||
    versionHeader.type !== EXPECTED_SCORE_TYPE
  ) {
    throw new Error(
      `Expecting type "${EXPECTED_SCORE_TYPE}" and version "${EXPECTED_SCORE_VERSION}" in the header of our scores file.`
    );
  }

  return scoreData;
};

const fromJSONString = (jsonString) => {
  const plainObject = JSON.parse(jsonString);
  return validateScoreFormat(plainObject);
};

const findIntervalIndex = ({startTimeMs, endTimeMs}, {intervals}) =>
  intervals.findIndex(
    (i) => i.startTimeMs === startTimeMs && i.endTimeMs === endTimeMs
  );

const addressToAlias = (address) => {
  switch (address[1]) {
    case "identity":
      return `sourcecred/@${address[2]}`;
    case "discourse":
      return `discourse/@${address[4]}`;
    case "github":
      return `github/@${address[4]}`;
    default:
      throw new Error("bad address");
  }
};

module.exports = {
  fromJSONString,
  validateScoreFormat,
  findIntervalIndex,
  addressToAlias,
};
