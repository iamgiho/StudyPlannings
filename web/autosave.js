export function createAutosaver({save,onState,onSaved,delay=800}){
 const entries=new Map();
 async function run(key){const e=entries.get(key);if(!e||e.running)return;clearTimeout(e.timer);e.timer=null;e.running=true;const version=e.version,cells=e.cells,context=e.context;onState(context,'saving');
 try{await save(context,cells);onSaved(context,cells);if(e.version===version){e.saved=version;onState(context,'saved')}}catch(error){if(e.version===version)onState(context,'error',error)}finally{e.running=false;if(e.version!==version)void run(key)}}
 return {queue(context,cells,wait=delay){let e=entries.get(context.key);if(!e){e={version:0,running:false};entries.set(context.key,e)}e.context=context;e.cells=structuredClone(cells);e.version++;clearTimeout(e.timer);onState(context,'pending');e.timer=setTimeout(()=>void run(context.key),wait)},flush(){for(const [key,e] of entries)if(e.version!==e.saved)void run(key)}};
}
