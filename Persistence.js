const SSHClient = require('ssh2').Client;
const scp = require('scp2').scp;
const urlParse = require('url-parse');
const fs = require('fs');
const fsextra = require('fs-extra');
const dirname = require('path').dirname;
const mkdirp = require('mkdirp');
const homedir = require('homedir');

class Persistence {
  constructor(destination) {
    this.parseDestination(destination);
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.sshConfig) {
        this.sshConnection = new SSHClient();
        this.sshConnection.on('ready', resolve);
        this.sshConnection.on('error', reject);
        this.sshConnection.connect(this.sshConfig);
      } else {
        resolve();
      }
    });
  }

  copy(from, to) {
    const toPath = this.getPathFromUrl(to);
    return new Promise((resolve, reject) => {
      this.createParentDirectory(dirname(toPath)).then(() => {
        this.copyLocalOrRemote(from, toPath).then(resolve, reject);
      }, reject);
    });
  }

  move(from, to) {
    return new Promise((resolve, reject) => {
      if (from.match(/\w+@\w+/)) {
        this.sshConnection.exec(
          `mv ${this.getPathFromUrl(from)} ${this.getPathFromUrl(to)}`,
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      } else {
        fsextra.move(from, to, { clobber: true }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  rmdir(path) {
    return new Promise((resolve, reject) => {
      if (this.sshConfig) {
        this.sshConnection.exec(`rmdir ${this.getPathFromUrl(path)}`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        fs.rmdir(path, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  getPathFromUrl(url) {
    if (this.sshConfig) {
      return urlParse(url).pathname;
    }

    return url;
  }

  copyLocalOrRemote(from, to) {
    return new Promise((resolve, reject) => {
      if (this.sshConfig) {
        const config = JSON.parse(JSON.stringify(this.sshConfig));
        config.path = to;
        scp(from, config, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        fsextra.copy(from, to, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  createParentDirectory(path) {
    return new Promise((resolve, reject) => {
      if (this.sshConfig) {
        this.sshConnection.exec(`mkdir -p ${this.getPathFromUrl(path)}`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        mkdirp(path, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  parseDestination(destination) {
    if (destination.match(/\w+@\w+/) && !destination.match(/^ssh:\/\//)) {
      destination = `ssh://${destination}`;
    }

    destination = destination.replace(/^(.+?@.+?):(.+)$/, '$1$2');

    let sshConfig = urlParse(destination);
    let privateKey;

    if (sshConfig && (!sshConfig.username || !sshConfig.hostname)) {
      sshConfig = undefined;
    } else if (sshConfig && sshConfig.username && !sshConfig.password) {
      try {
        privateKey = fs.readFileSync(
          process.env.SSH_PRIVATE_KEY || `${homedir()}/.ssh/id_rsa`
        ).toString();
      } catch (error) {}
    }

    if (sshConfig) {
      this.sshConfig = {
        privateKey,
        username: sshConfig.username,
        password: sshConfig.password,
        host: sshConfig.hostname,
        path: sshConfig.pathname
      };
    }
  }
}

module.exports = Persistence;
