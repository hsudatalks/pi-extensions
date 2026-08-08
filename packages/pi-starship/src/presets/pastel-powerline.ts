export const PASTEL_POWERLINE_PRESET = `# Pi-native adaptation of Starship's Pastel Powerline preset.
format = "[](#9A348E)$brand$model[](bg:#DA627D fg:#9A348E)$directory[](fg:#DA627D bg:#FCA17D)$git_branch$git_status[](fg:#FCA17D bg:#86BBD8)$thinking$activity[](fg:#86BBD8 bg:#06969A)$context[](fg:#06969A bg:#33658A)$time[](fg:#33658A)"

[brand]
format = "[ $symbol ]($style)"
symbol = ""
style = "fg:#ffffff bg:#9A348E bold"

[model]
format = "[$model ]($style)"
symbol = ""
style = "fg:#ffffff bg:#9A348E bold"

[directory]
format = "[ $path ]($style)"
symbol = ""
style = "fg:#ffffff bg:#DA627D bold"
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
format = "[ $symbol $branch ]($style)"
symbol = ""
style = "fg:#1f1f1f bg:#FCA17D bold"

[git_status]
format = "[$all_status$ahead_behind ]($style)"
style = "fg:#1f1f1f bg:#FCA17D bold"

[thinking]
format = "[ $symbol $level ]($style)"
symbol = "󰔟"
style = "fg:#1f1f1f bg:#86BBD8 bold"

[activity]
format = "[ $text ]($style)"
symbol = "󰑮"
style = "fg:#1f1f1f bg:#86BBD8 bold"

[context]
format = "[ $symbol $percentage ](fg:#ffffff bg:#06969A bold)"
symbol = "󰍛"

[[context.display]]
threshold = 0
style = "#06969A"
hidden = false

[time]
format = "[ ♥ $time ]($style)"
symbol = ""
style = "fg:#ffffff bg:#33658A bold"
`;
