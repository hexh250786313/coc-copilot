# @hexuhua/coc-copilot

![20230514_161921](https://github.com/hexh250786313/coc-copilot/assets/26080416/b3b2405c-7589-4030-95e8-ae88e9855df7)

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
- `copilot.priority`: (Integer, default: `1000`) The priority of Copilot completion items compared to other completion sources.
- `copilot.limit`: (Integer, default: `10`) The maximum number of completion items fetched from Copilot.
- `copilot.enablePreselect`: (Boolean, default: `true`) Enable or disable preselecting Copilot completion items.
- `copilot.kindLabel`: (String, default: `" "`) The label used for Copilot completions in the completion menu.
- `copilot.shortcut`: (String, default: `"Cop"`) The shortcut used for Copilot completions in the completion menu.
- `copilot.autoUpdateCompletion`: (Boolean, default: `false`) Whether to update the completion panel automatically when the copilot result is updated.

## Known Issues

- The plugin cannot refresh completion suggestions when deleting characters after an existing completion: https://github.com/neoclide/coc.nvim/issues/1616#issuecomment-1105012094

## License

MIT License.
