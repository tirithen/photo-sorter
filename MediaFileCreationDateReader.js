const ExifImage = require('exif').ExifImage;

class MediaFileCreationDateReader {
  getDate(filename) {
    return new Promise((resolve, reject) => {
      try {
        new ExifImage({ image: filename }, (error, exifData) => {
          if (error) {
            const date = this.extractDateString(filename);
            if (date) {
              resolve(date);
            } else {
              reject(error);
            }
          } else {
            resolve(this.extractDateString(exifData.image.ModifyDate));
          }
        });
      } catch (error) {
        const date = this.extractDateString(filename);
        if (date) {
          resolve(date);
        } else {
          reject(error);
        }
      }
    });
  }

  extractDateString(string) {
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
        return date;
      }
    }

    throw new Error('Unable to parse date from string');
  }
}

module.exports = MediaFileCreationDateReader;
