#!/usr/bin/env bash
# Uploads files to a GitHub release, skipping any it already has, paced under GitHub's secondary
# rate limit for creating content (about 500 a hour). Small files upload faster than that, so a
# batch's thumbnails would otherwise be cut off partway. Safe to rerun.
#   scripts/upload-assets.sh thumbs-2026-10 out/thumbs-2026-10/*.webp
set -euo pipefail

TAG=$1
shift
SECONDS_BETWEEN_UPLOADS=8
RETRIES=12
RETRY_WAIT=300

EXISTING=$(gh release view "$TAG" --json assets -q '.assets[].name')
UPLOADED=0
for FILE in "$@"; do
  grep -qxF "$(basename "$FILE")" <<<"$EXISTING" && continue
  for ATTEMPT in $(seq "$RETRIES"); do
    gh release upload "$TAG" "$FILE" --clobber && break
    [ "$ATTEMPT" -eq "$RETRIES" ] && { echo "Gave up on $FILE after $RETRIES tries." >&2; exit 1; }
    echo "Upload failed; waiting $RETRY_WAIT s (try $ATTEMPT of $RETRIES)."
    sleep "$RETRY_WAIT"
  done
  UPLOADED=$((UPLOADED + 1))
  [ $((UPLOADED % 50)) -eq 0 ] && echo "$UPLOADED uploaded"
  sleep "$SECONDS_BETWEEN_UPLOADS"
done
echo "$UPLOADED uploaded to $TAG; $(($# - UPLOADED)) were already there."
