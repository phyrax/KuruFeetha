import{env}from"cloudflare:workers";
import{authErrorResponse,requireAdmin}from"../../../../../lib/auth";
import{analyzeClassifierStory}from"../../../../../lib/content-type-classifier";
import{OpenAIContentTypeProvider,providerDiagnostic}from"../../../../../lib/openai-content-type-provider";

export const dynamic="force-dynamic";
async function mapLimit<T,R>(items:T[],limit:number,work:(item:T)=>Promise<R>){const results:R[]=[];let next=0;async function worker(){while(next<items.length){const index=next++;results[index]=await work(items[index])}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return results}
export async function POST(request:Request){
  try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const body=await request.json().catch(()=>null)as{storyId?:string;analyzeAll?:boolean;force?:boolean}|null,db=(env as unknown as{DB:D1Database;OPENAI_API_KEY?:string;CONTENT_CLASSIFIER_MODEL?:string}).DB,runtime=env as unknown as{OPENAI_API_KEY?:string;CONTENT_CLASSIFIER_MODEL?:string};
  let ids:string[]=[];if(body?.storyId)ids=[body.storyId];else if(body?.analyzeAll){const rows=await db.prepare(`SELECT DISTINCT c.id FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id WHERE c.status='published' AND t.review_status='published' AND t.article_status='published' AND t.article_content IS NOT NULL AND t.article_published_at IS NOT NULL AND t.content_type IS NULL ORDER BY t.article_published_at DESC LIMIT 100`).all<{id:string}>();ids=rows.results.map(row=>row.id)}else return Response.json({error:{code:"INVALID_INPUT",message:"Choose one story or Analyze all NULL stories"}},{status:400});
  let provider;try{provider=new OpenAIContentTypeProvider(runtime)}catch(error){return Response.json({error:{code:"AI_NOT_CONFIGURED",message:(error as Error).message}},{status:503})}
  const results=await mapLimit(ids,3,async storyId=>{try{return{ok:true,storyId,recommendation:await analyzeClassifierStory(db,provider,storyId,{force:Boolean(body?.force)})}}catch(error){const diagnostic=providerDiagnostic(error);if(diagnostic)console.error("OPENAI_PROVIDER_FAILURE",diagnostic);return{ok:false,storyId,error:diagnostic?{code:diagnostic.diagnosticCode,message:diagnostic.message,provider:diagnostic.provider,model:diagnostic.model,httpStatus:diagnostic.httpStatus,errorType:diagnostic.errorType,errorCode:diagnostic.errorCode,requestId:diagnostic.requestId,responseStatus:diagnostic.responseStatus,incompleteReason:diagnostic.incompleteReason}:{code:"CLASSIFICATION_FAILED",message:(error as Error).message}}}});return Response.json({results});
}
