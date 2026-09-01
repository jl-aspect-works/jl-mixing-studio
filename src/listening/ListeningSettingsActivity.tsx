import { ListeningPublishStatus } from "./ListeningPublishStatus";
import { useLatestListeningPublishEvent } from "./listeningPublishEvents";

export function ListeningSettingsActivity() {
  const revision = useLatestListeningPublishEvent("revision-listening-publish-results");
  const delivered = useLatestListeningPublishEvent("delivered-listening-publish-results");

  return <section className="listening-settings-activity" aria-labelledby="listening-activity-heading">
    <div className="panel-heading">
      <div>
        <p className="kicker">Observability</p>
        <h2 id="listening-activity-heading">Recent Listening Activity</h2>
        <p className="health-detail">Latest Revision and Delivered Listening results from this Studio session.</p>
      </div>
    </div>
    <div className="listening-class-grid">
      <ListeningPublishStatus
        title="Revision Listening"
        event={revision}
        emptyMessage="No Revision Listening publish result has been recorded in this session yet."
      />
      <ListeningPublishStatus
        title="Delivered Listening"
        event={delivered}
        emptyMessage="No Delivered Listening publish result has been recorded in this session yet."
      />
    </div>
  </section>;
}
