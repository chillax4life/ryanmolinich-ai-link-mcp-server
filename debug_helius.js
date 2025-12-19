import * as HeliusSdk from 'helius-sdk';
import { createRequire } from 'module';

console.log('--- ESM Wildcard Import ---');
console.log(HeliusSdk);

try {
    const require = createRequire(import.meta.url);
    const HeliusCjs = require('helius-sdk');
    console.log('\n--- CommonJS Require ---');
    console.log(HeliusCjs);
} catch (e) {
    console.log('CJS require failed:', e.message);
}
