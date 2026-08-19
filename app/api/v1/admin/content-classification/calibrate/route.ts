import{env}from"cloudflare:workers";
import{authErrorResponse,requireAdmin}from"../../../../../lib/auth";
import{analyzeClassifierStory,loadClassifierStory}from"../../../../../lib/content-type-classifier";
import{OpenAIContentTypeProvider,providerDiagnostic}from"../../../../../lib/openai-content-type-provider";

export const dynamic="force-dynamic";
const batchOne=["49b8c904-1404-4243-8b88-23464565feaa","902268ac-a9b5-4d31-9ffd-bab2a75447fe","c8c7cc50-39a1-415c-93b7-4abbf4ecdb9b","bef82ee0-80f6-435b-8152-cb0dd32aa4b7","454f967c-311e-49c9-9e45-dbc40021ef7b"];

export async function POST(request:Request){
  try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const body=await request.json().catch(()=>null)as{dataset?:string}|null;if(body?.dataset!=="batch1")return Response.json({error:{code:"INVALID_CALIBRATION_DATASET",message:"Choose the trusted Batch 1 calibration dataset"}},{status:400});
  const runtime=env as unknown as{DB:D1Database;OPENAI_API_KEY?:string;CONTENT_CLASSIFIER_MODEL?:string},provider=new OpenAIContentTypeProvider(runtime),results=[];
  for(const storyId of batchOne){
    try{
      const story=await loadClassifierStory(runtime.DB,storyId);if(!story||story.translations.length!==2||story.translations.some(item=>item.contentType!=="news"))throw new Error("Trusted calibration story is incomplete or its human label changed");
      const started=Date.now(),recommendation=await analyzeClassifierStory(runtime.DB,provider,storyId,{force:true,allowClassified:true}),latencyMs=Date.now()-started;
      const result={ok:true,storyId,humanType:"news" as const,requestId:provider.lastRequestId,latencyMs,recommendation};console.info("OPENAI_CALIBRATION_STORY_SUCCESS",{storyId,requestId:result.requestId,model:recommendation.model,latencyMs,fingerprint:recommendation.fingerprint});results.push(result);
    }catch(error){const diagnostic=providerDiagnostic(error);results.push({ok:false,storyId,error:diagnostic??{message:(error as Error).message}})}
  }
  return Response.json({dataset:"batch1",results},{headers:{"cache-control":"no-store"}});
}
