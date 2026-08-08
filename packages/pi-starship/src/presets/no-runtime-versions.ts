export const NO_RUNTIME_VERSIONS_PRESET = `# Pi-native adaptation of Starship's No Runtime Versions preset.
# Model and thinking modules retain presence symbols while hiding version-like details.
format = "$brand$model$thinking$directory$git_branch$git_status$activity$context$time"

[brand]
format = "[$symbol]($style) "
symbol = "π"
style = "bold white"

[model]
format = "[$symbol]($style) "
symbol = "AI"
style = "bold blue"

[thinking]
format = "[$symbol]($style) "
symbol = "think"
style = "bold purple"

[directory]
format = "[$path]($style) "
symbol = ""
style = "cyan bold"

[git_branch]
format = "[$symbol$branch]($style) "
symbol = "git:"
style = "bold purple"

[git_status]
format = "[$all_status( $ahead_behind)]($style) "
style = "red bold"

[activity]
format = "[$symbol]($style) "
symbol = "run"
style = "bold yellow"

[context]
format = "[$percentage]($style) "
symbol = ""

[[context.display]]
threshold = 0
style = "bold green"
hidden = false

[time]
format = "[$time]($style)"
symbol = ""
style = "bold yellow"
`;
