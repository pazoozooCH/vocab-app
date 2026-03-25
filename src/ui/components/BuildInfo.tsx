import { useState } from 'react'

export function BuildInfo() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="build-info" onClick={() => setExpanded(!expanded)}>
      <span className="build-info__summary">v{__BUILD_NUMBER__}</span>
      {expanded && (
        <div className="build-info__details">
          <div>Build: #{__BUILD_NUMBER__}</div>
          <div>Date: {__BUILD_DATE__}</div>
          <div>Commit: {__BUILD_SHORT_HASH__}</div>
        </div>
      )}
    </div>
  )
}
