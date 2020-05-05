#! /bin/bash
set -u

command=$1

for dir in deploy manage cli
do
    cd $(realpath $dir)
    npm run $command || exit 1
    cd -
done