const fs = require('fs');
const path = require('path');
const ExifImage = require('exif').ExifImage;

class MediaFileCreationDateReader {
  getDate(filename) {
    return new Promise((resolve, reject) => {
      this.getDateFromFileExif(filename).then(resolve, () => {
        const date = this.extractDateString(filename);
        if (date) {
          resolve(date);
        } else {
          this.getDateFromFileParentDirectory(filename).then(resolve, () => {
            this.getDateFromFileStats(filename).then(resolve, reject);
          });
        }
      });
    });
  }

  getDateFromFileExif(filename) {
    return new Promise((resolve, reject) => {
      try {
        new ExifImage({ image: filename }, (error, exifData) => {
          if (error) {
            reject(error);
          } else {
            const date = this.extractDateString(exifData.image.ModifyDate);
            if (date) {
              resolve(date);
            } else {
              reject(new Error(`Unable to parse date from file exif information "${filename}"`));
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getDateFromFileParentDirectory(filename) {
    return new Promise((resolve, reject) => {
      const parent = path.basename(path.dirname(filename));
      const date = this.extractDateString(parent);
      if (date) {
        resolve(date);
      } else {
        reject(new Error(`Unable to parse date from parent directory "${filename}"`));
      }
    });
  }

  getDateFromFileStats(filename) {
    return new Promise((resolve, reject) => {
      fs.stat(filename, (error, stats) => {
        if (error) {
          reject(error);
        } else {
          const dateString = (new Date(stats.birthtime)).toISOString();
          const date = this.extractDateString(dateString);
          if (date) {
            resolve(date);
          } else {
            reject(new Error(`Unable to parse date from file stats "${filename}"`));
          }
        }
      });
    });
  }

  extractDateString(string) {
    let result;
    let dateMatch = string.trim().match(/(\d{4})[^a-z0-9](\d{2})[^a-z0-9](\d{2})/);

    if (!dateMatch || dateMatch.length < 4) {
      dateMatch = string.trim().match(/(\d{4})(\d{2})(\d{2})/);
    }

    if (
      dateMatch &&
      dateMatch.length === 4 &&
      dateMatch[1] > 1700 &&
      dateMatch[1] < 2200
    ) {
      const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      if (!isNaN(Date.parse(date))) {
        result = date;
      }
    }

    return result;
  }
}

module.exports = MediaFileCreationDateReader;
