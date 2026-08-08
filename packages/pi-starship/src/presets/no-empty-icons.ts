export const NO_EMPTY_ICONS_PRESET = `# Pi-native adaptation of Starship's No Empty Icons preset.
# Each label lives inside the same conditional group as its value.
format = "$model$thinking$directory$git_branch$git_status$activity$context$time"

[model]
format = "([model $model]($style) )"
symbol = ""
style = "bold blue"

[thinking]
format = "([thinking $level]($style) )"
symbol = ""
style = "bold purple"

[directory]
format = "([in $path]($style) )"
symbol = ""
style = "cyan bold"

[git_branch]
format = "([on $branch]($style) )"
symbol = ""
style = "bold purple"

[git_status]
format = "([$all_status$ahead_behind]($style) )"
style = "red bold"

[activity]
format = "([while $text]($style) )"
symbol = ""
style = "bold yellow"

[context]
format = "([using $percentage context]($style) )"
symbol = ""

[[context.display]]
threshold = 0
style = "bold green"
hidden = false

[time]
format = "([at $time]($style))"
symbol = ""
style = "bold yellow"
`;
