import { MessageCircle } from 'lucide-react'

export default function Messages() {
  return (
    <div className="page">
      <h1 className="page-title">Mesazhet</h1>
      <p className="page-subtitle">Bisedat me agjentët</p>
      <div className="placeholder-card">
        <div className="icon"><MessageCircle size={32} /></div>
        <div>Chat me WhatsApp — së shpejti</div>
      </div>
    </div>
  )
}
