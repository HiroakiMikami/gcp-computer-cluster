#! /bin/bash
set -u
set -x

export GCP_COMPUTER_CLUSTER_E2E_TEST_CONFIG_FILE=$(realpath $1)

cd $(dirname $0)/../e2etest
npm run test
