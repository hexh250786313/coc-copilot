import {
  ExtensionContext,
  workspace,
  languages,
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionList,
  CompletionItem,
  TextEdit,
  Range,
  CompletionItemProvider,
  MarkupKind,
} from 'coc.nvim'

type Copilot = {
  suggestions: Array<{
    displayText: string
    position: { character: number; line: number }
    range: {
      start: { character: number; line: number }
      end: { character: number; line: number }
    }
    text: string
    uuid: string
  }>
}

let previousIds: string[] = []

function hasNewIds(suggestions: Copilot['suggestions']) {
  const ids = suggestions.map((suggestion) => suggestion.uuid)
  return ids.some((id) => !previousIds.includes(id))
}

function isMatch(input: string, suggestions: Copilot['suggestions']) {
  const displayText = suggestions[0].displayText
  const text = suggestions[0].text
  return displayText + input === text
}

/** Polling to get variables until you get them or 5 seconds later */
function getSuggestions(
  buffer: any,
  autoUpdateCompletion: boolean,
  input: string
): Promise<Copilot['suggestions'] | null> {
  return new Promise((resolve) => {
    buffer.getVar('_copilot').then((copilot: Copilot | null) => {
      if (
        Array.isArray(copilot?.suggestions) &&
        copilot?.suggestions?.length &&
        hasNewIds(copilot.suggestions) && // if exist new uuid, then update
        isMatch(input, copilot.suggestions)
      ) {
        resolve(copilot!.suggestions)
        return
      }
      // if not exist new uuid, then polling
      if (autoUpdateCompletion) {
        let timer: NodeJS.Timeout | null = null
        const timeout = setTimeout(() => {
          clearInterval(timer!)
          resolve([])
        }, 5000)

        timer = setInterval(async () => {
          const copilot = (await buffer.getVar('_copilot')) as Copilot | null

          if (
            Array.isArray(copilot?.suggestions) &&
            copilot?.suggestions?.length
          ) {
            clearTimeout(timeout)
            clearInterval(timer!)
            resolve(copilot!.suggestions)
          }
        }, 500)
      } else {
        return resolve(null)
      }
    })
  })
}

export const activate = async (context: ExtensionContext): Promise<void> => {
  const configuration = workspace.getConfiguration('copilot')
  const isEnable = configuration.get('enable', true)
  const kindLabel = configuration.get('kindLabel', ' ')
  const priority = configuration.get('priority', 1000)
  const limit = configuration.get<number>('limit', 10)
  const preselect = configuration.get<boolean>('enablePreselect', true)
  const shortcut = configuration.get('shortcut', 'Cop')
  const autoUpdateCompletion = configuration.get('autoUpdateCompletion', true)
  const triggerCharacters = configuration.get('triggerCharacters', [
    '.',
    '/',
    '@',
    ' ',
    '*',
  ])

  if (!isEnable) {
    return
  }

  const languageProvider: CompletionItemProvider = {
    async provideCompletionItems(
      _document: TextDocument,
      position: Position,
      _token: CancellationToken,
      context: CompletionContext
    ) {
      const { option } = context
      let completionList: CompletionList | null = null
      const results: CompletionItem[] = []
      const filetype = (await workspace.nvim.call('getbufvar', [
        '',
        '&filetype',
      ])) as string

      if (option) {
        const buffer = workspace.nvim.createBuffer(option.bufnr)
        const input = option.input

        const suggestions = await getSuggestions(
          buffer,
          autoUpdateCompletion,
          input
        )

        if (!suggestions || suggestions.length === 0) {
          return null
        }

        previousIds = suggestions.map((suggestion) => suggestion.uuid)

        const noInput = input.length === 0

        suggestions.forEach(({ range, text }) => {
          const currentPosition: Position = _document.positionAt(
            _document.offsetAt(position)
          )
          // The principle of copilot is to get a whole line, and it will start replacing from the first column of the line where the cursor line is located
          // Get the current offset:
          const offset = currentPosition.character - range.start.character
          // Get all text after the current cursor
          const textAfterCursor = _document.getText({
            start: currentPosition,
            end: { line: currentPosition.line, character: 9999 },
          })
          // Get all text before the current cursor
          const textBeforeCursor = _document.getText({
            start: { line: currentPosition.line, character: 0 },
            end: currentPosition,
          })
          // If it is all spaces, then no replacement is required
          const needReplaceText = textBeforeCursor.replace(/\s/g, '').length > 0
          // Whether it is multiline text
          const isMultiline = text.includes('\n')
          // Do not take the range of copilot as the standard, take the current cursor position as the standard
          const start = noInput ? currentPosition : range.start
          const end: Position = {
            line: range.end.line,
            character: isMultiline
              ? range.end.character + textAfterCursor.length
              : range.end.character,
          }

          const displayText = text.replace(new RegExp(`^ +`), '')

          // Remove the first offset characters
          text =
            needReplaceText && noInput
              ? text.replace(new RegExp(`^.{${offset}}`), '')
              : text

          results.push({
            label: text.replace(/\n/g, '↵'),
            kind: kindLabel as any,
            detail: '',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`${filetype}\n${displayText}\n\`\`\``,
            },
            textEdit: TextEdit.replace(Range.create(start, end), text),
            preselect,
          })
        })

        completionList = {
          items: results.slice(0, limit),
          isIncomplete: true,
        }
      }
      return completionList
    },
  }

  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      'copilot', // name
      shortcut, // shortcut
      null, // selector / filetypes
      languageProvider, // provider
      triggerCharacters, // triggerCharacters
      priority // priority,
      // allCommitCharacters: string[]
    )
  )
}
