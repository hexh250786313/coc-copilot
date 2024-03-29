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
- `copilot.timeout`: (Integer, default: `5000`) coc-copilot uses polling to get results from `copilot.vim`. If there is no result after `<timeout>` ms, then the polling ends. The value cannot be less than `500` because the interval of polling is `500ms`, and the default value is 5000ms, which is the same as the default timeout of coc completion.
- `copilot.priority`: (Integer, default: `1000`) The priority of Copilot completion items compared to other completion sources.
- `copilot.limit`: (Integer, default: `10`) The maximum number of completion items fetched from Copilot.
- `copilot.enablePreselect`: (Boolean, default: `true`) Enable or disable preselecting Copilot completion items.
- `copilot.kindLabel`: (String, default: `" "`) The label used for Copilot completions in the completion menu.
- `copilot.shortcut`: (String, default: `"Cop"`) The shortcut used for Copilot completions in the completion menu.
- `copilot.autoUpdateCompletion`: (Boolean, default: `true`) Whether to update the completion panel automatically when the copilot result is updated.
- `copilot.triggerCharacters`: (Array, default: `[".", "/", "@", " ", "*", "<"]`) The characters that trigger copilot completions. If not set, some characters will not trigger copilot completions (such as `.@/`).
- `copilot.keepCursorAfterCompletion`: (Boolean, default: `false`) Whether to keep the content after the cursor. If it is true, the content after the cursor will be kept. If it is false, the content will be replaced according to the content of copilot. The default is false.

## License

MIT License.

## Q & A

- **Q**: Sometimes the completion will cause nvim to freeze.

- **A**: Possible related issue: https://github.com/neoclide/coc.nvim/issues/4877. This problem may occur in css or other language servers with automatic `triggerSuggest` functionality. If you are using coc-css, then the problem is caused by `css/less/scss.completion.triggerPropertyValueCompletion`, which is not a problem with coc-copilot. Any coc extension that asynchronously fetches completion results will cause this problem, and it needs to be fixed by the official coc. The temporary solution is to turn off `css/less/scss.completion.triggerPropertyValueCompletion` or other language servers with automatic `triggerSuggest` related functions.
