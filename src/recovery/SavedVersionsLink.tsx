import { Link } from "react-router-dom";
import type { WritingKind } from "./saved-types";
import { savedVersionsUrl } from "./version-presentation";
import { recoveryUrl } from "./presentation";
export function SavedVersionsLink({kind,targetId,returnTo,pending=false}:{kind:WritingKind;targetId:string;returnTo:string;pending?:boolean}) {
  return pending?<span className="saved-versions-link" aria-disabled="true">Earlier saved versions</span>:<Link className="saved-versions-link" id={`saved-versions-${targetId}`} to={savedVersionsUrl(null,returnTo,20,`${kind}:${targetId}`)}>Earlier saved versions →</Link>;
}
export function RecoveryNavigation({returnTo,versions=false}:{returnTo:string;versions?:boolean}) {
  return <nav className="recovery-views" aria-label="Recovery views"><Link aria-current={!versions?"page":undefined} to={recoveryUrl(null,returnTo)}>Drafts</Link><Link aria-current={versions?"page":undefined} to={savedVersionsUrl(null,returnTo)}>Saved versions</Link></nav>;
}
