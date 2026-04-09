using Microsoft.AspNetCore.Mvc;
using dawrpg_api.Models;
using dawrpg_api.Repositories;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/players/{accountId:int}/shop")]
public class ShopController(ProgressRepository progress, ReferenceRepository reference) : ControllerBase
{
    [HttpPost("buy")]
    public async Task<IActionResult> Buy(int accountId, [FromBody] BuyItemRequest req)
    {
        var item = await reference.GetItem(req.ItemId);
        if (item is null) return BadRequest(new { error = "Unknown item." });

        var wallet = await progress.GetWallet(accountId);
        var total = item.Price * req.Quantity;

        if (wallet < total)
            return BadRequest(new { error = "Insufficient funds.", wallet, cost = total });

        var current = await progress.GetItemQuantity(accountId, req.ItemId);
        await progress.UpsertInventoryItem(accountId, req.ItemId, current + req.Quantity);
        await progress.UpdateWallet(accountId, wallet - total);

        return Ok(new { wallet = wallet - total, item = req.ItemId, quantity = current + req.Quantity });
    }

    [HttpPost("sell")]
    public async Task<IActionResult> Sell(int accountId, [FromBody] SellItemRequest req)
    {
        var item = await reference.GetItem(req.ItemId);
        if (item is null) return BadRequest(new { error = "Unknown item." });

        var current = await progress.GetItemQuantity(accountId, req.ItemId);
        if (current < req.Quantity)
            return BadRequest(new { error = "Not enough items to sell.", have = current });

        var wallet = await progress.GetWallet(accountId);
        var gained = item.SellPrice * req.Quantity;

        await progress.UpsertInventoryItem(accountId, req.ItemId, current - req.Quantity);
        await progress.UpdateWallet(accountId, wallet + gained);

        return Ok(new { wallet = wallet + gained, item = req.ItemId, quantity = current - req.Quantity });
    }
}
