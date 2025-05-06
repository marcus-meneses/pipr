const fs = require("fs");
const path = require("path");

class Utils {

    listZipFiles(directory) {
      const files = fs.readdirSync(directory);
      const zipFiles = files.filter(
        (file) => path.extname(file).toLowerCase() === ".zip"
      );
      if (zipFiles.length === 0) {
        throw new Error("No function deployed.");
      }
      if (zipFiles.length > 1) {
        throw new Error("More than one function deployed.");
      }
      return zipFiles;
    }

}

module.exports =  new Utils();