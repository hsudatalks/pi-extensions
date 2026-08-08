export const GRUVBOX_RAINBOW_PRESET = `# Pi-native adaptation of Starship's Gruvbox Rainbow preset.
format = "[](color_orange)$brand$model[](bg:color_yellow fg:color_orange)$directory[](fg:color_yellow bg:color_aqua)$git_branch$git_status[](fg:color_aqua bg:color_blue)$thinking$activity[](fg:color_blue bg:color_bg3)$context[](fg:color_bg3 bg:color_bg1)$time[](fg:color_bg1)"
palette = "gruvbox_dark"

[palettes.gruvbox_dark]
color_fg0 = "#fbf1c7"
color_bg1 = "#3c3836"
color_bg3 = "#665c54"
color_blue = "#458588"
color_aqua = "#689d6a"
color_green = "#98971a"
color_orange = "#d65d0e"
color_purple = "#b16286"
color_red = "#cc241d"
color_yellow = "#d79921"

[brand]
format = "[ $symbol ]($style)"
symbol = ""
style = "fg:color_fg0 bg:color_orange bold"

[model]
format = "[$model ]($style)"
symbol = ""
style = "fg:color_fg0 bg:color_orange bold"

[directory]
format = "[ $path ]($style)"
symbol = ""
style = "fg:color_fg0 bg:color_yellow bold"
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
format = "[ $symbol $branch ]($style)"
symbol = ""
style = "fg:color_fg0 bg:color_aqua bold"

[git_status]
format = "[$all_status$ahead_behind ]($style)"
style = "fg:color_fg0 bg:color_aqua bold"

[thinking]
format = "[ $symbol $level ]($style)"
symbol = "󰔟"
style = "fg:color_fg0 bg:color_blue bold"

[activity]
format = "[ $text ]($style)"
symbol = "󰑮"
style = "fg:color_fg0 bg:color_blue bold"

[context]
format = "[ $symbol $percentage ](fg:color_fg0 bg:color_bg3 bold)"
symbol = "󰍛"

[[context.display]]
threshold = 0
style = "color_bg3"
hidden = false

[time]
format = "[  $time ]($style)"
symbol = ""
style = "fg:color_fg0 bg:color_bg1 bold"
`;
