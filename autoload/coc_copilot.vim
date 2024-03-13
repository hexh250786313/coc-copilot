" get copilot suggestions, for vim
function! coc_copilot#get_suggestions() abort
    if exists('b:_copilot') && has_key(b:_copilot, 'suggestions')
        return b:_copilot['suggestions']
    else
        return []
    endif
endfunction
