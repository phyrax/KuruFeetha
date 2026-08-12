import type {Metadata} from "next";
import {absoluteUrl,SITE_NAME} from "./seo.ts";

export type TransparencyPage="about"|"contact"|"editorial-standards"|"corrections"|"privacy"|"terms";
export const approvedTransparencyPages:TransparencyPage[]=["about","contact","editorial-standards","corrections"];
export const transparencyLabels:Record<Exclude<TransparencyPage,"privacy"|"terms">,string>={about:"About",contact:"Contact",corrections:"Corrections","editorial-standards":"Editorial Standards"};

const descriptions:Record<Exclude<TransparencyPage,"privacy"|"terms">,string>={
  about:"About KuruFeetha, its operator, editor and bilingual news publication in the Maldives.",
  contact:"Contact KuruFeetha for general enquiries, news tips, corrections, advertising and privacy questions.",
  "editorial-standards":"KuruFeetha's public standards for accuracy, review, editorial labels, authorship, advertising and corrections.",
  corrections:"How to report an error to KuruFeetha and how corrections, clarifications and retractions are handled.",
};

export function transparencyMetadata(language:"en"|"dv",page:TransparencyPage):Metadata{
  const approved=language==="en"&&approvedTransparencyPages.includes(page),path=`/${language}/${page}`;
  if(!approved)return{title:`${page[0].toUpperCase()+page.slice(1).replaceAll("-"," ")} — ${SITE_NAME}`,description:"Policy content is being finalized.",alternates:{canonical:absoluteUrl(path)},robots:{index:false,follow:false}};
  const label=transparencyLabels[page as keyof typeof transparencyLabels];
  return{title:`${label} — ${SITE_NAME}`,description:descriptions[page as keyof typeof descriptions],alternates:{canonical:absoluteUrl(path)},openGraph:{title:`${label} — ${SITE_NAME}`,description:descriptions[page as keyof typeof descriptions],url:absoluteUrl(path),siteName:SITE_NAME,locale:"en_MV"},other:{"content-language":"en"}};
}
