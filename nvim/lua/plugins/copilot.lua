return {
  "github/copilot.vim",
  -- Option 1: Load the plugin eagerly so commands are available on startup.
  lazy = false,

  -- Option 2: Or, load it when you first try to use a Copilot command.
  -- cmd = "Copilot",

  -- Option 3: Or, load it after Neovim has started up and is idle.
  -- event = "VeryLazy",

  config = function()
    -- You generally don't need much here for copilot.vim as setup is done via command.
    -- However, if copilot.vim supports vimscript global variables for configuration,
    -- you could set them here. For example (check copilot.vim docs for actual options):
    -- vim.cmd('let g:copilot_no_tab_map = 1')
  end,
}
