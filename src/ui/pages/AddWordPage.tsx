import { useState } from 'react'
import { Language } from '../../domain/values/Language'
import type { Word } from '../../domain/entities/Word'
import { addWord } from '../../application/usecases/addWord'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { DeckSelector } from '../components/DeckSelector'
import { WordCard } from '../components/WordCard'

export function AddWordPage() {
  const { user } = useAuth()
  const { wordRepository, translationService } = useServices()
  const { decks, reload: reloadDecks } = useDecks()

  const [word, setWord] = useState('')
  const [language, setLanguage] = useState<Language>(Language.EN)
  const [deck, setDeck] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<Word | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !word.trim() || !deck) return

    setIsLoading(true)
    setError(null)
    try {
      const result = await addWord(
        { word: word.trim(), language, deck, userId: user.id },
        { wordRepository, translationService },
      )
      setLastResult(result)
      setWord('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="add-word-page">
      <form className="add-word-form" onSubmit={handleSubmit}>
        <div className="language-toggle">
          <button
            type="button"
            className={`language-toggle__btn ${language === Language.EN ? 'language-toggle__btn--active' : ''}`}
            onClick={() => setLanguage(Language.EN)}
          >
            EN
          </button>
          <button
            type="button"
            className={`language-toggle__btn ${language === Language.FR ? 'language-toggle__btn--active' : ''}`}
            onClick={() => setLanguage(Language.FR)}
          >
            FR
          </button>
        </div>

        <input
          className="add-word-form__input"
          type="text"
          placeholder="Enter a word…"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoFocus
          disabled={isLoading}
        />

        <DeckSelector
          decks={decks}
          selectedDeck={deck}
          onSelect={setDeck}
          onDeckCreated={reloadDecks}
        />

        <button
          className="btn btn--primary"
          type="submit"
          disabled={isLoading || !word.trim() || !deck}
        >
          {isLoading ? 'Translating…' : 'Add Word'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {lastResult && (
        <div className="add-word-result">
          <h3>Added</h3>
          <WordCard word={lastResult} />
        </div>
      )}
    </div>
  )
}
