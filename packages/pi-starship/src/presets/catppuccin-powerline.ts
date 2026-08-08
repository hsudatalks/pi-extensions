export const CATPPUCCIN_POWERLINE_PRESET = `# Pi-native adaptation of Starship's Catppuccin Powerline preset.
format = "[](red)$brand$model[](bg:peach fg:red)$directory[](bg:yellow fg:peach)$git_branch$git_status[](fg:yellow bg:green)$thinking$activity[](fg:green bg:sapphire)$context[](fg:sapphire bg:lavender)$time[](fg:lavender)"
palette = "catppuccin_mocha"

[brand]
format = "[ $symbol ]($style)"
symbol = ""
style = "fg:crust bg:red bold"

[model]
format = "[$model ]($style)"
symbol = ""
style = "fg:crust bg:red bold"

[directory]
format = "[ $path ]($style)"
symbol = ""
style = "fg:crust bg:peach bold"
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
format = "[ $symbol $branch ]($style)"
symbol = ""
style = "fg:crust bg:yellow bold"

[git_status]
format = "[$all_status$ahead_behind ]($style)"
style = "fg:crust bg:yellow bold"

[thinking]
format = "[ $symbol $level ]($style)"
symbol = "󰔟"
style = "fg:crust bg:green bold"

[activity]
format = "[ $text ]($style)"
symbol = "󰑮"
style = "fg:crust bg:green bold"

[context]
format = "[ $symbol $percentage ](fg:crust bg:sapphire bold)"
symbol = "󰍛"

[[context.display]]
threshold = 0
style = "sapphire"
hidden = false

[time]
format = "[  $time ]($style)"
symbol = ""
style = "fg:crust bg:lavender bold"

[palettes.catppuccin_mocha]
red = "#f38ba8"
peach = "#fab387"
yellow = "#f9e2af"
green = "#a6e3a1"
sapphire = "#74c7ec"
lavender = "#b4befe"
crust = "#11111b"

[palettes.catppuccin_frappe]
red = "#e78284"
peach = "#ef9f76"
yellow = "#e5c890"
green = "#a6d189"
sapphire = "#85c1dc"
lavender = "#babbf1"
crust = "#232634"

[palettes.catppuccin_latte]
red = "#d20f39"
peach = "#fe640b"
yellow = "#df8e1d"
green = "#40a02b"
sapphire = "#209fb5"
lavender = "#7287fd"
crust = "#dce0e8"

[palettes.catppuccin_macchiato]
red = "#ed8796"
peach = "#f5a97f"
yellow = "#eed49f"
green = "#a6da95"
sapphire = "#7dc4e4"
lavender = "#b7bdf8"
crust = "#181926"
`;
