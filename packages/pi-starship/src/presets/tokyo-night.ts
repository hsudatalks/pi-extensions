export const TOKYO_NIGHT_PRESET = `# Pi-native adaptation of Starship's Tokyo Night preset.
format = "[░▒▓](#a3aed2)$brand$model[](bg:#769ff0 fg:#a3aed2)$directory[](fg:#769ff0 bg:#394260)$git_branch$git_status[](fg:#394260 bg:#212736)$thinking$activity[](fg:#212736 bg:#1d2230)$context$time[](fg:#1d2230)"

[brand]
format = "[ $symbol ]($style)"
symbol = ""
style = "fg:#090c0c bg:#a3aed2 bold"

[model]
format = "[$model ]($style)"
symbol = ""
style = "fg:#090c0c bg:#a3aed2 bold"

[directory]
format = "[ $path ]($style)"
symbol = ""
style = "fg:#e3e5e5 bg:#769ff0 bold"
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
format = "[ $symbol $branch ]($style)"
symbol = ""
style = "fg:#769ff0 bg:#394260 bold"

[git_status]
format = "[$all_status$ahead_behind ]($style)"
style = "fg:#769ff0 bg:#394260 bold"

[thinking]
format = "[ $symbol $level ]($style)"
symbol = "󰔟"
style = "fg:#769ff0 bg:#212736 bold"

[activity]
format = "[ $text ]($style)"
symbol = "󰑮"
style = "fg:#769ff0 bg:#212736 bold"

[context]
format = "[ $symbol $percentage ](fg:#a0a9cb bg:#1d2230 bold)"
symbol = "󰍛"

[[context.display]]
threshold = 0
style = "#1d2230"
hidden = false

[time]
format = "[ $time ]($style)"
symbol = ""
style = "fg:#a0a9cb bg:#1d2230 bold"
`;
