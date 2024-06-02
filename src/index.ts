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

//
// Determine the suggestion content returned by suggestion and the content before the current cursor
// Divided into three levels:
//
// Match: suggestion starts with currentLine
// Partial match: the suggestion content starts with the content before the current cursor (after removing the leading
// spaces)
// Mismatch: other situations
//
const getMatchLevel = (suggestion: string, currentLine: string) => {
  if (suggestion.startsWith(currentLine)) {
    return 'match'
  }
  if (suggestion.startsWith(currentLine.replace(/^ +/, ''))) {
    return 'partial'
  }
  return 'mismatch'
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
  const timeout = configuration.get('timeout', 5000)
  const showRemainingText = configuration.get<boolean>(
    'showRemainingText',
    true
  )

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

        suggestions.forEach(({ range, insertText }) => {
          const currentPosition: Position = _document.positionAt(
            _document.offsetAt(position)
          )
          //
          // current column of the cursor
          //
          const currentCursorCol = currentPosition.character
          //
          // The position where the input pairing starts
          //
          // For example:
          //
          // The original line content is:
          //
          // abc
          //
          // Then after inserting "xyz", it becomes:
          //
          // abcxyz
          //    ~~~      -> "xyz" is the newly inserted text, when "x" is entered, the completion panel will be refreshed
          //
          // Then completionStartsAt is the position where "x" is located, which is the place where the input text
          // triggers the completion panel refresh
          //
          const completionStartsAt = currentCursorCol - input.length
          //
          // text before the cursor
          //
          const textBeforeCursor = _document.getText({
            start: { line: currentPosition.line, character: 0 },
            end: currentPosition,
          })
          const noInput = input.length === 0 && textBeforeCursor.trim() === ''
          let matchLevel = getMatchLevel(insertText, textBeforeCursor)

          //
          // This situation is:
          //
          //     |
          // ~~~~                    -> No input, but spaces are entered in front, and the completion is triggered directly
          //
          // At this time, the matchLevel should be partial
          //
          if (noInput) matchLevel = 'partial'

          if (matchLevel === 'mismatch') return
          //
          // Text offset
          // When the pairing level is partial, it means the following situation occurs
          //
          //       |(trigger completion at this position)
          // ~~~~~~                                -> all the spaces in front are entered, and then the completion is triggered
          //
          // At this time, the suggestion will automatically filter out all spaces, for example, "hello, world" is
          // returned instead of "      hello, world"
          // Therefore, the offset represents the number of these spaces
          //
          let offset = 0
          switch (matchLevel) {
            default:
            case 'match': {
              offset = 0
              break
            }
            case 'partial': {
              offset = currentCursorCol - range.start.character
              break
            }
          }
          //
          // When the pairing level is partial, use the column where the current cursor is located as the starting position
          // of the replacement text
          // When the pairing level is match, use the default position returned by copilot
          // This is to solve the following situation:
          //
          //     |(trigger completion at this position)
          // ~~~~                               -> all the spaces in front are entered, and then the completion is triggered
          //
          // At this time, if you use the default position returned by copilot, it will be replaced from the first
          // column of the line, for example:
          //
          // hello, world
          // |
          // The spaces entered by the user are deleted
          //
          // But in principle, the column where the current cursor is located should be used as the starting position
          // of the replacement, for example:
          //
          //     hello, world
          // ~~~~                               -> The spaces entered by the user should be retained
          //
          const start = matchLevel === 'partial' ? currentPosition : range.start
          const end: Position = {
            line: range.end.line,
            character: range.end.character,
          }

          //
          // First remove all spaces and line breaks at the beginning
          // Then remove the first col characters of the first line of insertText, if the first line does not have so
          // many characters, do not process
          //
          const displayText = insertText
            .split('\n')
            .map((line, index) => {
              if (index === 0) {
                return line.slice(completionStartsAt - offset)
              }
              return line
            })
            .join('\n')
            .replace(/(\n( ){2,})/g, '↵ ')
            .replace(/\n/g, '↵')
            .replace(/^ +/, '')

          //
          // Calculate the number of spaces at the beginning of each line of insertText
          // Then remove the number of spaces of the line with the least spaces
          // Then assign it to documentText
          //
          const minimumSpaces = insertText
            .split('\n')
            .map((line) => {
              return line.match(/^( +)/)?.[0].length || 0
            })
            .reduce((a, b) => Math.min(a, b), Infinity)
          let documentText = insertText
            .split('\n')
            .map((line) => {
              return line.replace(new RegExp(`^ {${minimumSpaces}}`), '')
            })
            .join('\n')

          //
          // Remove all characters matched from the beginning of the first column of documentText to
          // currentCursorCol
          //
          let firstLine = insertText.split('\n')[0]
          if (showRemainingText) {
            firstLine = firstLine
              .replace(new RegExp(`^.{${currentCursorCol - offset}}`), '')
              .replace(/^ +/, '')
          } else {
            firstLine = ''
          }
          firstLine = firstLine
            ? `\`\`\`txt\n${firstLine}\n\`\`\`\n***\n\``
            : ''
          documentText =
            firstLine + `\`\`\`${filetype}\n${documentText}\n\`\`\``

          insertText =
            matchLevel === 'partial'
              ? insertText.replace(new RegExp(`^ +`), '')
              : insertText

          results.push({
            label: displayText,
            kind: kindLabel as any,
            detail: '',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `${documentText}`,
            },
            textEdit: TextEdit.replace(Range.create(start, end), insertText),
            preselect,
          })
        })

        if (!results.length) {
          return null
        }

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
