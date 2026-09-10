import { listedCommunities } from "@/services/communities";
import "./CommunityLinks.css";

/**
 * Signpost to the communities a visitor can enter.
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
