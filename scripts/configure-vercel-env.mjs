import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const exe=process.argv[2];
if(!exe)throw Error('Pass the Vercel CLI executable path');
const source=readFileSync('.env.local','utf8');
for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']){
 const line=source.split(/\r?\n/).find(l=>l.startsWith(key+'='));
 if(!line)throw Error('Missing '+key);
 const value=line.slice(key.length+1).replace(/^"|"$/g,'');
 const result=spawnSync(exe,['env','add',key,'production','--yes','--non-interactive'],{input:value,encoding:'utf8',windowsHide:true});
 if(result.status!==0){process.stderr.write(result.stderr);throw Error('Failed to configure '+key)}
 console.log('Configured production variable: '+key);
}
