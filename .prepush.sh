#!/bin/sh

TAG=$(git describe --tags --abbrev=0)

# remove everything after '-'
# ex. 1.0.0-1 === 1.0.0
TAG_VERSION=${TAG%%-*} node -e "PACKAGE_JSON=require(\"./package.json\");semver=require(\"semver\");if(semver.lte(process.env.TAG_VERSION,PACKAGE_JSON.version)){process.exit(0)}else{console.log(\"VERSION MISMATCH!\");process.exit(1);}"
