// CJS mirror of auth-session.ts for Node --test runner
"use strict";

function shouldClearCacheOnUserChange(prevUserId, nextUserId) {
  return Boolean(prevUserId) && prevUserId !== nextUserId;
}

module.exports = { shouldClearCacheOnUserChange };
