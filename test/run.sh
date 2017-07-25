#!/bin/bash
pwd

export TZ=CET-1CEST

node test-builders.js &&
node test-javascript.js &&
node test-css.js &&
node test-utils.js &&
node test-framework-debug.js &&
node test-framework-release.js

