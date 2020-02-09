const { exec } = require("child_process");

(async () => {
  try {
    const args = process.argv.slice(2);
    let files = args.filter((a) => a.substr(0, 1) !== "-");
    const flags = args.filter((a) => a.substr(0, 1) == "-");

    for (const file of files) {
      if (file.indexOf("/") >= 0) {
        throw new Error("This script should be invoked from the same directory as the photos");
      }
    }

    let didAction = false;
    if (flags.indexOf("-mode") >= 0 || flags.indexOf("-all") >= 0) {
      didAction = true;
      await doFixFileMode(files, flags);
    }
    if (flags.indexOf("-lower") >= 0 || flags.indexOf("-all") >= 0) {
      didAction = true;
      await doRenameToLowercase(files, flags);
      files = files.map((f) => f.toLowerCase());
    }
    if (flags.indexOf("-hash") >= 0 || flags.indexOf("-all") >= 0) {
      didAction = true;
      await doRenameToHash(files, flags);
    }

    if (!didAction) {
      throw new Error("Must provide at least one action flag, one of -mode, -lower, -hash");
    }
  } catch (e) {
    console.log("Exception caught!");
    console.log(e);
  }
})();

async function doFixFileMode(files, flags) {
  console.log("Fixing file modes...");

  for (const file of files) {
    const currentMode = (await execCommand(`stat -c '%a' "${file}"`)).trim();
    if (currentMode !== "644") {
      const command = `chmod 644 "${file}"`;
      if (flags.indexOf("-dry") >= 0) {
        console.log(command);
      } else {
        await execCommand(command);
      }
    }
  }

  console.log("Done");
  console.log("");
}

async function doRenameToLowercase(files, flags) {
  console.log("Renaming files to lower case...");

  for (const file of files) {
    const fromFile = file;
    const toFile = file.toLowerCase();
    if (fromFile !== toFile) {
      const command = `mv "${fromFile}" "${toFile}"`;
      if (flags.indexOf("-dry") >= 0) {
        console.log(command);
      } else {
        await execCommand(command);
      }
    }
  }

  console.log("Done");
  console.log("");
}

async function doRenameToHash(files, flags) {
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
  const possibleExtensions = [".nef", ".jpg", ".nef.xmp", ".jpg.xmp"];
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
        if (flags.indexOf("-dry") >= 0) {
          console.log(command);
        } else {
          await execCommand(command);
        }
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

