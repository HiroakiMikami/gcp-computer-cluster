#! /bin/bash
set -u



for dir in daemon cli
do
    cd $(realpath $dir)
    npm run test || exit 1
    cd -
done
