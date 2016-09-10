const SSHClient = require('ssh2').Client;
const scp = require('scp2').scp;
const sshUrl = require('ssh-url');
const fs = require('fs');
const fsextra = require('fs-extra');
const dirname = require('path').dirname;
const mkdirp = require('mkdirp');

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
    const toPath = this.getPathFromRemotePath(to);
    return new Promise((resolve, reject) => {
      this.createParentDirectory(dirname(toPath)).then(() => {
        this.copyLocalOrRemote(from, toPath).then(resolve, reject);
      }, reject);
    });
  }

  move(from, to) {
    return new Promise((resolve, reject) => {
      if (from.match(/\w+@\w+/)) {
        this.sshConnection.exec(`mv ${from} ${to}`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
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
        this.sshConnection.exec(`rmdir ${path}`, (error) => {
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

  copyLocalOrRemote(from, to) {
    return new Promise((resolve, reject) => {
      if (this.sshConfig) {
        const config = JSON.parse(JSON.stringify(this.sshConfig));
        config.path += `/${to}`;
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
        this.sshConnection.exec(`mkdir -p ${path}`, (error) => {
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

  getPathFromRemotePath(path) {
    const parts = path.split(':');

    if (parts.length === 2) {
      return parts[1];
    }

    return parts[0];
  }

  parseDestination(destination) {
    let sshConfig = sshUrl.parse(destination);
    let privateKey;

    if (sshConfig && !sshConfig.user) {
      sshConfig = undefined;
    } else {
      try {
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY || '~/.ssh/id_rsa');
      } catch (error) {}
    }

    if (sshConfig && !privateKey) {
      throw new Error(
        'No private SSH key file found, make sure to set environment variable SSH_PRIVATE_KEY'
      );
    }

    if (sshConfig && privateKey) {
      this.sshConfig = {
        privateKey,
        username: sshConfig.user,
        host: sshConfig.hostname,
        path: sshConfig.pathname
      };
    }
  }
}

module.exports = Persistence;
