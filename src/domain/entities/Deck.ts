interface DeckProps {
  id: string
  name: string
  userId: string
}

export class Deck {
  readonly id: string
  readonly name: string
  readonly userId: string

  private constructor(props: DeckProps) {
    this.id = props.id
    this.name = props.name
    this.userId = props.userId
  }

  static create(props: DeckProps): Deck {
    const trimmed = props.name.trim()
    if (trimmed.length === 0) {
      throw new Error('Deck name cannot be empty')
    }
    return new Deck({ ...props, name: trimmed })
  }

  rename(name: string): Deck {
    return Deck.create({ id: this.id, name, userId: this.userId })
  }
}
