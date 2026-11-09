export async function downloadPdf(body){
 const {PDFDocument,rgb,fontkit}=await import('./vendor/pdf.js');
 const response=await fetch(new URL('./fonts/NotoSansKR-Regular.ttf',import.meta.url));if(!response.ok)throw Error('한글 글꼴을 불러오지 못했습니다.');
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(await response.arrayBuffer(),{subset:false});
 doc.setTitle('온플랜 코칭 리포트');doc.setAuthor('온플랜');
 let page,y;const pages=[];
 function next(){page=doc.addPage([595.28,841.89]);pages.push(page);page.drawRectangle({x:0,y:774,width:595.28,height:68,color:rgb(.94,.97,.95)});page.drawText('ONPLAN | 함께 만드는 공부 습관',{x:46,y:805,size:12,font,color:rgb(.13,.43,.36)});page.drawText('코치 승인 요약 리포트',{x:46,y:784,size:9,font,color:rgb(.38,.49,.43)});y=739}
 function line(text){if(y<68)next();if(text)page.drawText(text,{x:46,y,size:10,font,color:rgb(.15,.23,.20)});y-=18}
 next();for(const paragraph of body.replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').split('\n')){let text='';for(const char of paragraph){if(text&&font.widthOfTextAtSize(text+char,10)>503){line(text.trimEnd());text=''}text+=char}line(text)}
 pages.forEach((p,i)=>p.drawText(`학생 자기보고 수행 기록 | ${i+1} / ${pages.length}`,{x:46,y:30,size:8,font,color:rgb(.45,.53,.47)}));
 const url=URL.createObjectURL(new Blob([await doc.save()],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='onplan-report.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
