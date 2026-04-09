using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;
using dawrpg_api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController(IDbConnectionFactory db, AdminRepository adminRepo, SettingsRepository settingsRepo) : ControllerBase
{
    private static readonly string[] AllHeroes =
        ["CURSOR.EXE", "GUARD.SYS", "PURGE.BAT", "PING.DLL", "ROOT.SH", "INDEX.LOG"];

    private static readonly string[] AllWorlds = ["w1", "w2", "w3"];

    private static readonly (string World, string Node)[] AllNodes =
    [
        ("w1","start"),("w1","n1"),("w1","n2"),("w1","n3"),("w1","n4"),
        ("w1","n5"),("w1","save2"),("w1","shop"),("w1","mid"),("w1","boss"),
        ("w2","start"),("w2","n1"),("w2","n2"),("w2","n3"),("w2","n4"),
        ("w2","n5"),("w2","save2"),("w2","shop"),("w2","mid"),("w2","boss"),
        ("w3","start"),("w3","n1"),("w3","n2"),("w3","n3"),("w3","n4"),
        ("w3","n5"),("w3","save2"),("w3","shop"),("w3","mid"),("w3","boss"),
    ];

    private static readonly Dictionary<string, int> FullInventory = new()
    {
        ["patch"] = 99, ["buffer"] = 99, ["restore"] = 99, ["rootkit"] = 99,
        ["firewall"] = 99, ["defrag"] = 99, ["exploit"] = 99,
        ["antidote"] = 99, ["jpegofkey"] = 99,
    };

    // ── Authorization helper ──────────────────────────────────────────────
    private async Task<bool> RequireAdmin(int requesterId) =>
        await adminRepo.IsAdmin(requesterId);

    // ── Admin status check ────────────────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> GetAdminStatus([FromQuery] int id)
    {
        var isAdmin = await adminRepo.IsAdmin(id);
        return Ok(new { isAdmin });
    }

    // ── List all users ────────────────────────────────────────────────────
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] int requesterId)
    {
        if (!await RequireAdmin(requesterId))
            return Forbid();

        var users = await adminRepo.GetAllUsers();
        return Ok(users);
    }

    // ── Get one user's full state ─────────────────────────────────────────
    [HttpGet("users/{id:int}")]
    public async Task<IActionResult> GetUser(int id, [FromQuery] int requesterId)
    {
        if (!await RequireAdmin(requesterId))
            return Forbid();

        var state = await adminRepo.GetFullUserState(id);
        if (state is null) return NotFound(new { error = "User not found." });
        return Ok(state);
    }

    // ── Update user (wallet, admin flag) ──────────────────────────────────
    [HttpPatch("users/{id:int}")]
    public async Task<IActionResult> UpdateUser(
        int id,
        [FromQuery] int requesterId,
        [FromBody] AdminUpdateRequest req)
    {
        if (!await RequireAdmin(requesterId))
            return Forbid();

        using var conn = db.Create();
        conn.Open();
        var exists = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM accounts WHERE id = @id", new { id });
        if (!exists.HasValue) return NotFound(new { error = "User not found." });

        if (req.Wallet.HasValue)
            await adminRepo.SetWallet(id, req.Wallet.Value);

        if (req.IsAdmin.HasValue)
            await adminRepo.SetAdminFlag(id, req.IsAdmin.Value);

        if (req.Seed == true)
            await SeedAccount(id, conn);

        var state = await adminRepo.GetFullUserState(id);
        return Ok(state);
    }

    // ── Dev seed endpoint ─────────────────────────────────────────────────
    [HttpPost("seed")]
    public async Task<IActionResult> Seed(
        [FromQuery] int requesterId,
        [FromQuery] string? username = null,
        [FromQuery] string password = "Admin1234")
    {
        if (!await RequireAdmin(requesterId))
            return Forbid();

        var targetUser = (username ?? "ADMIN").Trim().ToUpperInvariant();
        if (targetUser.Length < 3)
            return BadRequest(new { error = "Username must be at least 3 characters." });

        if (password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        using var conn = db.Create();
        conn.Open();

        var existing = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM accounts WHERE username = @targetUser", new { targetUser });

        int adminId;
        if (existing.HasValue)
        {
            adminId = existing.Value;
        }
        else
        {
            var hash = BCrypt.Net.BCrypt.HashPassword(password);
            adminId = await conn.ExecuteScalarAsync<int>(
                "INSERT INTO accounts (username, password_hash) VALUES (@targetUser, @hash); SELECT LAST_INSERT_ID();",
                new { targetUser, hash });
        }

        await SeedAccount(adminId, conn);

        return Ok(new
        {
            message = $"{targetUser} account seeded.",
            username = targetUser,
            password,
            accountId = adminId,
        });
    }

    // ── Sprite overrides ─────────────────────────────────────────────────
    // Public GET — every player fetches this at boot to apply custom sprites.
    [HttpGet("sprites")]
    public async Task<IActionResult> GetSprites()
    {
        var json = await settingsRepo.Get("sprite_overrides");
        if (string.IsNullOrEmpty(json)) return Ok(new { heroes = new { }, enemies = new { } });
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return Content(json, "application/json");
        }
        catch
        {
            return Ok(new { heroes = new { }, enemies = new { } });
        }
    }

    // Admin PUT — replaces the full overrides blob.
    [HttpPut("sprites")]
    public async Task<IActionResult> UpdateSprites(
        [FromQuery] int requesterId,
        [FromBody] System.Text.Json.JsonElement body)
    {
        if (!await RequireAdmin(requesterId)) return Forbid();
        await settingsRepo.Set("sprite_overrides", body.GetRawText());
        return NoContent();
    }

    // ── Shared seed logic ─────────────────────────────────────────────────
    private static async Task SeedAccount(int accountId, System.Data.IDbConnection conn)
    {
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("""
            INSERT INTO player_progress
              (account_id, player_name, current_world_id, wallet, has_save, playtime_sec)
            VALUES (@accountId, 'SEEDED', 'w1', 99999, 1, 0)
            ON DUPLICATE KEY UPDATE
              wallet = 99999, has_save = 1, current_world_id = 'w1'
            """, new { accountId }, tx);

        await conn.ExecuteAsync("DELETE FROM player_party WHERE account_id = @accountId", new { accountId }, tx);
        foreach (var (heroId, slot) in AllHeroes.Take(3).Select((h, i) => (h, i)))
            await conn.ExecuteAsync(
                "INSERT INTO player_party (account_id, slot, hero_id) VALUES (@accountId, @slot, @heroId)",
                new { accountId, slot, heroId }, tx);

        foreach (var heroId in AllHeroes)
            await conn.ExecuteAsync(
                "INSERT IGNORE INTO player_unlocked_heroes (account_id, hero_id) VALUES (@accountId, @heroId)",
                new { accountId, heroId }, tx);

        foreach (var worldId in AllWorlds)
            await conn.ExecuteAsync(
                "INSERT IGNORE INTO player_worlds_unlocked (account_id, world_id) VALUES (@accountId, @worldId)",
                new { accountId, worldId }, tx);

        foreach (var (worldId, nodeId) in AllNodes)
            await conn.ExecuteAsync(
                "INSERT IGNORE INTO player_clears (account_id, world_id, node_id) VALUES (@accountId, @worldId, @nodeId)",
                new { accountId, worldId, nodeId }, tx);

        await conn.ExecuteAsync("DELETE FROM player_inventory WHERE account_id = @accountId", new { accountId }, tx);
        foreach (var (itemId, quantity) in FullInventory)
            await conn.ExecuteAsync(
                "INSERT INTO player_inventory (account_id, item_id, quantity) VALUES (@accountId, @itemId, @quantity)",
                new { accountId, itemId, quantity }, tx);

        tx.Commit();
    }
}
