export const BRACKETED_SEGMENTS_PRESET = String.raw`# Font-safe bracketed segments inspired by Starship.
format = "$brand$model$thinking$directory$git_branch$git_status$activity$context$time"

[brand]
format = '[\[$symbol\]]($style) '
style = "bold white"

[model]
format = '[\[$symbol $model\]]($style) '
symbol = "AI"
style = "bold blue"

[thinking]
format = '[\[$symbol $level\]]($style) '
symbol = "think"
style = "bold purple"

[directory]
format = '[\[$symbol $path\]]($style) '
symbol = "dir"
style = "cyan bold"

[git_branch]
format = '[\[$symbol $branch\]]($style) '
symbol = "git"
style = "bold purple"

[git_status]
format = '[\[$all_status( $ahead_behind)\]]($style) '
style = "red bold"

[activity]
format = '[\[$text\]]($style) '
symbol = "run"
style = "bold yellow"

[context]
format = '[\[$symbol $percentage\]]($style) '
symbol = "ctx"

[time]
format = '[\[$time\]]($style)'
symbol = ""
style = "bold yellow"
`;
