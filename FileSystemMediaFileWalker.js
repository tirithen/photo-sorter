const walk = require('walk').walk;

const isSupportedMediaFile = /\.(jpe?g|mp4)/i;

class FileSystemMediaFileWalker {
  scan(path, handler) {
    return new Promise((resolve, reject) => {
      const walker = walk(path);

      walker.on('file', (root, stats, next) => {
        if (stats.name.match(isSupportedMediaFile)) {
          handler(root, stats.name, stats)
            .then(
              () => { next(); },
              (error) => {
                walker.pause();
                reject(error);
              }
            );
        } else {
          next();
        }
      });

      walker.on('errors', (root, stats) => {
        walker.pause();
        reject(stats.error);
      });

      walker.on('nodeError', (root, stats) => {
        walker.pause();
        reject(stats.error);
      });

      walker.on('end', () => {
        resolve();
      });
    });
  }
}

module.exports = FileSystemMediaFileWalker;
