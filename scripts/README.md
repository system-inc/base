# scripts

Repo-level helper scripts. They're outside the package builds and eslint-ignored
— run them directly with `node`/`bash`, they aren't part of `tsc -b` or `npm run lint`.

| Script                                                       | What it does                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`publish-local.mjs`](./publish-local.mjs)                   | Rebuild tarballs and (re)publish all 5 public packages to the local verdaccio registry (`:4873`).                                                                              |
| [`publish-npmjs.mjs`](./publish-npmjs.mjs)                   | Publish the tarballs to public npmjs (`npm login` or `NPM_TOKEN`; no version overwrite). Run before the GitHub Packages mirror.                                                |
| [`publish-github.mjs`](./publish-github.mjs)                 | Publish the same tarballs to GitHub Packages for CI consumers (`GITHUB_PACKAGES_TOKEN`; no version overwrite).                                                                 |
| [`mirror-npmjs-to-github.mjs`](./mirror-npmjs-to-github.mjs) | Mirror public npmjs packages (type-graphql, nexus) into GitHub Packages byte-identically — npm routes the whole @system-inc scope to one registry, so CI needs them there too. |
| [`github-packages.mjs`](./github-packages.mjs)               | Shared helpers for the two GitHub Packages scripts: token resolution + the load-bearing scoped-registry flag.                                                                  |
| [`new-consumer.sh`](./new-consumer.sh)                       | Scaffold a fresh consumer workspace wired to verdaccio — install/use the Base CLI exactly like a real consumer.                                                                |

## Releasing

A release publishes all five packages together at one version, to both
registries, from one set of tarballs:

1. Bump the version in all five `packages/*/package.json` (the five move in
   lockstep; inter-package deps pin the exact version) and update
   `CHANGELOG.md`.
2. `npm run ci` — everything green before anything ships.
3. `npm run publish:npmjs` — builds the tarballs (`npm run dist`) and
   publishes to public npmjs.
4. `npm run publish:github` — mirrors the identical tarballs to GitHub
   Packages (same bits ⇒ consumers' lockfile integrity hashes stay valid
   against either registry).
5. Tag the release (`git tag v<version>`) and push.

Neither registry allows overwriting a published version — a mistake ships as
a new patch version, never a re-publish.
