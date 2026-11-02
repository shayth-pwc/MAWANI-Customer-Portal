"use strict";
// Allow pure injected repository/service tests when the npm registry is unreachable.
// Production always imports the real @sap/cds dependency.
const Module = require("node:module");
const cdsMock = {
  connect: {
    to: async () => {
      throw new Error("inject fake database into unit tests");
    },
  },
  log: () => ({ error: () => {}, info: () => {} }),
};
function loadWithFakeCds(request) {
  const original = Module._load;
  Module._load = function (id, parent, isMain) {
    if (id === "@sap/cds") return cdsMock;
    return original.call(this, id, parent, isMain);
  };
  try {
    return require(request);
  } finally {
    Module._load = original;
  }
}
module.exports = { loadWithFakeCds };
