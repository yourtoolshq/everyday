import { runCli } from "./run";

// Platform logs go to stderr so stdout carries only the command's result.
console.info = console.error.bind(console);

void runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
}).then((code) => {
  process.exitCode = code;
});
