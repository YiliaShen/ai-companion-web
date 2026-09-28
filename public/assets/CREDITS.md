# Mira photo assets

These 11 locally stored JPEGs come from 8 fixed Unsplash photo URLs and are provided under the [Unsplash License](https://unsplash.com/license), which allows downloading, copying, modifying, distributing, and using photos, including commercial use. This is the Unsplash License, not CC0 or a claim that all third-party rights are waived; the license excludes compiling photos to replicate a competing service and selling unmodified photos. Review the linked terms for your use.

The portrait subjects illustrate fictional characters; their identities are not the fictional persona names and no endorsement or relationship with Mira is asserted. Avatar and hero crops intentionally use the same source per persona. Five shared lifestyle photos provide the scene library for all three personas. No competitor screenshots or other media sources are included.

## Stable URL contract

`manifest.json` is version 1. `personas.{shenxu,linche,jiangye}.avatar` and `.hero` are path strings; `.scenes.{scene}` maps each persona to the shared scene path. `scenes.{late_night,seaside,cafe,city_walk,celebration}.path` and `.alt` describe the shared scenes. `assets.{assetKey}` records each actual file, dimensions, bytes, SHA-256, source URL, and the exact download URL. Paths never begin with `/`: prepend `import.meta.env.BASE_URL` so both root hosting and `/ai-companion-web/` work. Retain these paths when replacing a photo.

## Sources

Downloaded on 2026-09-28 using `curl --fail --location --retry 3` from the exact URLs below. Unsplash/Imgix produced explicit JPEGs at quality 80, 480 × 480 avatar crops, 900 × 1200 hero crops, and 1200 × 900 scenes; no runtime third-party image request is needed for these files.

| Asset key / local file | Source URL | Exact download URL |
| --- | --- | --- |
| `shenxu_avatar` — `assets/personas/shenxu-avatar.jpg` | https://images.unsplash.com/photo-1506794778202-cad84cf45f1d | [download](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&crop=faces&w=480&h=480&q=80) |
| `shenxu_hero` — `assets/personas/shenxu-hero.jpg` | https://images.unsplash.com/photo-1506794778202-cad84cf45f1d | [download](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&crop=faces&w=900&h=1200&q=80) |
| `linche_avatar` — `assets/personas/linche-avatar.jpg` | https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d | [download](https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&crop=faces&w=480&h=480&q=80) |
| `linche_hero` — `assets/personas/linche-hero.jpg` | https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d | [download](https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&crop=faces&w=900&h=1200&q=80) |
| `jiangye_avatar` — `assets/personas/jiangye-avatar.jpg` | https://images.unsplash.com/photo-1500648767791-00dcc994a43e | [download](https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&crop=faces&w=480&h=480&q=80) |
| `jiangye_hero` — `assets/personas/jiangye-hero.jpg` | https://images.unsplash.com/photo-1500648767791-00dcc994a43e | [download](https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&crop=faces&w=900&h=1200&q=80) |
| `late_night` — `assets/scenes/late_night.jpg` | https://images.unsplash.com/photo-1519608487953-e999c86e7455 | [download](https://images.unsplash.com/photo-1519608487953-e999c86e7455?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `seaside` — `assets/scenes/seaside.jpg` | https://images.unsplash.com/photo-1507525428034-b723cf961d3e | [download](https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `cafe` — `assets/scenes/cafe.jpg` | https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb | [download](https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `city_walk` — `assets/scenes/city_walk.jpg` | https://images.unsplash.com/photo-1519501025264-65ba15a82390 | [download](https://images.unsplash.com/photo-1519501025264-65ba15a82390?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `celebration` — `assets/scenes/celebration.jpg` | https://images.unsplash.com/photo-1511795409834-ef04bbd61622 | [download](https://images.unsplash.com/photo-1511795409834-ef04bbd61622?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |

## Refreshing a photo

Use the reviewed `downloadUrl` from the manifest with `curl --fail --location --retry 3 URL --output public/assets/...jpg`. Verify the new image visually, preserve the stable filename, and update its dimensions, byte count, SHA-256 and source attribution in both files. Run `pnpm test`, rebuild, and run `pnpm verify:dist`; the verifier rejects unrecorded changes or missing files.
