# photo-utils

> Convenience scripts for managing my photo library on disk and in digiKam.

## `organise-exports.js`

* Adds `Has Export` tags to raw and exported photos.
* Merges raw/exported/composite images into groups.

## `organise-imports.js`

* Fixes file modes to `0644`.
* Converts extensions to lower-case.
* Renames files as a hash of their contents.

## `sync-wallpapers.js`

* Keeps my `~/Pictures/.Wallpapers` folder in sync with all images tagged with `Wallpaper`.
  * [Variety](https://peterlevi.com/variety/) reads from this folder to set my desktop wallpaper.
