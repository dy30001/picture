#!/bin/zsh
DIR="${0:A:h}"
cd "$DIR" || exit 1
/usr/bin/env node scripts/open-workbench.mjs
