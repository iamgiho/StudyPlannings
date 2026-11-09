import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('web'),prefix=root+path.sep,port=Number(process.env.PORT||8766);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf'};
createServer(async(req,res)=>{
 try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,relative);if(!file.startsWith(prefix)||!(await stat(file)).isFile()){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(await readFile(file))}catch{res.writeHead(404);res.end()}
}).listen(port,'127.0.0.1',()=>console.log(`온플랜 HTML 버전: http://127.0.0.1:${port}/`));
