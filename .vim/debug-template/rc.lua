vim.cmd([[
function! DebugCoc()
  " :CocCommand coc-copilot
endfunction

set runtimepath^=~/workspace/hexh/coc-copilot
let g:coc_node_args = ["--nolazy", "--inspect=6989"]
]])
