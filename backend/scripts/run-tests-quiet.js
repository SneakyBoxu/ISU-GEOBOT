/**
 * The test suite with the application logger silenced.
 *
 * WHY THIS EXISTS. The suite deliberately drives code paths that warn: the
 * egress filter blocking a room number, the router discarding a location id the
 * model invented. Those warnings are the system reporting that it did its job,
 * and they are useful while developing. On a projector they are a wall of JSON
 * that reads as errors to anyone who is not reading closely.
 *
 * `npm test` keeps the warnings. `npm run test:quiet` hides them. Nothing else
 * differs -- same runner, same files, same assertions.
 *
 * NOT a shell prefix. `LOG_LEVEL=silent npm test` works in bash and fails in
 * Windows cmd, which is where this project is actually run. Setting the
 * variable in the parent process and inheriting it works everywhere.
 */
import { spawn } from 'node:child_process';

const child = spawn(
  process.execPath,
  ['--test', 'tests/**/*.test.js'],
  {
    stdio: 'inherit',
    env: { ...process.env, LOG_LEVEL: 'silent' },
    cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
