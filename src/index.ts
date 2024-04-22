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
import EventEmitter3 from 'eventemitter3'

const ee = new EventEmitter3<'abort'>()

type Copilot = {
  suggestions: Array<{
    insertText: string
    range: {
      start: { character: number; line: number }
      end: { character: number; line: number }
    }
    command: {
      arguments: any[]
      title: string
      command: string
    }
  }>
}

async function registerRuntimepath(extensionPath: string) {
  const { nvim } = workspace
  const rtp = (await nvim.getOption('runtimepath')) as string
  const paths = rtp.split(',')
  if (!paths.includes(extensionPath)) {
    await nvim.command(
      `execute 'noa set rtp+='.fnameescape('${extensionPath.replace(
        /'/g,
        "''"
      )}')`
    )
  }
}

async function fetchSuggestions(
  buffer: any
): Promise<Copilot['suggestions'] | null> {
  let suggestions: Copilot['suggestions'] | null = null
  if (workspace.isNvim) {
    const copilot: Copilot | null = await buffer.getVar('_copilot')
    if (copilot?.suggestions) {
      suggestions = copilot.suggestions
    }
  }
  if (workspace.isVim) {
    suggestions = await workspace.nvim.call('coc_copilot#get_suggestions')
  }
  return suggestions
}

let timer: NodeJS.Timeout | undefined = undefined
let timeout: NodeJS.Timeout | undefined = undefined

/** Polling to get variables until you get them or 5 seconds later */
function getSuggestions(
  buffer: any,
  autoUpdateCompletion: boolean,
  _input: string,
  completionTimeout: number
): Promise<Copilot['suggestions'] | null> {
  return new Promise((resolve) => {
    function clearTimer() {
      resolve(null)
      clearTimeout(timeout)
      clearInterval(timer)
      ee.removeListener('abort', clearTimer)
    }
    ;(async () => {
      const suggestions = await fetchSuggestions(buffer)
      if (
        Array.isArray(suggestions) &&
        suggestions?.length &&
        !autoUpdateCompletion
      ) {
        resolve(suggestions)
        return
      }
      if (autoUpdateCompletion) {
        timeout = setTimeout(() => {
          clearInterval(timer!)
          resolve([])
        }, completionTimeout)

        timer = setInterval(async () => {
          const suggestions = await fetchSuggestions(buffer)

          if (Array.isArray(suggestions) && suggestions?.length) {
            clearTimeout(timeout)
            clearInterval(timer)
            resolve(suggestions)
          }
        }, 500)

        ee.addListener('abort', clearTimer)
      } else {
        return resolve(null)
      }
    })()
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
    '<',
  ])
  const keepCursorAfterCompletion = configuration.get(
    'keepCursorAfterCompletion',
    false
  )
  const timeout = configuration.get('timeout', 5000)

  if (!isEnable) {
    return
  }

  await registerRuntimepath(context.extensionPath)

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

        ee.emit('abort')
        const suggestions = await getSuggestions(
          buffer,
          autoUpdateCompletion,
          input,
          timeout
        )

        if (!suggestions || suggestions.length === 0) {
          return null
        }

        // previousIds = suggestions.map((suggestion) => suggestion.uuid)

        const noInput = input.length === 0

        suggestions.forEach(({ range, insertText }) => {
          const currentPosition: Position = _document.positionAt(
            _document.offsetAt(position)
          )
          // The principle of copilot is to get a whole line, and it will start replacing from the first column of the line where the cursor line is located
          // Get the current offset:
          const offset = currentPosition.character - range.start.character
          // Get all text before the current cursor
          const textBeforeCursor = _document.getText({
            start: { line: currentPosition.line, character: 0 },
            end: currentPosition,
          })
          // If it is all spaces, then no replacement is required
          const needReplaceText = textBeforeCursor.replace(/\s/g, '').length > 0
          // Do not take the range of copilot as the standard, take the current cursor position as the standard
          const start = noInput ? currentPosition : range.start
          const end: Position = {
            line: range.end.line,
            character: keepCursorAfterCompletion
              ? currentPosition.character
              : range.end.character,
          }

          let displayText = insertText.replace(new RegExp(`^ +`), '')

          // escape "`"
          displayText = displayText.replace(/`/g, '\\`')

          // Remove the first offset characters
          insertText =
            needReplaceText && noInput
              ? insertText.replace(new RegExp(`^.{${offset}}`), '')
              : insertText
          insertText = noInput
            ? insertText.replace(new RegExp(`^ +`), '')
            : insertText

          results.push({
            label: insertText.replace(/\n/g, '↵'),
            kind: kindLabel as any,
            detail: '',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`${filetype}\n${displayText}\n\`\`\``,
            },
            textEdit: TextEdit.replace(Range.create(start, end), insertText),
            preselect,
          })
        })

        completionList = {
          items: results.slice(0, limit),
          isIncomplete: !!autoUpdateCompletion,
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
