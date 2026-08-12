import type{Metadata}from"next";import{notFound}from"next/navigation";import{PendingTransparencyPage}from"../../components/TransparencyPage";import{transparencyMetadata}from"../../lib/transparency";
// TODO: Both language versions require legal review and approved copy before indexing or navigation exposure.
export async function generateMetadata({params}:{params:Promise<{language:string}>}):Promise<Metadata>{const{language}=await params;return transparencyMetadata(language==="dv"?"dv":"en","terms")}
export default async function Terms({params}:{params:Promise<{language:string}>}){const{language}=await params;if(language!=="en"&&language!=="dv")notFound();return <PendingTransparencyPage language={language} title="Terms"/>}
