using Microsoft.AspNetCore.Mvc;
using dawrpg_api.Repositories;

namespace dawrpg_api.Controllers;

[ApiController]
public class ReferenceController(ReferenceRepository reference) : ControllerBase
{
    // ── Heroes ────────────────────────────────────────────────

    [HttpGet("api/heroes")]
    public async Task<IActionResult> GetHeroes() =>
        Ok(await reference.GetHeroes());

    [HttpGet("api/heroes/{id}")]
    public async Task<IActionResult> GetHero(string id)
    {
        var hero = await reference.GetHero(id);
        return hero is null ? NotFound() : Ok(hero);
    }

    // ── Items ─────────────────────────────────────────────────

    [HttpGet("api/items")]
    public async Task<IActionResult> GetItems() =>
        Ok(await reference.GetItems());

    [HttpGet("api/items/{id}")]
    public async Task<IActionResult> GetItem(string id)
    {
        var item = await reference.GetItem(id);
        return item is null ? NotFound() : Ok(item);
    }

    // ── Enemies ───────────────────────────────────────────────

    [HttpGet("api/enemies")]
    public async Task<IActionResult> GetEnemies() =>
        Ok(await reference.GetEnemies());

    [HttpGet("api/enemies/{id}")]
    public async Task<IActionResult> GetEnemy(string id)
    {
        var enemy = await reference.GetEnemy(id);
        return enemy is null ? NotFound() : Ok(enemy);
    }

    // ── Worlds ────────────────────────────────────────────────

    [HttpGet("api/worlds")]
    public async Task<IActionResult> GetWorlds() =>
        Ok(await reference.GetWorlds());

    [HttpGet("api/worlds/{id}")]
    public async Task<IActionResult> GetWorld(string id)
    {
        var world = await reference.GetWorld(id);
        return world is null ? NotFound() : Ok(world);
    }
}
