import type { ComponentChildren } from "preact";
import { SiteFooter } from "./SiteFooter";
import "./SiteFrame.css";

interface SiteFrameProps {
  children: ComponentChildren;
}

export function SiteFrame({ children }: SiteFrameProps) {
  return (
    <div class="site-frame">
      {children}
      <SiteFooter />
    </div>
  );
}
