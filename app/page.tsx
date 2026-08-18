import { KuruFeethaApp } from "./components/KuruFeethaApp";
import { TransparencyLinks } from "./components/TransparencyPage";
import { homeMetadata } from "./lib/static-page-metadata.ts";

export const metadata = homeMetadata;

export default function Home() {
  return <><KuruFeethaApp /><TransparencyLinks className="public-transparency-footer"/></>;
}
