export const authorKinds=["person","organization"] as const;
export const authorStatuses=["active","inactive"] as const;
export const articleContentTypes=["news","opinion","editorial","press_release"] as const;
export type AuthorKind=typeof authorKinds[number];
export type AuthorStatus=typeof authorStatuses[number];
export type ArticleContentType=typeof articleContentTypes[number];
export type AuthorInput={kind?:string;status?:string;slug?:string|null;nameEn?:string|null;nameDv?:string|null;bioEn?:string|null;bioDv?:string|null;publicProfileEnabled?:boolean};

export function normalizedAuthorInput(input:AuthorInput){
  if(!authorKinds.includes(input.kind as AuthorKind))throw new Error("Choose person or organization");
  const status=(input.status??"active") as AuthorStatus;if(!authorStatuses.includes(status))throw new Error("Choose an active or inactive status");
  const nameEn=input.nameEn?.trim().slice(0,120)||null,nameDv=input.nameDv?.trim().slice(0,120)||null;
  if(!nameEn&&!nameDv)throw new Error("Add an English or Dhivehi author name");
  const slug=input.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||null;
  if(input.publicProfileEnabled&&!slug)throw new Error("A slug is required when public profile is enabled");
  return{kind:input.kind as AuthorKind,status,slug,nameEn,nameDv,bioEn:input.bioEn?.trim().slice(0,2000)||null,bioDv:input.bioDv?.trim().slice(0,2000)||null,publicProfileEnabled:!!input.publicProfileEnabled};
}

export function normalizedAttribution(input:{contentType?:string|null;authorIds?:unknown}){
  const contentType=input.contentType||null;if(contentType&&!articleContentTypes.includes(contentType as ArticleContentType))throw new Error("Choose a valid content type");
  const authorIds=Array.isArray(input.authorIds)?input.authorIds.filter((id):id is string=>typeof id==="string"&&!!id.trim()).map(id=>id.trim()):[];
  if(authorIds.length>12)throw new Error("A maximum of 12 authors is supported");
  if(new Set(authorIds).size!==authorIds.length)throw new Error("The same author cannot be credited twice");
  return{contentType:contentType as ArticleContentType|null,authorIds};
}
