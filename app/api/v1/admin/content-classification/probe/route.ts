import{env}from"cloudflare:workers";
import{authErrorResponse,requireAdmin}from"../../../../../lib/auth";
import{OpenAIContentTypeProvider,providerDiagnostic}from"../../../../../lib/openai-content-type-provider";

export const dynamic="force-dynamic";
type Probe="plain"|"structured"|"classifier_schema";
export async function POST(request:Request){
  try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const body=await request.json().catch(()=>null)as{probe?:Probe}|null;if(!body?.probe||!["plain","structured","classifier_schema"].includes(body.probe))return Response.json({error:{code:"INVALID_PROBE",message:"Choose a supported provider probe"}},{status:400});
  const runtime=env as unknown as{OPENAI_API_KEY?:string;CONTENT_CLASSIFIER_MODEL?:string};let provider;try{provider=new OpenAIContentTypeProvider(runtime)}catch(error){return Response.json({error:{code:"AI_NOT_CONFIGURED",message:(error as Error).message}},{status:503})}
  try{const result=body.probe==="plain"?await provider.probePlain():body.probe==="structured"?await provider.probeStructured():await provider.probeClassifierSchema();return Response.json({ok:true,result})}catch(error){const diagnostic=providerDiagnostic(error);if(diagnostic){console.error("OPENAI_PROVIDER_FAILURE",diagnostic);return Response.json({ok:false,diagnostic})}console.error("OPENAI_PROVIDER_FAILURE",{diagnosticCode:"OPENAI_PROVIDER_FAILURE",provider:"openai",model:provider.model,message:"Unexpected provider diagnostic failure"});return Response.json({ok:false,diagnostic:{diagnosticCode:"OPENAI_PROVIDER_FAILURE",provider:"openai",model:provider.model,httpStatus:null,errorType:null,errorCode:null,message:"Unexpected provider diagnostic failure",requestId:null,responseStatus:null,incompleteReason:null}})}
}
