import { useState } from 'react'
import { Language } from '../../domain/values/Language'
import { Word } from '../../domain/entities/Word'
import { WordStatus } from '../../domain/values/WordStatus'
import { addWord } from '../../application/usecases/addWord'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { usePersistedState } from '../hooks/usePersistedState'
import { DeckSelector } from '../components/DeckSelector'
import { WordCard } from '../components/WordCard'

type InputMode = 'single' | 'batch'

export function AddWordPage() {
  const { user } = useAuth()
  const { wordRepository, translationService } = useServices()
  const [mode, setMode] = usePersistedState<InputMode>('addWord.mode', 'single')
  const [word, setWord] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [language, setLanguage] = usePersistedState<Language>('addWord.language', Language.EN)
  const [deck, setDeck] = usePersistedState<string>('addWord.deck', '')
  const { decks, reload: reloadDecks } = useDecks(language)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Word[]>([])
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, Word[]>>({})
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)

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
    if (!user || !word.trim() || !deck) return

    setIsLoading(true)
    setError(null)
    setDuplicatesMap({})
    try {
      const result = await addWord(
        { word: word.trim(), language, deck, userId: user.id },
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
    if (!user || !batchInput.trim() || !deck) return

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
    const errors: string[] = []

    for (let i = 0; i < words.length; i++) {
      setBatchProgress({ current: i + 1, total: words.length })
      try {
        const result = await addWord(
          { word: words[i], language, deck, userId: user.id },
          { wordRepository, translationService },
        )
        added.push(result)
        setResults([...added])
        checkDuplicates(result)
      } catch (err) {
        errors.push(`"${words[i]}": ${err instanceof Error ? err.message : 'failed'}`)
      }
    }

    setBatchProgress(null)
    setIsLoading(false)
    if (errors.length > 0) {
      setError(`Some words failed:\n${errors.join('\n')}`)
    }
    if (added.length > 0) {
      setBatchInput('')
    }
  }

  const handleRefine = async (originalWord: Word, context: string) => {
    if (!user) return

    // Strip any existing classifier from the word before re-translating
    const bareWord = originalWord.word.replace(/\s*_\[.*?\]_$/, '')

    const translation = await translationService.translate(
      bareWord,
      originalWord.language,
      context,
    )

    const refined = Word.create({
      id: originalWord.id,
      userId: originalWord.userId,
      word: translation.word ?? bareWord,
      language: originalWord.language,
      translations: translation.translations,
      sentencesSource: translation.sentencesSource,
      sentencesGerman: translation.sentencesGerman,
      deck: originalWord.deck,
      status: originalWord.status as typeof WordStatus.Pending | typeof WordStatus.Exported,
      createdAt: originalWord.createdAt,
      exportedAt: originalWord.exportedAt,
    })

    await wordRepository.update(refined)

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
            onClick={() => { setLanguage(Language.EN); setDeck('') }}
          >
            EN
          </button>
          <button
            id="lang-fr"
            type="button"
            className={`language-toggle__btn ${language === Language.FR ? 'language-toggle__btn--active' : ''}`}
            onClick={() => { setLanguage(Language.FR); setDeck('') }}
          >
            FR
          </button>
        </div>

        <DeckSelector
          decks={decks}
          selectedDeck={deck}
          onSelect={setDeck}
          onDeckCreated={reloadDecks}
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
            !deck
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
          <h3>Added ({results.length})</h3>
          {results.map((w) => (
            <WordCard key={w.id} word={w} duplicates={duplicatesMap[w.id]} onRefine={handleRefine} />
          ))}
        </div>
      )}
    </div>
  )
}
