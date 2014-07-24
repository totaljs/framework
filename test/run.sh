#!/bin/sh
pwd

export TZ=CET-1CEST

node test-builders.js
node test-javascript.js
node test-jscss.js
node test-tmp.js
node test-utils.js
node test-framework-debug.js
node test-framework-release.js
