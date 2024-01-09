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

/** 是否存在新的 uuid */
function hasNewIds(suggestions: Copilot['suggestions']) {
  const ids = suggestions.map((suggestion) => suggestion.uuid)
  return ids.some((id) => !previousIds.includes(id))
}

/** 结果是否匹配 input */
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
        hasNewIds(copilot.suggestions) && // 如果存在新的 uuid，那么就更新
        isMatch(input, copilot.suggestions)
      ) {
        resolve(copilot!.suggestions)
        return
      }
      // 如果不存在新的 uuid，那么轮询查询
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
            // isMatch(input, copilot.suggestions)
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
          // copilot 的原理是获取一整行，它会从光标行所在行的第一列开始替换
          // 获得当前偏移量：
          const offset = currentPosition.character - range.start.character
          // 获取当前光标后的所有文本
          const textAfterCursor = _document.getText({
            start: currentPosition,
            end: { line: currentPosition.line, character: 9999 },
          })
          // 获得当前光标前的文本
          const textBeforeCursor = _document.getText({
            start: { line: currentPosition.line, character: 0 },
            end: currentPosition,
          })
          // 如果全是空格，那么就不需要替换
          const needReplaceText = textBeforeCursor.replace(/\s/g, '').length > 0
          // 是否多行文本
          const isMultiline = text.includes('\n')
          // 不以 copilot 的 range 为准，以当前光标位置为准
          const start = noInput ? currentPosition : range.start
          const end: Position = {
            line: range.end.line,
            character: isMultiline
              ? range.end.character + textAfterCursor.length
              : range.end.character,
          }

          const displayText = text.replace(new RegExp(`^ +`), '')

          // 移除开头连续的 offset 个字符
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

        console.log(results)

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
