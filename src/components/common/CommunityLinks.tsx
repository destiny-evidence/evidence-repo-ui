import { listedCommunities } from "@/services/communities";
import "./CommunityLinks.css";

/**
 * Signpost to the communities a visitor can enter, for the slug-less pages.
 * Off the root these are plain full-page loads, which is what we want: each
 * community picks its own Keycloak entry mode (landing vs forced login) at
 * boot, so it has to be a fresh load rather than a client-side route change.
 */
export function CommunityLinks() {
  return (
    <ul class="community-links">
      {listedCommunities().map((community) => (
        <li class="community-links__item" key={community.slug}>
          <a class="community-links__link" href={`/${community.slug}`}>
            {community.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
