const { exec } = require("child_process");

(async () => {
  try {
    let files = process.argv.slice(2);
    if (files.length === 0) {
      throw new Error("Error: no files provided")
    }

    for (const file of files) {
      if (file.indexOf("/") >= 0) {
        // TODO: handle calling this from anywhere
        throw new Error("Error: this script should be invoked from the same directory as the photos");
      }
    }

    await doFixFileMode(files);
    await doRenameToLowercase(files);
    files = files.map((f) => f.toLowerCase());
    await doRenameToHash(files);
  } catch (e) {
    console.log("Exception caught!");
    console.log(e);
  }
})();

async function doFixFileMode(files) {
  console.log("Fixing file modes...");

  for (const file of files) {
    const currentMode = (await execCommand(`stat -c '%a' "${file}"`)).trim();
    if (currentMode !== "644") {
      const command = `chmod 644 "${file}"`;
      await execCommand(command);
    }
  }

  console.log("Done");
  console.log("");
}

async function doRenameToLowercase(files) {
  console.log("Renaming files to lower case...");

  for (const file of files) {
    const fromFile = file;
    const toFile = file.toLowerCase();
    if (fromFile !== toFile) {
      const command = `mv "${fromFile}" "${toFile}"`;
      await execCommand(command);
    }
  }

  console.log("Done");
  console.log("");
}

async function doRenameToHash(files) {
  console.log("Renaming files to hashes...");

  for (const file of files) {
    if (file !== file.toLowerCase()) {
      throw new Error(`Files should be lowercased with "rename 'y/A-Z/a-z/ *'" first`);
    }
  }

  // get the list of root file names for non-sidecar files (i.e. the bit before the extension)
  const rootFileNames = [];
  const nonSidecarFiles = files.filter((f) => !f.toLowerCase().endsWith(".xmp"));
  for (const file of nonSidecarFiles) {
    const fileChunks = file.split(".");
    if (fileChunks.length != 2) {
      throw new Error(`The file ${file} has more than one extension`);
    }

    if (rootFileNames.indexOf(fileChunks[0]) < 0) {
      rootFileNames.push(fileChunks[0]);
    }
  }

  // build a map of primary files to secondary files to move together
  const possibleExtensions = [".nef", ".jpg", ".mov", ".nef.xmp", ".jpg.xmp", ".mov.xmp"];
  const fileDetails = []
  for (const rootFileName of rootFileNames) {
    const allExtensions = []
    let primaryExtension = null;
    for (const ext of possibleExtensions) {
      if (files.indexOf(rootFileName + ext) >= 0) {
        allExtensions.push(ext);
        if (!primaryExtension) {
          primaryExtension = ext;
        }
      }
    }

    if (!primaryExtension) {
      throw new Error(`Could not find a primary extension for the file root "${rootFileName}"`)
    }

    fileDetails.push({
      rootFileName,
      primaryExtension,
      allExtensions,
    });
  }

  // gather file hashes and move the files
  for (const details of fileDetails) {
    const primaryFile = details.rootFileName + details.primaryExtension;
    const hash = (await execCommand(`sha256sum ${primaryFile} | awk '{print $1}'`)).trim();

    for (const ext of details.allExtensions) {
      const fromFile = details.rootFileName + ext;
      const toFile = hash + ext;
      if (fromFile !== toFile) {
        const command = `mv "${fromFile}" "${toFile}"`;
        await execCommand(command);
      }
    }
  }

  console.log("Done");
  console.log("");
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

