export const PLAIN_TEXT_SYMBOLS_PRESET = `# Pi-native adaptation of Starship's Plain Text Symbols preset.
format = "$brand$model$thinking$directory$git_branch$git_status$activity$context$time"

[brand]
format = "[$symbol]($style) "
symbol = "pi"
style = "bold white"

[model]
format = "[$symbol $model]($style) "
symbol = "model"
style = "bold blue"

[thinking]
format = "[$symbol $level]($style) "
symbol = "thinking"
style = "bold purple"

[directory]
format = "[$symbol $path]($style) "
symbol = "dir"
style = "cyan bold"

[git_branch]
format = "[$symbol $branch]($style) "
symbol = "git"
style = "bold purple"
truncation_symbol = "..."

[git_status]
format = "[$all_status( $ahead_behind)]($style) "
style = "red bold"

[activity]
format = "[$text]($style) "
symbol = "active"
style = "bold yellow"

[context]
format = "[$symbol $percentage]($style) "
symbol = "context"

[[context.display]]
threshold = 0
style = "bold green"
hidden = false

[time]
format = "[$symbol $time]($style)"
symbol = "time"
style = "bold yellow"
`;
