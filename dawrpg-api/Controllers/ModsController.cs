using Microsoft.AspNetCore.Mvc;
using dawrpg_api.Models;
using dawrpg_api.Repositories;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/mods")]
public class ModsController(ModRepository mods) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        var items = await mods.GetPublished(page, pageSize);
        var total = await mods.GetPublishedCount();
        return Ok(new { items, total, page, pageSize });
    }

    [HttpGet("by-author/{authorId:int}")]
    public async Task<IActionResult> ByAuthor(int authorId) =>
        Ok(await mods.GetByAuthor(authorId));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var mod = await mods.GetById(id);
        return mod is null ? NotFound() : Ok(mod);
    }

    [HttpPost("{id:int}/play")]
    public async Task<IActionResult> RecordPlay(int id)
    {
        var mod = await mods.GetById(id);
        if (mod is null) return NotFound();
        await mods.IncrementPlayCount(id);
        return NoContent();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromQuery] int authorId, [FromBody] CreateModRequest req)
    {
        var modId = await mods.Create(authorId, req);
        return Created($"/api/mods/{modId}", new { id = modId });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromQuery] int requesterId, [FromBody] UpdateModRequest req)
    {
        var ok = await mods.Update(id, requesterId, req);
        return ok ? NoContent() : Forbid();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int requesterId)
    {
        var ok = await mods.Delete(id, requesterId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{id:int}/rate")]
    public async Task<IActionResult> Rate(int id, [FromQuery] int accountId, [FromBody] RateModRequest req)
    {
        var mod = await mods.GetById(id);
        if (mod is null) return NotFound();

        var (average, count) = await mods.Rate(id, accountId, req.Rating);
        return Ok(new { average, count });
    }
}
