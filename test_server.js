#!/usr/bin/env node
import { spawn } from 'child_process';

const server = spawn('node', ['index.js']);

setTimeout(() => {
  const testMsg = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  };
  
  server.stdin.write(JSON.stringify(testMsg) + '\n');
  
  setTimeout(() => {
    server.kill();
    console.log('✓ Server test completed');
    process.exit(0);
  }, 1000);
}, 500);

server.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});
