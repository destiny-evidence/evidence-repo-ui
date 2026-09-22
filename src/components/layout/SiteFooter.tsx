import { PRIVACY_PATH } from "@/services/navigation";
import "./SiteFooter.css";

export function SiteFooter() {
  return (
    <footer class="site-footer">
      <div class="site-footer__inner">
        <span class="site-footer__copyright">© 2026</span>
        <a class="site-footer__link" href={PRIVACY_PATH}>
          Privacy policy
        </a>
      </div>
    </footer>
  );
}
