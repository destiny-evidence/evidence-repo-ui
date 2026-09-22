import { PRIVACY_PATH } from "@/services/navigation";
import "./SiteFooter.css";

interface SiteFooterProps {
  now?: Date;
}

export function SiteFooter({ now = new Date() }: SiteFooterProps) {
  return (
    <footer class="site-footer">
      <div class="site-footer__inner">
        <span class="site-footer__copyright">© {now.getFullYear()}</span>
        <a class="site-footer__link" href={PRIVACY_PATH}>
          Privacy policy
        </a>
      </div>
    </footer>
  );
}
