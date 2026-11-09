import {spawnSync} from 'node:child_process';
const exe=process.argv[2];if(!exe)throw Error('Pass Vercel executable');
const read=spawnSync(exe,['project','protection','--json'],{encoding:'utf8',windowsHide:true});
if(read.status!==0)throw Error('Cannot read protection settings');
const settings=JSON.parse(read.stdout);
// Only revoke the one secret created by this verification run, never a key
// independently created by the user or a later test run.
const entry=Object.entries(settings.protectionBypass||{}).find(([,meta])=>meta.createdAt===1794197356034);
if(entry){
 const result=spawnSync(exe,['api','/v1/projects/onplan-coaching/protection-bypass','--method','PATCH','--input','-','--silent'],{input:JSON.stringify({revoke:{secret:entry[0],regenerate:false}}),encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw Error('Verification key revocation failed');
 console.log('Revoked the verification-only automation key.');
}else console.log('Verification-only key already absent.');
