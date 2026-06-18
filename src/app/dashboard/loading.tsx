export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="route-skel-head">
        <div>
          <div className="skel route-skel-title" />
          <div className="skel route-skel-sub" />
        </div>
        <div className="skel route-skel-action" />
      </div>
      <div className="route-skel-grid">
        <div className="skel route-skel-card" />
        <div className="skel route-skel-card" />
        <div className="skel route-skel-card" />
      </div>
      <div className="skel route-skel-table" />
    </div>
  );
}
