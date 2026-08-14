#!/usr/bin/env bash
# Copyright 2026 System, Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Spin up a fresh consumer project wired to the local verdaccio registry, install
# the base CLI from it, scaffold a workspace, and install — exactly how a real
# consumer would, but resolving @system-inc/* from verdaccio instead of npmjs.
#
# Prereqs (once): verdaccio running + packages published:
#   npx verdaccio --config verdaccio.config.yaml   # in another terminal
#   npm run publish:local
#
# Usage:
#   scripts/new-consumer.sh ../base-consumer
#
set -euo pipefail

TARGET="${1:?usage: new-consumer.sh <target-dir>}"
REGISTRY="http://localhost:4873"

rm -rf "$TARGET"
mkdir -p "$TARGET"
cd "$TARGET"

# Scope ONLY @system-inc to verdaccio; everything else uses the real npm
# registry. This single line is what makes verdaccio opt-in per project.
printf '@system-inc:registry=%s\n' "$REGISTRY" > .npmrc

echo "▸ Installing @system-inc/base-cli from verdaccio..."
npm init -y >/dev/null
npm install @system-inc/base-cli

echo "▸ Scaffolding workspace into ./app ..."
npx base workspace create ./app --no-install

# The scaffolded app needs the same registry scoping to install.
cp .npmrc app/.npmrc

echo "▸ Installing the scaffolded app..."
( cd app && npm install )

echo ""
echo "✓ Consumer ready at: $(pwd)/app"
echo "  Test it:"
echo "    cd $TARGET/app"
echo "    npx base check"
