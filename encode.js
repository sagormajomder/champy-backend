// encode.js
import fs from 'node:fs';
const key = fs.readFileSync('./champy-sm-firebase-admin-key.json', 'utf8');
const base64 = Buffer.from(key).toString('base64');
console.log(base64);
