"use client";
import{useEffect,useState,type ReactNode}from"react";
import Link from"next/link";

export const contactEmail="epsilon.sole@gmail.com",publicPhone="+960 9781818",publicAddress="M. Arimatheege, Male', Maldives";

export function PolicyShell({language,title,eyebrow,children}:{language:"en"|"dv";title:string;eyebrow:string;children:ReactNode}){
  return <main className="policy-page transparency-page" dir={language==="dv"?"rtl":"ltr"}><Link href="/" className="article-brand"><span>ކ</span><strong>KuruFeetha</strong></Link><article><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</article></main>;
}

export function PendingTransparencyPage({language,title}:{language:"en"|"dv";title:string}){
  return <PolicyShell language={language} title={title} eyebrow="KURUFEETHA"><p>Policy content is being finalized.</p></PolicyShell>;
}

export function TransparencyLinks({language:requestedLanguage,className="transparency-links"}:{language?:"en"|"dv";className?:string}){
  const[storedLanguage,setStoredLanguage]=useState<"en"|"dv">("en");
  useEffect(()=>{if(requestedLanguage)return;const update=()=>setStoredLanguage(localStorage.getItem("kurufeetha-language")==="dv"?"dv":"en");update();const shell=document.querySelector(".app-shell"),observer=shell?new MutationObserver(update):null;observer?.observe(shell!,{attributes:true,attributeFilter:["dir"]});window.addEventListener("storage",update);return()=>{observer?.disconnect();window.removeEventListener("storage",update)}},[requestedLanguage]);
  const language=requestedLanguage??storedLanguage;
  const labels=language==="dv"?{about:"About",contact:"Contact",standards:"Editorial Standards",corrections:"Corrections"}:{about:"About",contact:"Contact",standards:"Editorial Standards",corrections:"Corrections"};
  return <nav className={className} aria-label="KuruFeetha transparency"><Link href={`/${language}/about`}>{labels.about}</Link><Link href={`/${language}/contact`}>{labels.contact}</Link><Link href={`/${language}/editorial-standards`}>{labels.standards}</Link><Link href={`/${language}/corrections`}>{labels.corrections}</Link></nav>;
}
