import { Secp256k1Keypair } from '@atproto/crypto';

const signingKeyHex = '5ec7697f5e191907367671b0e03d807c897713c807d5f5a3611f66e8092e1bc2';
const signingKey = await Secp256k1Keypair.import(Buffer.from(signingKeyHex, 'hex'));

console.log('Signing key DID:', signingKey.did());
console.log('\nYou need to update your DID document at https://plc.directory');
console.log('New atproto_label key should be:', signingKey.did());
