export type SupportedImage={contentType:"image/jpeg"|"image/png"|"image/webp"|"image/avif";extension:"jpg"|"png"|"webp"|"avif"};

const startsWith=(bytes:Uint8Array,signature:number[])=>signature.every((byte,index)=>bytes[index]===byte);
const ascii=(bytes:Uint8Array,start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));

export function detectSupportedImage(bytes:Uint8Array):SupportedImage|null{
  if(startsWith(bytes,[0xff,0xd8,0xff]))return{contentType:"image/jpeg",extension:"jpg"};
  if(startsWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return{contentType:"image/png",extension:"png"};
  if(startsWith(bytes,[0x52,0x49,0x46,0x46])&&ascii(bytes,8,12)==="WEBP")return{contentType:"image/webp",extension:"webp"};
  if(bytes.length>=16&&ascii(bytes,4,8)==="ftyp"){
    const declaredSize=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0),boxEnd=Math.min(bytes.length,declaredSize||bytes.length);
    for(let offset=8;offset+4<=boxEnd;offset+=4)if(["avif","avis"].includes(ascii(bytes,offset,offset+4)))return{contentType:"image/avif",extension:"avif"};
  }
  return null;
}
