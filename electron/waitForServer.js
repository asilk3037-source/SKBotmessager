const http = require('node:http');

function waitForServer(url, { timeout = 20000, interval = 300 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, interval);
      });
    };
    check();
  });
}

module.exports = { waitForServer };
