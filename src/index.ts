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

function isPositionNotSame(
  position: Position,
  range: { start: Position; end: Position }
): boolean {
  return (
    position.line !== range.end.line ||
    position.character !== range.end.character
  )
}

/** 轮询获取变量，直到获取到为止或者5秒后为止 */
function getSuggestions(buffer: any): Promise<Copilot['suggestions'] | null> {
  return new Promise((resolve) => {
    buffer.getVar('_copilot').then((copilot: Copilot | null) => {
      if (Array.isArray(copilot?.suggestions)) {
        resolve(copilot!.suggestions)
      } else {
        let timer: NodeJS.Timeout | null = null
        const timeout = setTimeout(() => {
          clearInterval(timer!)
          resolve([])
        }, 5000)

        timer = setInterval(async () => {
          const copilot = (await buffer.getVar('_copilot')) as Copilot | null

          if (Array.isArray(copilot?.suggestions)) {
            clearTimeout(timeout)
            clearInterval(timer!)
            resolve(copilot!.suggestions)
          }
        }, 50)
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

        const suggestions = await getSuggestions(buffer)

        if (!suggestions) {
          return null
        }

        const input = option.input

        suggestions.forEach(({ range, text }) => {
          const start: Position = {
            line: range.start.line,
            character: range.start.character,
          }
          const end: Position =
            // copilot return wrong end range when input is empty sometimes
            // in this case, coc wouldn't update completion list correctly
            input.length === 0 && isPositionNotSame(position, range)
              ? position
              : {
                  line: range.end.line,
                  character: range.end.character,
                }

          results.push({
            label: text,
            kind: kindLabel as any,
            detail: '',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`${filetype}\n${text}\n\`\`\``,
            },
            textEdit: TextEdit.replace(Range.create(start, end), text),
            preselect,
          })
        })

        completionList = {
          items: results.slice(0, limit),
          isIncomplete: input.length <= 3,
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
      [], // triggerCharacters
      priority // priority,
      // allCommitCharacters: string[]
    )
  )
}
