export const PURE_PRESET = `# Pi-native adaptation of Starship's Pure preset.
format = "$directory$git_branch$git_state$git_status$activity\\n$model$thinking$context$fill$time"

[directory]
format = "[$path]($style) "
symbol = ""
style = "blue"

[git_branch]
format = "[$branch]($style) "
symbol = ""
style = "bright-black"

[git_state]
format = '([($state( $progress_current/$progress_total))]($style) )'
symbol = ""
style = "bright-black"

[git_status]
format = "[(*$all_status)](218) [$ahead_behind]($style) "
style = "cyan"

[activity]
format = "[$text]($style) "
symbol = ""
style = "yellow"

[model]
format = "[$model]($style) "
symbol = ""
style = "bright-black"

[thinking]
format = "[$level]($style) "
symbol = ""
style = "bright-black"

[context]
format = "[$percentage]($style)"
symbol = ""

[[context.display]]
threshold = 0
style = "bright-black"
hidden = false

[fill]
symbol = " "
style = "none"

[time]
format = "[$time]($style)"
symbol = ""
style = "bright-black"
`;
