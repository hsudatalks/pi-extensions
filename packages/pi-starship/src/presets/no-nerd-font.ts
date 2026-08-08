export const NO_NERD_FONT_PRESET = `# Pi-native adaptation of Starship's No Nerd Font preset.
format = "$brand$model$thinking$directory$git_branch$git_status$activity$context$time"

[brand]
format = "[$symbol]($style) "
symbol = "✦"
style = "bold white"

[model]
format = "[$symbol $model]($style) "
symbol = "◆"
style = "bold blue"

[thinking]
format = "[$symbol $level]($style) "
symbol = "◇"
style = "bold purple"

[directory]
format = "[$symbol $path]($style) "
symbol = "⌂"
style = "cyan bold"

[git_branch]
format = "[$symbol $branch]($style) "
symbol = "⎇"
style = "bold purple"

[git_status]
format = "[$all_status( $ahead_behind)]($style) "
style = "red bold"

[activity]
format = "[$text]($style) "
symbol = "●"
style = "bold yellow"

[context]
format = "[$symbol $percentage]($style) "
symbol = "◌"

[[context.display]]
threshold = 0
style = "bold green"
hidden = false

[time]
format = "[$symbol $time]($style)"
symbol = "◴"
style = "bold yellow"
`;
