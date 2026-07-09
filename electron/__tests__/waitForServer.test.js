const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { waitForServer } = require('../waitForServer.js');

function getFreePort() {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

test('resolves as soon as the server responds', async () => {
  const server = http.createServer((req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  await waitForServer(`http://127.0.0.1:${port}/`);

  await new Promise((resolve) => server.close(resolve));
});

test('retries while nothing is listening, then resolves once the server starts', async () => {
  const port = await getFreePort();
  const waitPromise = waitForServer(`http://127.0.0.1:${port}/`, { interval: 30, timeout: 5000 });

  const server = http.createServer((req, res) => res.end('ok'));
  setTimeout(() => server.listen(port), 150);

  await waitPromise;
  await new Promise((resolve) => server.close(resolve));
});

test('rejects once the timeout elapses if nothing ever starts listening', async () => {
  const port = await getFreePort();

  await assert.rejects(
    () => waitForServer(`http://127.0.0.1:${port}/`, { interval: 20, timeout: 100 }),
    /Timed out waiting for/
  );
});
