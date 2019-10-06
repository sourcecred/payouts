/* global process require */

import node from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default {
  input: "src/index.js",
  output: {
    format: "umd",
    name: "SourcecredPayouts",
    file: "index.js",
  },
  plugins: [node(), commonjs()],
};
