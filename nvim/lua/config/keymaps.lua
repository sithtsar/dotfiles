-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- Ensure <leader>e toggles Neo-tree
vim.keymap.set("n", "<leader>e", function()
  -- Check if neo-tree is already open in the current tab
  local neo_tree_open = false
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    if vim.bo[vim.api.nvim_win_get_buf(win)].filetype == "neo-tree" then
      neo_tree_open = true
      break
    end
  end

  if neo_tree_open then
    require("neo-tree.command").execute({ action = "close" })
  else
    require("neo-tree.command").execute({ toggle = true }) -- Or just 'open' if you prefer
  end
end, { desc = "Explorer (Neo-tree)" })

-- If you prefer a simpler toggle without the specific open/close logic shown above:
-- vim.keymap.set("n", "<leader>e", "<cmd>Neotree toggle<cr>", { desc = "Explorer (Neo-tree)" })
