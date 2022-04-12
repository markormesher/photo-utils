const sqlite3 = require("sqlite3");
const glob = require("glob");
const os = require("os");

// settings
const tagsForOriginalsWithExports = ["Has Export"];
const tagsForExports = ["Has Export"];

console.log("CAUTION: This will edit the digiKam database.");
console.log("Make sure digiKam is closed before continuing!");
console.log("");
console.log("Press [enter] to continue...");

require("child_process").spawnSync("read _ ", {shell: true, stdio: [0, 1, 2]});

const digiKamDb = new sqlite3.Database(os.homedir() + "/Pictures/.digikam/digikam4.db");

(async () => {
  try {
    // running stats
    let relationsCreated = 0;
    let tagsApplied = 0;

    // get tag IDs
    const tagsIds = {};
    const allUniqueTags = [...new Set([...tagsForExports, ...tagsForOriginalsWithExports])];
    for (const tag of allUniqueTags) {
      const id = await getTagId(tag);
      tagsIds[tag] = id;
    }

    // grab all files and split them into original and exported files
    const picturesDir = os.homedir() + "/Pictures";
    const allFiles = glob.sync(`${picturesDir}/20*/**/*.{nef,NEF,jpg,JPG,jpeg,JPEG}`);

    const originalFiles = [];
    const exportedFiles = [];
    allFiles.forEach((file) => {
      if (file.indexOf("_export") >= 0) {
        exportedFiles.push(file);
      } else {
        originalFiles.push(file);
      }
    });

    // find sets of related images that should be grouped
    const relatedImageSets = [];
    originalFiles.forEach((oFile) => {
      const oFileChunks = oFile.split(".");
      const oFileRoot = oFileChunks[0];
      const relatedExportedFiles = exportedFiles.filter((eFile) => eFile.indexOf(oFileRoot) == 0);
      if (relatedExportedFiles.length > 0) {
        relatedImageSets.push([oFile, ...relatedExportedFiles]);
      }
    });

    // process each set of related images
    for (const imageSet of relatedImageSets) {
      // get image IDs of each file
      const imageIds = {};
      for (const image of imageSet) {
        const id = await getImageId(image);
        imageIds[image] = id;
      }

      // work out which image will be the "front" of the group
      const frontImage = pickFrontImage(imageSet);
      const frontImageId = await getImageId(frontImage);
      if (!frontImageId) {
        throw new Error(`Couldn't find ID for image ${frontImage}`);
      }

      // apply changes to the DB
      for (const image of imageSet) {
        const imageId = await getImageId(image);
        if (!imageId) {
          throw new Error(`Couldn't find ID for image ${image}`);
        }

        // groups
        if (image !== frontImage) {
          await createImageRelation(frontImageId, imageId);
          ++relationsCreated;
        }

        // tags
        if (originalFiles.indexOf(image)) {
          for (const tag of tagsForOriginalsWithExports) {
            await applyImageTag(imageId, tagsIds[tag]);
            ++tagsApplied;
          }
        } else {
          for (const tag of tagsForExports) {
            await applyImageTag(imageId, tagsIds[tag]);
            ++tagsApplied;
          }
        }
      }
    }

    // status
    console.log("Done!");
    console.log(`relationsCreated:  ${relationsCreated}`);
    console.log(`tagsApplied:       ${tagsApplied}`);
    digiKamDb.close();
  } catch (e) {
    console.log("Exception caught!");
    console.log(e);
  }
})();

async function getImageId(image) {
  const fileNameChunks = image.split("/");
  const fileName = fileNameChunks[fileNameChunks.length - 1];
  return new Promise((resolve, reject) => {
    digiKamDb.get("SELECT id FROM Images WHERE name = ?;", [fileName], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row && row.id || undefined);
      }
    });
  });
}

async function getTagId(tag) {
  return new Promise((resolve, reject) => {
    digiKamDb.get("SELECT id FROM Tags WHERE name = ?;", [tag], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row && row.id || undefined);
      }
    });
  });
}

async function createImageRelation(frontImageId, otherImageId) {
  return new Promise((resolve, reject) => {
    digiKamDb.run("REPLACE INTO ImageRelations VALUES (?, ?, 2);", [otherImageId, frontImageId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function applyImageTag(imageId, tagId) {
  return new Promise((resolve, reject) => {
    digiKamDb.run("REPLACE INTO ImageTags VALUES (?, ?);", [imageId, tagId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function pickFrontImage(images) {
  const termPriority = ["_composite", "_export"];
  for (const term of termPriority) {
    const matchingImages = images.filter((image) => image.indexOf(term) >= 0);
    if (matchingImages.length > 0) {
      return matchingImages.sort()[0];
    }
  }
  throw new Error(`Couldn't determine first image for set ${images}`);
}
