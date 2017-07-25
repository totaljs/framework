#!/bin/bash
pwd

export TZ=CET-1CEST

node --harmony test-builders.js
node --harmony test-javascript.js
node --harmony test-css.js
node --harmony test-utils.js
node --harmony test-framework-debug.js
node --harmony test-framework-release.js
