# @hexuhua/coc-copilot

https://github.com/hexh250786313/coc-copilot/assets/26080416/5f8fa5cb-3c42-4d2d-9d72-4cc6c4a5c99c

**@hexuhua/coc-copilot** is a [coc.nvim](https://github.com/neoclide/coc.nvim) extension that integrates with GitHub's [copilot.vim](https://github.com/github/copilot.vim) to provide AI-powered code completions for your projects.

**_Note_**: There is another plugin called coc-copilot: https://github.com/yuki-yano/coc-copilot, but that repository is no longer maintained by the author. This is a different plugin. Make sure to install it using `@hexuhua/coc-copilot` and not `coc-copilot`.

## Features

- Fetches code completions from [copilot.vim](https://github.com/github/copilot.vim).
- Integrates with [coc.nvim](https://github.com/neoclide/coc.nvim)'s completion system.
- Customizable source priority, label, and limit.

## Installation

Make sure you have [coc.nvim](https://github.com/neoclide/coc.nvim) and [copilot.vim](https://github.com/github/copilot.vim) installed and configured.

Then, install `@hexuhua/coc-copilot` using:

```
:CocInstall @hexuhua/coc-copilot
```

## Configuration

Here are the available configuration options for coc-copilot:

- `copilot.enable`: (Boolean, default: `true`) Enable or disable the coc-copilot extension.
- `copilot.timeout`: (Integer, default: `5000`) coc-copilot uses polling to get results from `copilot.vim`. If there is no result after `<timeout>` ms, then the polling ends. The value cannot be less than `500` because the interval of polling is `500ms`, and the default value is 5000ms, which is the same as the default timeout of coc completion.
- `copilot.priority`: (Integer, default: `1000`) The priority of Copilot completion items compared to other completion sources.
- `copilot.limit`: (Integer, default: `10`) The maximum number of completion items fetched from Copilot.
- `copilot.enablePreselect`: (Boolean, default: `true`) Enable or disable preselecting Copilot completion items.
- `copilot.kindLabel`: (String, default: `" "`) The label used for Copilot completions in the completion menu.
- `copilot.shortcut`: (String, default: `"Cop"`) The shortcut used for Copilot completions in the completion menu.
- `copilot.triggerCharacters`: (Array, default: `[".", "/", "@", "*", "<"]`) The characters that trigger copilot completions. If not set, some characters will not trigger copilot completions (such as `.@/`).
- `copilot.showRemainingText`: (Boolean, default: `true`) Whether to show the remaining text after the completion item in the completion menu. For some languages such as markdown, there is often a lot of text in one line, which can be helpful.
- ~~`copilot.autoUpdateCompletion`: (Boolean, default: `true`) Whether to update the completion panel automatically when the copilot result is updated.~~ **Deprecated: Now coc-copilot no longer updates the completion panel automatically because asynchronous completion makes coc completion panel update slowly.** See: [Asynchronous Completion for isIncomplete Items in coc.nvim #5028](https://github.com/neoclide/coc.nvim/issues/5028)

## License

MIT License.

## Q & A

- **Q**: What `copilot.showRemainingText` does?

- **A**: It shows the remaining text after the completion item in the completion menu. For some languages such as markdown, there is often a lot of text in one line, which can be helpful.

  ![2024-06-11_19-49](https://github.com/hexh250786313/coc-copilot/assets/26080416/628a50d9-eef0-4bfe-939d-e7d94d2d7d56)
