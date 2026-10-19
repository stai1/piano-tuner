#!/usr/bin/env bash
# Converts Salamander Grand Piano samples (velocity layer 8) into short mono
# 48 kHz WAV files in test-samples/ for the DSP tests. The converted files are
# not committed.
#
# Usage: scripts/prepare-samples.sh [dir-with-flac-files]
# Without an argument it uses the copy in a sibling project if present, and
# otherwise downloads the FLACs from the upstream repository.
#
# Requires: ffmpeg (and curl when downloading).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/test-samples"
SRC_DIR="${1:-$ROOT_DIR/../chord-reading-trainer-container/src/assets/piano}"
UPSTREAM="https://github.com/sfzinstruments/SalamanderGrandPiano/raw/refs/heads/master/Samples"
NOTES=(A0 C1 D#1 F#1 A1 C2 D#2 F#2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5 D#5 F#5 A5 C6 D#6 F#6 A6 C7 D#7 F#7 A7 C8)

mkdir -p "$OUT_DIR"
TMP_DIR=""
if [ ! -d "$SRC_DIR" ]; then
  TMP_DIR="$(mktemp -d)"
  SRC_DIR="$TMP_DIR"
  echo "Downloading samples from $UPSTREAM"
  for note in "${NOTES[@]}"; do
    curl -sLf -o "$SRC_DIR/${note}v8.flac" "$UPSTREAM/${note/\#/%23}v8.flac"
  done
fi

for note in "${NOTES[@]}"; do
  in="$SRC_DIR/${note}v8.flac"
  out="$OUT_DIR/${note/\#/s}.wav"
  if [ ! -f "$in" ]; then
    echo "Missing $in" >&2
    exit 1
  fi
  ffmpeg -loglevel error -y -i "$in" -t 3 -ac 1 -ar 48000 -c:a pcm_s16le "$out"
done

[ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"
echo "Wrote ${#NOTES[@]} samples to $OUT_DIR"
