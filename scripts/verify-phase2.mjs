import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyPresentation} from './verify-presentation.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const historical=JSON.parse(await read('canonical/morning-grace-design-language.v1.json'));
assert.equal(historical.version,1);assert.equal(historical.typography.remoteFontDependency,false);
await verifyPresentation();
console.log('✓ Current Morning Grace presentation contracts passed; historical documents remain references only');
