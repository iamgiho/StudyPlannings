import {PDFDocument,rgb,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

function wrap(text:string,font:PDFFont,size:number,width:number){
 const lines:string[]=[];let line='';
 for(const char of text){
  if(font.widthOfTextAtSize(line+char,size)>width&&line){lines.push(line.trimEnd());line=''}
  line+=char;
 }
 lines.push(line);return lines;
}
export async function createReportPdf(body:string){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const bytes=await readFile(path.join(process.cwd(),'assets/fonts/NotoSansKR-Regular.ttf'));
 const font=await doc.embedFont(bytes,{subset:false});
 doc.setTitle('온플랜 코칭 리포트');doc.setAuthor('온플랜');doc.setSubject('코치 승인 요약 리포트 · 학생 자기보고 데이터');
 const pages=[];let page=doc.addPage([595.28,841.89]);pages.push(page);let y=739;
 const header=()=>{page.drawRectangle({x:0,y:774,width:595.28,height:68,color:rgb(.94,.97,.95)});page.drawText('ONPLAN  |  함께 만드는 공부 습관',{x:46,y:805,size:12,font,color:rgb(.13,.43,.36)});page.drawText('코치 승인 요약 리포트',{x:46,y:784,size:9,font,color:rgb(.38,.49,.43)})};
 header();
 for(const paragraph of body.replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').split('\n')){
  for(const line of wrap(paragraph,font,10,503)){
   if(y<68){page=doc.addPage([595.28,841.89]);pages.push(page);header();y=739}
   if(line)page.drawText(line,{x:46,y,size:10,font,color:rgb(.15,.23,.20)});
   y-=18;
  }
 }
 pages.forEach((p,i)=>{p.drawLine({start:{x:46,y:46},end:{x:549,y:46},thickness:.5,color:rgb(.84,.89,.85)});p.drawText(`학생 자기보고 수행 기록 | ${i+1} / ${pages.length}`,{x:46,y:30,size:8,font,color:rgb(.45,.53,.47)})});
 return doc.save();
}



