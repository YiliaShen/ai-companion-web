# Mira photo assets

These 11 locally stored JPEGs come from Pexels and Unsplash. The six fictional persona portraits use the [Pexels License](https://www.pexels.com/license/); the five shared scene photos use the [Unsplash License](https://unsplash.com/license). Both licenses permit free use, including commercial use, subject to their terms. No competitor screenshots or unlicensed media are included.

The portrait subjects are adult stock-photo models illustrating fictional characters; their identities are not the fictional persona names and no endorsement or relationship with Mira is asserted. The casting direction is a mixed-heritage editorial look, a youthful Asian university-student look, and a reserved executive look. Avatar and hero crops use the same source per persona.

## Stable URL contract

`manifest.json` is version 1. `personas.{shenxu,linche,jiangye}.avatar` and `.hero` are path strings; `.scenes.{scene}` maps each persona to the shared scene path. `scenes.{late_night,seaside,cafe,city_walk,celebration}.path` and `.alt` describe the shared scenes. `assets.{assetKey}` records each actual file, dimensions, bytes, SHA-256, source URL, and the exact download URL. Paths never begin with `/`: prepend `import.meta.env.BASE_URL` so both root hosting and `/ai-companion-web/` work. Retain these paths when replacing a photo.

## Sources

Downloaded on 2026-09-28. Pexels images use Imgix crops at 480 × 480 for avatars and 900 × 1200 for heroes; Unsplash scene images use 1200 × 900 entropy crops. No runtime third-party image request is needed for these files.

| Asset key / local file | Source | Exact download URL |
| --- | --- | --- |
| `shenxu_avatar` — `assets/personas/shenxu-avatar.jpg` | https://www.pexels.com/photo/15858822/ | [download](https://images.pexels.com/photos/15858822/pexels-photo-15858822.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop&crop=faces) |
| `shenxu_hero` — `assets/personas/shenxu-hero.jpg` | https://www.pexels.com/photo/15858822/ | [download](https://images.pexels.com/photos/15858822/pexels-photo-15858822.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop&crop=faces) |
| `linche_avatar` — `assets/personas/linche-avatar.jpg` | https://www.pexels.com/photo/25884890/ | [download](https://images.pexels.com/photos/25884890/pexels-photo-25884890.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop&crop=faces) |
| `linche_hero` — `assets/personas/linche-hero.jpg` | https://www.pexels.com/photo/25884890/ | [download](https://images.pexels.com/photos/25884890/pexels-photo-25884890.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop&crop=faces) |
| `jiangye_avatar` — `assets/personas/jiangye-avatar.jpg` | https://www.pexels.com/photo/30109580/ | [download](https://images.pexels.com/photos/30109580/pexels-photo-30109580.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop&crop=faces) |
| `jiangye_hero` — `assets/personas/jiangye-hero.jpg` | https://www.pexels.com/photo/30109580/ | [download](https://images.pexels.com/photos/30109580/pexels-photo-30109580.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop&crop=faces) |
| `late_night` — `assets/scenes/late_night.jpg` | https://images.unsplash.com/photo-1519608487953-e999c86e7455 | [download](https://images.unsplash.com/photo-1519608487953-e999c86e7455?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `seaside` — `assets/scenes/seaside.jpg` | https://images.unsplash.com/photo-1507525428034-b723cf961d3e | [download](https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `cafe` — `assets/scenes/cafe.jpg` | https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb | [download](https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `city_walk` — `assets/scenes/city_walk.jpg` | https://images.unsplash.com/photo-1519501025264-65ba15a82390 | [download](https://images.unsplash.com/photo-1519501025264-65ba15a82390?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |
| `celebration` — `assets/scenes/celebration.jpg` | https://images.unsplash.com/photo-1511795409834-ef04bbd61622 | [download](https://images.unsplash.com/photo-1511795409834-ef04bbd61622?fm=jpg&fit=crop&crop=entropy&w=1200&h=900&q=80) |

## Refreshing a photo

Use the reviewed `downloadUrl` from the manifest with `curl --fail --location --retry 3 URL --output public/assets/...jpg`. Verify the new image visually, preserve the stable filename, and update its dimensions, byte count, SHA-256 and source attribution in both files. Run `pnpm test`, rebuild, and run `pnpm verify:dist`; the verifier rejects unrecorded changes or missing files.
