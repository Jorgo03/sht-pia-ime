import { translateAll } from '../lib/translate';
import { useState } from 'react';

export function AutoTranslateButton({ sourceText, onResult, field }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!sourceText?.trim()) {
      alert('Shkruani fillimisht tekstin në Shqip.');
      return;
    }
    setLoading(true);
    try {
      const result = await translateAll(sourceText, 'sq');
      onResult(result);
    } catch (err) {
      alert(`Përkthimi dështoi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !sourceText?.trim()}
      className="auto-translate-btn"
    >
      {loading ? '🔄 Po përkthen...' : `✨ Përkthe automatikisht (${field})`}
    </button>
  );
}
