/**
 * Playground shared state — mutable state + DOM helper.
 */

export const pgState = {
  lastFormatResponse: null,
  batchCancelFlag: false,
  batchRunning: false,
};

export const $ = (id) => document.getElementById(id);
