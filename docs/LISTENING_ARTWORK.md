# Listening artwork

JL Mixing Studio Listening Phase 1 uses the approved square listening cover from the JL brand repository.

- Source repository: `jl-aspect-works/jl-brand`
- Source path: `listening-cover-dark-1200.png`
- Pinned brand commit: `64b6fdd05566f52a4c327c1f773c67bf31036dd2`
- Source blob: `6d6401afecbd0b548428902ad6dd7177aa660031`
- Dimensions: 1200 x 1200
- Studio source path: `vendor/jl-brand/listening-cover-dark-1200.png`

The brand repository is pinned as a Git submodule. Initialize it after cloning with:

```sh
git submodule update --init --recursive
```

Rust embeds the PNG bytes at compile time, so installed Studio builds do not fetch artwork from GitHub at runtime and do not depend on the submodule being present after compilation.

## Publish behavior

Per listening destination:

- `Off`: Studio does not add or alter artwork.
- `Preserve Existing`: Studio leaves existing artwork untouched.
- `Replace with Studio Artwork`: Studio replaces embedded artwork with the approved cover where the audio container supports reliable embedded artwork.

WAV uses a `cover.png` companion file because embedded artwork support varies across players. If embedded artwork cannot be written for another format, publishing still succeeds and Studio attempts the same `cover.png` companion fallback. Artwork failures are appended to the publish result rather than blocking the listening copy.

Only the published listening copy or its destination folder is changed. The authoritative revision or delivery source is never modified.

The publishing contract refers to Studio artwork through the destination artwork policy rather than this asset filename, so a later approved cover can replace the pinned source without changing the destination model or publish engine contract.
