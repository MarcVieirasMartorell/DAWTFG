using Microsoft.AspNetCore.Mvc;
using dawrpg_api.Models;
using dawrpg_api.Repositories;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/players/{accountId:int}")]
public class ProgressController(ProgressRepository progress) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetState(int accountId)
    {
        var state = await progress.GetFullState(accountId);
        if (state is null) return NotFound();
        return Ok(state);
    }

    [HttpPut("progress")]
    public async Task<IActionResult> SaveProgress(int accountId, [FromBody] SaveProgressRequest req)
    {
        if (!await AccountExists(accountId)) return NotFound();
        await progress.SaveFullState(accountId, req);
        return NoContent();
    }

    private async Task<bool> AccountExists(int accountId)
    {
        var state = await progress.GetFullState(accountId);
        return state is not null || await progress.HasProgress(accountId) == false;
    }
}
