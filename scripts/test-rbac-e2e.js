#!/usr/bin/env node
// Helper de tests E2E RBAC. Lee stdin (JSON login) y devuelve solo accessToken.
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write(j.accessToken || '');
  } catch {
    process.stdout.write('');
  }
});