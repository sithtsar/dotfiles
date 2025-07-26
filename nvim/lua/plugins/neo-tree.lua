-- ~/.config/nvim/lua/plugins/neo-tree.lua
return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x", -- Or your preferred branch
    lazy = false, -- Load on startup to reliably hijack netrw for `nvim .`
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons", -- For icons
      "MunifTanjim/nui.nvim",
    },
    opts = function(_, opts)
      -- Ensure the filesystem table and filtered_items table exist for deep extending
      opts.filesystem = opts.filesystem or {}
      opts.filesystem.filtered_items = opts.filesystem.filtered_items or {}

      -- Configure items to be filtered (hidden or never shown)
      opts.filesystem.filtered_items = vim.tbl_deep_extend("force", opts.filesystem.filtered_items, {
        visible = true, -- If true, "hidden" items are dimmed. If false, they are not shown unless toggled.
        hide_dotfiles = false, -- Set to false to show most dotfiles.
        hide_gitignored = true, -- Keep this true if you want gitignored files hidden by default.

        -- *** Correctly placed never_show to hide .git and .DS_Store ***
        never_show = {
          ".git", -- This will hide the .git directory [1][2]
          ".DS_Store", -- Common macOS file to hide
          -- Add other patterns you never want to see
        },
      })

      -- Ensure hijack_netrw_behavior is set if you want Neo-tree to replace netrw
      opts.filesystem.hijack_netrw_behavior = "open_current"
      opts.filesystem.follow_current_file = { enabled = true }
      opts.filesystem.group_empty_dirs = true
      opts.close_if_last_window = true

      -- *** Configure Git status colors and symbols ***
      opts.default_component_configs = opts.default_component_configs or {}
      opts.default_component_configs.name = vim.tbl_deep_extend("force", opts.default_component_configs.name or {}, {
        trailing_slash = false,
        use_git_status_colors = true, -- <<< THIS ENABLES GIT STATUS COLORING ON FILE NAMES [2][3]
        highlight = "NeoTreeFileName",
      })

      opts.default_component_configs.git_status =
        vim.tbl_deep_extend("force", opts.default_component_configs.git_status or {}, {
          symbols = {
            -- These symbols appear next to the filename.
            -- Colors are applied to the filename itself if use_git_status_colors = true.
            -- You can use Nerd Font icons here if you have them installed and configured.
            added = "✚", -- Green (NeoTreeGitAdded)
            modified = "●", -- Blue (NeoTreeGitModified)
            deleted = "✖", -- Red (NeoTreeGitDeleted)
            renamed = "➜", -- Purple (NeoTreeGitRenamed)
            untracked = "?", -- Cyan (NeoTreeGitUntracked)
            ignored = "◌", -- Grey/Comment color (NeoTreeGitIgnored)
            unstaged = "!", -- Orange/Yellow (NeoTreeGitUnstaged)
            staged = "✔", -- Green (NeoTreeGitStaged)
            conflict = "✘", -- Red (NeoTreeGitConflict)
          },
          align = "right", -- Or "left"
        })

      -- Your existing indent configuration
      opts.default_component_configs.indent =
        vim.tbl_deep_extend("force", opts.default_component_configs.indent or {}, {
          indent_size = 2,
          with_expanders = true,
          expander_collapsed = "", -- Ensure your font supports these glyphs
          expander_expanded = "",
          expander_highlight = "NeoTreeExpander",
        })

      return opts
    end,
    -- Define top-level keymaps using LazyVim's 'keys' table
    keys = {
      {
        "<leader>e",
        function()
          require("neo-tree.command").execute({
            source = "filesystem",
            toggle = true,
            dir = require("lazyvim.util").root(),
          })
        end,
        desc = "Explorer (Neo-tree Root)",
      },
      {
        "<leader>fe",
        function()
          require("neo-tree.command").execute({
            source = "filesystem",
            toggle = true,
            dir = require("lazyvim.util").root(),
          })
        end,
        desc = "Explorer NeoTree (Root Dir)",
      },
      {
        "<leader>fE", -- Note: Uppercase E
        function()
          require("neo-tree.command").execute({ source = "filesystem", toggle = true, dir = vim.uv.cwd() })
        end,
        desc = "Explorer NeoTree (cwd)",
      },
    },
    -- Your optional init function for robust netrw hijacking can remain here if needed
  },
}
