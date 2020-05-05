#! /bin/bash
set -u

command=$1

for dir in daemon cli
do
    cd $(realpath $dir)
    npm run $command || exit 1
    cd -
done
