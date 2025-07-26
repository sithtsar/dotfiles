-- ~/.config/nvim/lua/plugins/telescope.lua
return {
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.8", -- Or your preferred stable tag
    lazy = false, -- Load Telescope immediately
    dependencies = {
      "nvim-lua/plenary.nvim",
      -- Optional: For better icons, if you have a Nerd Font installed
      -- "nvim-tree/nvim-web-devicons",
    },
    opts = function(_, opts)
      local LUtils = require("lazyvim.util") -- Get LazyVim utilities for root finding

      -- Default ripgrep arguments for grepping commands (live_grep, grep_string)
      -- Ensures hidden files are searched, but .git directory is ignored.
      opts.defaults = vim.tbl_deep_extend("force", opts.defaults or {}, {
        vimgrep_arguments = {
          "rg",
          "--color=never",
          "--no-heading",
          "--with-filename",
          "--line-number",
          "--column",
          "--smart-case",
          "--hidden", -- <<< Include hidden files in grep [4]
          "--glob",
          "!**/.git/*", -- <<< Exclude .git directory from grep [4]
        },
        -- Set default cwd for all pickers if not overridden by the picker itself
        cwd_maker = function()
          return LUtils.root()
        end,
      })

      -- Configure specific pickers
      opts.pickers = vim.tbl_deep_extend("force", opts.pickers or {}, {
        find_files = {
          hidden = true, -- <<< Show hidden files in the find_files picker [1][6]
          -- Command to find files, including hidden ones, excluding .git, respects .gitignore
          find_command = { "rg", "--files", "--hidden", "--glob", "!**/.git/*" }, -- [1][4]
          -- Ensure find_files also defaults to project root
          cwd = LUtils.root(),
        },
        live_grep = {
          -- Defaults to vimgrep_arguments and cwd_maker from opts.defaults
          -- You can add specific overrides here if needed
          cwd = LUtils.root(), -- Explicitly set for clarity
        },
        buffers = {
          -- Example: Sort buffers by last used
          sort_mru = true,
          ignore_current_buffer = true,
        },
        -- Configure other pickers as needed (e.g., git_files, oldfiles)
        git_files = {
          hidden = true, -- Show hidden files that are tracked by git
          show_untracked = true, -- Show untracked files as well
          cwd = LUtils.root(),
        },
      })
      return opts
    end,
    keys = {
      -- Keymap for finding files (typically <leader>ff or <leader><leader> in LazyVim)
      -- This version explicitly uses project root and shows hidden files.
      {
        "<leader>ff", -- Or your preferred keymap, e.g., <leader><leader>
        function()
          require("telescope.builtin").find_files({
            hidden = true,
            find_command = { "rg", "--files", "--hidden", "--glob", "!**/.git/*" },
            cwd = require("lazyvim.util").root(), -- Explicitly use project root
          })
        end,
        desc = "Find Files (Project Root, hidden)",
      },
      -- Keymap for live grep (typically <leader>fg, <leader>/ or <leader>fw in LazyVim)
      {
        "<leader>fg", -- Or your preferred keymap
        function()
          require("telescope.builtin").live_grep({
            cwd = require("lazyvim.util").root(), -- Use project root
            -- additional_args can be used if needed, but vimgrep_arguments should cover it
          })
        end,
        desc = "Live Grep (Project Root)",
      },
      -- Add other Telescope keymaps you use, ensuring they use project root if applicable
      { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Find Buffers" },
      { "<leader>fh", "<cmd>Telescope help_tags<cr>", desc = "Help Tags" },
      { "<leader>fo", "<cmd>Telescope oldfiles<cr>", desc = "Recent Files" },
    },
  },
}
