import { useState, useEffect, useCallback } from 'react'
import { Language } from '../../domain/values/Language'
import { Word } from '../../domain/entities/Word'
import { addWord } from '../../application/usecases/addWord'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { usePersistedState } from '../hooks/usePersistedState'
import { DeckSelector } from '../components/DeckSelector'
import { ExpandableWordRow } from '../components/ExpandableWordRow'
import { getDeckName } from '../hooks/useDeckName'
import { setNavigationGuard } from '../hooks/useNavigationGuard'
import { useRefineWord } from '../hooks/useRefineWord'

type InputMode = 'single' | 'batch'

export function AddWordPage() {
  const { user } = useAuth()
  const { wordRepository, translationService } = useServices()
  const [mode, setMode] = usePersistedState<InputMode>('addWord.mode', 'single')
  const [word, setWord] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [language, setLanguage] = usePersistedState<Language>('addWord.language', Language.EN)
  const [deckId, setDeckId] = usePersistedState<string>('addWord.deckId', '')
  const { decks, reload: reloadDecks } = useDecks(language)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Word[]>([])
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, Word[]>>({})
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)

  // Set navigation guard when there are results or an active import
  const shouldBlock = results.length > 0 || isLoading
  useEffect(() => {
    if (isLoading) {
      setNavigationGuard('A batch import is in progress. Leaving will interrupt it. Are you sure?')
    } else if (results.length > 0) {
      setNavigationGuard('You have added words on this page. Leaving will clear them. Are you sure?')
    } else {
      setNavigationGuard(null)
    }
    return () => setNavigationGuard(null)
  }, [isLoading, results.length])
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (shouldBlock) {
      e.preventDefault()
    }
  }, [shouldBlock])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])

  const handleClearResults = () => {
    setResults([])
    setDuplicatesMap({})
    setError(null)
  }

  const checkDuplicates = async (addedWord: Word) => {
    if (!user) return
    const dupes = await wordRepository.findDuplicates(
      addedWord.word,
      addedWord.language,
      user.id,
      addedWord.id,
    )
    if (dupes.length > 0) {
      setDuplicatesMap((prev) => ({ ...prev, [addedWord.id]: dupes }))
    }
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !word.trim() || !deckId) return

    setIsLoading(true)
    setError(null)
    setDuplicatesMap({})
    try {
      const result = await addWord(
        { word: word.trim(), language, deckId, userId: user.id },
        { wordRepository, translationService },
      )
      setResults([result])
      setWord('')
      checkDuplicates(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !batchInput.trim() || !deckId) return

    const words = batchInput
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)

    if (words.length === 0) return

    setIsLoading(true)
    setError(null)
    setResults([])
    setDuplicatesMap({})
    setBatchProgress({ current: 0, total: words.length })

    const added: Word[] = []
    const failedWords: string[] = []
    const errorMessages: string[] = []

    for (let i = 0; i < words.length; i++) {
      // Pause between requests to avoid hitting Gemini rate limits
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1500))
      }
      setBatchProgress({ current: i + 1, total: words.length })
      try {
        const result = await addWord(
          { word: words[i], language, deckId, userId: user.id },
          { wordRepository, translationService },
        )
        added.push(result)
        setResults((prev) => [...prev, result])
        checkDuplicates(result)
      } catch (err) {
        failedWords.push(words[i])
        errorMessages.push(`"${words[i]}": ${err instanceof Error ? err.message : 'failed'}`)
      }
    }

    setBatchProgress(null)
    setIsLoading(false)
    if (errorMessages.length > 0) {
      setError(`Some words failed:\n${errorMessages.join('\n')}`)
    }
    // Keep failed words in the input for retry, clear successful ones
    setBatchInput(failedWords.join(', '))
  }

  const handleDelete = async (wordToDelete: Word) => {
    if (!user) return
    if (!confirm(`Delete "${wordToDelete.word}"?`)) return
    await wordRepository.delete(wordToDelete.id, user.id)
    setResults((prev) => prev.filter((w) => w.id !== wordToDelete.id))
  }

  const refineWord = useRefineWord()

  const handleRefine = async (originalWord: Word, context: string) => {
    const refined = await refineWord(originalWord, context)
    setResults((prev) =>
      prev.map((w) => (w.id === refined.id ? refined : w)),
    )
  }

  return (
    <div className="add-word-page">
      <form
        className="add-word-form"
        onSubmit={mode === 'single' ? handleSingleSubmit : handleBatchSubmit}
      >
        <div className="language-toggle">
          <button
            id="lang-en"
            type="button"
            className={`language-toggle__btn ${language === Language.EN ? 'language-toggle__btn--active' : ''}`}
            onClick={() => { setLanguage(Language.EN); setDeckId('') }}
          >
            <span className="language-toggle__flag" role="img" aria-label="English">&#x1F1EC;&#x1F1E7;</span> EN
          </button>
          <button
            id="lang-fr"
            type="button"
            className={`language-toggle__btn ${language === Language.FR ? 'language-toggle__btn--active' : ''}`}
            onClick={() => { setLanguage(Language.FR); setDeckId('') }}
          >
            <span className="language-toggle__flag" role="img" aria-label="French">&#x1F1EB;&#x1F1F7;</span> FR
          </button>
        </div>

        <DeckSelector
          decks={decks}
          selectedDeckId={deckId}
          onSelect={setDeckId}
          onDeckCreated={reloadDecks}
          onDeckUpdated={reloadDecks}
          onDeckDeleted={reloadDecks}
          language={language}
        />

        {mode === 'single' ? (
          <>
            <input
              id="word-input"
              className="add-word-form__input"
              type="text"
              placeholder="Enter a word…"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoFocus
              disabled={isLoading}
            />
            <button
              id="mode-batch"
              type="button"
              className="mode-switch-link"
              onClick={() => setMode('batch')}
            >
              Add multiple words at once
            </button>
          </>
        ) : (
          <>
            <textarea
              id="batch-input"
              className="add-word-form__textarea"
              placeholder="Enter words separated by commas, e.g. hello, goodbye, thanks"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              autoFocus
              disabled={isLoading}
              rows={3}
            />
            <button
              id="mode-single"
              type="button"
              className="mode-switch-link"
              onClick={() => setMode('single')}
            >
              Back to single word
            </button>
          </>
        )}

        <button
          id="add-word-btn"
          className="btn btn--primary"
          type="submit"
          disabled={
            isLoading ||
            !(mode === 'single' ? word.trim() : batchInput.trim()) ||
            !deckId
          }
        >
          {isLoading
            ? batchProgress
              ? `Translating ${batchProgress.current}/${batchProgress.total}…`
              : 'Translating…'
            : mode === 'single'
              ? 'Add Word'
              : 'Add Words'}
        </button>
      </form>

      {error && <div id="error-message" className="error-message">{error}</div>}

      {results.length > 0 && (
        <div id="add-word-result" className="add-word-result">
          <div className="add-word-result__header">
            <h3>Added ({results.length})</h3>
            <button
              id="clear-results-btn"
              className="btn btn--small btn--ghost"
              onClick={handleClearResults}
            >
              Clear
            </button>
          </div>
          {results.map((w) => (
            <ExpandableWordRow key={w.id} word={w} deckName={getDeckName(w.deckId, decks)} defaultExpanded duplicates={duplicatesMap[w.id]} onRefine={handleRefine} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
