const sqlite3 = require("sqlite3");
const glob = require("glob");
const os = require("os");
const { exec } = require("child_process");

// settings
const wallpaperTags = ["Wallpaper"];
const picturesDir = os.homedir() + "/Pictures";
const wallpaperDirName = ".Wallpapers";

const digiKamDb = new sqlite3.Database("/opt/digikam/digikam4.db");

(async () => {
  try {
    // running stats
    let wallpapersSet = 0;

    // get tagged images
    const taggedImages = [];
    for (const tag of wallpaperTags) {
      (await getTaggedImages(tag)).forEach((i) => taggedImages.push(i));
    }
    const uniqueTaggedImages = [...new Set(taggedImages)];

    // filter wallpapers
    const newWallpapers = uniqueTaggedImages.filter((image) => {
      // we only want JPGs
      if (!image.endsWith(".jpg")) {
        return false;
      }

      // ignore existing wallpapers
      if (image.indexOf(`/${wallpaperDirName}/`) >= 0) {
        return false;
      }

      // ignore JPG originals
      if (image.indexOf(`_export`) < 0) {
        return false;
      }

      // get rid of components of composite images
      const imageNoExt = image.substring(0, image.length - 4);
      const imageIsComposite = imageNoExt.indexOf("_composite") >= 0;
      const compositeExists = uniqueTaggedImages.some((i) => i.indexOf(imageNoExt) >= 0 && i.indexOf("_composite") >= 0);
      if (!imageIsComposite && compositeExists) {
        return false;
      }

      return true;
    });

    // sync the wallpapers folder
    const currentWallpapers = glob.sync(`${picturesDir}/${wallpaperDirName}/*.{xmp,XMP,jpg,JPG,jpeg,JPEG}`);
    for (const wallpaper of currentWallpapers) {
      await execCommand(`rm "${wallpaper}"`);
    }
    for (const wallpaper of newWallpapers) {
      const chunks = wallpaper.split("/");
      const baseName = chunks[chunks.length - 1];
      await execCommand(`ln -s "${picturesDir}${wallpaper}" "${picturesDir}/${wallpaperDirName}/${baseName}"`);
      ++wallpapersSet;
    }

    // status
    console.log("Done!");
    console.log(`wallpapersSet:  ${wallpapersSet}`);
    digiKamDb.close();
  } catch (e) {
    console.log("Exception caught!");
    console.log(e);
  }
})();

async function getTaggedImages(tag) {
  return new Promise((resolve, reject) => {
    digiKamDb.all("SELECT Images.name, Albums.relativePath FROM ((Tags JOIN ImageTags ON Tags.id = ImageTags.tagid) JOIN Images on Images.id = ImageTags.imageid) JOIN Albums on Albums.id = Images.album WHERE Tags.name = ?;", [tag], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map((row) => row.relativePath + "/" + row.name));
      }
    });
  });
}

async function execCommand(command) {
  return new Promise(function(resolve, reject) {
    exec(command, function(error, standardOutput, standardError) {
      if (error) {
        reject(error);
        return;
      }

      if (standardError) {
        reject(standardError);
        return;
      }

      resolve(standardOutput);
    });
  });
}
