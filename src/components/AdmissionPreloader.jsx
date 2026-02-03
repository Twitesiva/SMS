const AdmissionPreloader = ({
  title = 'Loading admission data',
  subtitle = 'Fetching programmes and groups.',
  rowCount = 6
}) => {
  return (
    <div className="admission-preloader" role="status" aria-live="polite">
      <div className="admission-preloader__header">
        <div className="admission-preloader__spinner" aria-hidden="true"></div>
        <div>
          <div className="admission-preloader__title">{title}</div>
          <div className="admission-preloader__subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="admission-preloader__table" aria-hidden="true">
        {Array.from({ length: rowCount }).map((_, index) => (
          <div className="admission-preloader__row" key={`admission-preload-${index}`}>
            <div className="admission-preloader__cell admission-preloader__cell--sm admission-preloader__shimmer"></div>
            <div className="admission-preloader__cell admission-preloader__cell--lg admission-preloader__shimmer"></div>
            <div className="admission-preloader__cell admission-preloader__cell--md admission-preloader__shimmer"></div>
            <div className="admission-preloader__cell admission-preloader__cell--md admission-preloader__shimmer"></div>
          </div>
        ))}
      </div>
      <span className="sr-only">{title}...</span>
    </div>
  )
}

export default AdmissionPreloader
