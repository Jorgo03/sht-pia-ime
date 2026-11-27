import { Component } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// After a deploy, a tab opened earlier asks for page files that no longer
// exist; the import fails with one of these messages (Chrome, Firefox, Safari).
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Unable to preload CSS/i

const isChunkError = (error) => CHUNK_ERROR.test(`${error?.name ?? ''} ${error?.message ?? ''}`)

function Fallback({ error, onRetry }) {
  const { t } = useTranslation()
  const chunk = isChunkError(error)
  return (
    <div className="page container section">
      <div className="state" role="alert">
        <p>{chunk ? t('errors.generic') : t('web.error')}</p>
        <button
          type="button"
          className="btn btn-outline"
          // A missing page file only comes back with a fresh load of the site.
          onClick={chunk ? () => window.location.reload() : onRetry}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t('common.retry')}
        </button>
      </div>
    </div>
  )
}

// A page that throws while drawing, or whose file fails to load, shows this
// instead of unmounting the whole site into a blank page. `resetKey` (the
// address) clears it, so going to another page works again.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, key: props.resetKey }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  render() {
    if (this.state.error) return <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} />
    return this.props.children
  }
}
