# Charts Directory

Place drum chart JSON files here for each song.

Naming convention: `<song-id>.json`

Chart format: see `charts/twinkle.json` in the project root for the schema.

Key fields in `meta`:
- `audioFile`: optional, path to MP3 file (relative to public/), e.g. `"audio/babybaby.mp3"`
- If `audioFile` is omitted, the game uses the built-in synthesized melody (for backward compatibility with 小星星).
