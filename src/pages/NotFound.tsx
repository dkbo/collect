import { ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/toybox'
import '@/pages/NotFound.css'

export function NotFound() {
  return (
    <div className="tb-container notfound-page" data-testid="page-not-found">
      <div className="notfound-body">
        <div className="notfound-screen tb-tilt-2" aria-hidden="true">
          <span className="font-pixel text-pixel-xl text-pop">404</span>
          <span className="font-pixel text-pixel-m text-on-inverse-muted">NO SIGNAL</span>
        </div>

        <h1 className="m-0 text-heading-l text-ink">找不到頁面</h1>
        <p className="m-0 max-w-sm text-body text-ink-muted">抱歉，您所尋找的頁面似乎並不存在，或是已經被移除了。</p>

        <div className="flex flex-wrap justify-center gap-4">
          <Button icon={<ArrowLeft strokeWidth={2.5} aria-hidden="true" />} onClick={() => window.history.back()}>
            返回上頁
          </Button>
          <Button variant="primary" href="/" icon={<Home strokeWidth={2.5} aria-hidden="true" />}>
            返回首頁
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
