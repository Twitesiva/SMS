const HostelPreloader = ({
  title = 'Loading hostel data',
  subtitle = 'Fetching the latest records.',
  cardCount = 3
}) => {
  return (
    <div className="student-details__loading" role="status" aria-live="polite">
      <div className="student-details__loading-header">
        <div className="student-loader__spinner" aria-hidden="true"></div>
        <div>
          <div className="student-loader__title">{title}</div>
          <div className="student-loader__subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="student-details__loading-grid" aria-hidden="true">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div className="student-loader-card" key={`hostel-loader-${index}`}>
            <div className="student-loader-card__header student-loader__shimmer"></div>
            <div className="student-loader-card__line student-loader__shimmer"></div>
            <div className="student-loader-card__line student-loader__shimmer"></div>
            <div className="student-loader-card__line student-loader__shimmer"></div>
          </div>
        ))}
      </div>
      <span className="sr-only">{title}...</span>
    </div>
  )
}

export default HostelPreloader
