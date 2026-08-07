import { Hero } from "@/components/home/Hero";
import { AlphaSignals } from "@/components/home/AlphaSignals";
import { EventClusters } from "@/components/home/EventClusters";
import { SentimentDashboard } from "@/components/home/SentimentDashboard";
import { KolLeaderboard } from "@/components/home/KolLeaderboard";
import { ProjectTreemap } from "@/components/home/ProjectTreemap";
import { EventTracking } from "@/components/home/EventTracking";
import { CapitalFlow } from "@/components/home/CapitalFlow";

export default function Home() {
  return (
    <div className="space-y-16">
      <Hero />
      <AlphaSignals />
      <EventClusters />
      <SentimentDashboard />
      <KolLeaderboard />
      <ProjectTreemap />
      <EventTracking />
      <CapitalFlow />
    </div>
  );
}
