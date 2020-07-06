#!/bin/bash

if [ ! $1 ]; then
  echo "Error: you should pass version number"
else
  echo "[generator release]: running tests"
  yarn test

  echo "[generator release]: build"
  yarn run build

  echo "[generator release]: creating version"
  yarn version --no-git-tag-version --new-version $1

  echo "[generator release]: commit"
  git add -A && git commit -m "v$1"

  echo "[generator release]: add tag"
  git tag -a "v$1" -m "v$1"

  echo "[generator release]: pushing updates"
  git push origin HEAD

  echo "[generator release]: pushing new tag"
  git push origin "v$1"

  echo "[generator release]: publish to npm"
  yarn publish --non-interactive --access public
fi
