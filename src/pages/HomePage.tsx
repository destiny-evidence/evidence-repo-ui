import { CommunityLinks } from "@/components/common/CommunityLinks";
import "./HomePage.css";

interface HomePageProps {
  path?: string;
}

export function HomePage(_props: HomePageProps) {
  return (
    <div class="home-page">
      <h1 class="home-page__title">Welcome to the Evidence Repository</h1>
      <CommunityLinks />
    </div>
  );
}
