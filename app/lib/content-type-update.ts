import {articleContentTypes,type ArticleContentType} from "./authors.ts";

export type ContentTypeValue=ArticleContentType|null;
export type ContentTypeUpdateInput={cardId:string;translationId:string;contentType:ArticleContentType;expectedContentType:ContentTypeValue};
type TranslationRow={id:string;cardId:string;language:"en"|"dv";contentType:ContentTypeValue};
type MutationResult={meta?:{changes?:number}};
interface Statement{bind(...values:unknown[]):Statement;first<T>():Promise<T|null>}
export interface ContentTypeDatabase{prepare(query:string):Statement;batch(statements:Statement[]):Promise<MutationResult[]>}

export class ContentTypeUpdateError extends Error{
  status:400|404|409;code:string;
  constructor(status:400|404|409,code:string,message:string){super(message);this.status=status;this.code=code}
}

function contentType(value:unknown,field:string,{nullable}:{nullable:boolean}){
  if(value===null&&nullable)return null;
  if(typeof value!=="string"||!articleContentTypes.includes(value as ArticleContentType))throw new ContentTypeUpdateError(400,"INVALID_CONTENT_TYPE",`${field} must be News, Opinion, Editorial, or Press Release`);
  return value as ArticleContentType;
}

export function parseContentTypeUpdate(body:unknown,cardId:string):ContentTypeUpdateInput{
  if(!body||typeof body!=="object")throw new ContentTypeUpdateError(400,"INVALID_INPUT","Choose a translation and content type");
  const input=body as Record<string,unknown>,translationId=typeof input.translationId==="string"?input.translationId.trim():"";
  if(!cardId||!translationId||!("expectedContentType" in input))throw new ContentTypeUpdateError(400,"INVALID_INPUT","Choose a translation and provide its current content type");
  return{cardId,translationId,contentType:contentType(input.contentType,"contentType",{nullable:false})!,expectedContentType:contentType(input.expectedContentType,"expectedContentType",{nullable:true})};
}

export async function updateContentTypeOnly(db:ContentTypeDatabase,input:ContentTypeUpdateInput,actorId:string,now=Date.now(),auditId=crypto.randomUUID()){
  const current=await db.prepare("SELECT id,card_id AS cardId,language,content_type AS contentType FROM news_card_translations WHERE id=? AND card_id=?").bind(input.translationId,input.cardId).first<TranslationRow>();
  if(!current)throw new ContentTypeUpdateError(404,"TRANSLATION_NOT_FOUND","The selected article translation was not found");
  if(current.contentType!==input.expectedContentType)throw new ContentTypeUpdateError(409,"STALE_CONTENT_TYPE","The content type changed after this article was loaded. Refresh before trying again.");
  if(current.contentType===input.contentType)throw new ContentTypeUpdateError(400,"NO_CHANGE","Choose a different content type");
  const before=JSON.stringify({translationId:current.id,cardId:current.cardId,language:current.language,contentType:current.contentType});
  const after=JSON.stringify({translationId:current.id,cardId:current.cardId,language:current.language,contentType:input.contentType,operation:"content_type_update"});
  const results=await db.batch([
    db.prepare("UPDATE news_card_translations SET content_type=? WHERE id=? AND card_id=? AND content_type IS ?").bind(input.contentType,input.translationId,input.cardId,input.expectedContentType),
    db.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before,after,created_at) SELECT ?,?,'translation.content_type_updated','news_card',?,?,?,? WHERE changes()=1").bind(auditId,actorId,input.cardId,before,after,now),
  ]);
  if(Number(results[0]?.meta?.changes??0)!==1)throw new ContentTypeUpdateError(409,"STALE_CONTENT_TYPE","The content type changed after this article was loaded. Refresh before trying again.");
  return{cardId:input.cardId,translationId:input.translationId,language:current.language,previousContentType:current.contentType,contentType:input.contentType};
}
