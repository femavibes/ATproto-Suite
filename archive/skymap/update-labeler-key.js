import { AtpAgent } from '@atproto/api';
import { Secp256k1Keypair } from '@atproto/crypto';

const agent = new AtpAgent({ service: 'https://bsky.social' });

await agent.login({
  identifier: 'skymap10000.bsky.social',
  password: 'giad-atw2-urz4-palz'
});

const signingKeyHex = '5ec7697f5e191907367671b0e03d807c897713c807d5f5a3611f66e8092e1bc2';
const signingKey = await Secp256k1Keypair.import(Buffer.from(signingKeyHex, 'hex'));
const publicKeyMultibase = signingKey.did().split(':')[2];

console.log('Public key multibase:', publicKeyMultibase);

// Update PLC with new labeler key
const plcOp = await agent.com.atproto.identity.updateHandle({
  rotationKeys: [publicKeyMultibase]
});

console.log('Updated!');
