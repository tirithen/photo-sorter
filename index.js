const fs = require('fs');
const rimraf = require('rimraf');
const winston = require('winston');

const FileSystemMediaFileWalker = require('./FileSystemMediaFileWalker');
const MediaFileCreationDateReader = require('./MediaFileCreationDateReader');
const Persistence = require('./Persistence');

const sourcePath = process.argv[2];
const destinationPath = process.argv[3] || './sorted-photos';
const destinationTempPath = `${destinationPath}/temp`;

function printUsage() {
  process.stdout.write('usage: photo-sorter SOURCE_DIRECTORY [DESTINATION_DIRECTORY]\n');
  process.stdout.write('   or: photo-sorter SOURCE_DIRECTORY user@host:/destination/path\n');
  process.stdout.write(' info: Copy media files locally or via SSH from the source directory to ' +
                              'a destination directory grouped by date. Source @ https://github.com/tirithen/photo-sorter\n');
}

winston.level = 'debug';

if (!sourcePath) {
  printUsage();
  process.exit(0);
}

winston.info('Starting photo-sorter...');

if (!fs.statSync(sourcePath).isDirectory()) {
  winston.error(`Source path "${sourcePath}" must be a directory`);
  printUsage();
  process.exit(1);
}

winston.info(`Removing any old temporary directory "${destinationTempPath}"`);
rimraf.sync(destinationTempPath);

winston.info(`Sorting files from "${sourcePath}" to "${destinationPath}"`);

const persistence = new Persistence(destinationPath);
const dates = [];
persistence.connect().then(() => {
  const walker = new FileSystemMediaFileWalker();

  walker.scan(sourcePath, (path, filename) => {
    const sourceFilename = `${path}/${filename}`;

    return new Promise((resolve, reject) => {
      const reader = new MediaFileCreationDateReader();

      reader.getDate(sourceFilename).then((date) => {
        const destination = `${destinationTempPath}/${date}/${filename}`;

        if (dates.indexOf(date) === -1) {
          dates.push(date);
        }

        persistence.copy(sourceFilename, destination).then(() => {
          winston.info(`Copied "${sourceFilename}"`);
          resolve();
        }, reject);
      }, reject);
    });
  }).then(() => {
    Promise.all(dates.map((date) => {
      const from = `${destinationTempPath}/${date}`;
      const to = `${destinationPath}/${date}`;
      return persistence.move(from, to);
    })).then(() => {
      persistence.rmdir(destinationTempPath).then(() => {
        winston.info(`Finished sorting files into "${destinationPath}"`);
        process.exit(0);
      }, (error) => {
        winston.debug(error);
        winston.error(
          `Failed to remove temporary directory "${destinationTempPath}"`
        );
        process.exit(1);
      });
    }, (error) => {
      winston.debug(error);
      winston.error(
        `Failed moving files from temporary directory "${destinationTempPath}" ` +
        `to destination "${destinationPath}"`
      );
      process.exit(1);
    });
  }, (error) => {
    winston.debug(error);
    winston.error(`Failed sorting files into "${destinationPath}"`);
    process.exit(1);
  });
}, (error) => {
  winston.debug(error);
  winston.error(`Failed to connect to destination "${destinationPath}"`);
  process.exit(1);
});
