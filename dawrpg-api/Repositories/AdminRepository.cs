using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

public class AdminRepository(IDbConnectionFactory db)
{
    const string AccountCols = "id, username, email, is_admin, email_verified, created_at, last_login";

    public async Task<bool> IsAdmin(int accountId)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT is_admin FROM accounts WHERE id = @accountId", new { accountId }) == 1;
    }

    public async Task<IEnumerable<Account>> GetAllUsers()
    {
        using var conn = db.Create();
        return await conn.QueryAsync<Account>(
            $"SELECT {AccountCols} FROM accounts ORDER BY id");
    }

    public async Task<FullPlayerState?> GetFullUserState(int accountId)
    {
        using var conn = db.Create();

        var account = await conn.QuerySingleOrDefaultAsync<Account>(
            $"SELECT {AccountCols} FROM accounts WHERE id = @accountId", new { accountId });
        if (account is null) return null;

        var progress = await conn.QuerySingleOrDefaultAsync<PlayerProgress>(
            "SELECT account_id, player_name, current_world_id, wallet, has_save, playtime_sec, updated_at FROM player_progress WHERE account_id = @accountId",
            new { accountId }) ?? new PlayerProgress { AccountId = accountId };

        var partyRows = await conn.QueryAsync<PlayerPartySlot>(
            "SELECT account_id, slot, hero_id FROM player_party WHERE account_id = @accountId ORDER BY slot",
            new { accountId });

        var unlockedHeroes = (await conn.QueryAsync<string>(
            "SELECT hero_id FROM player_unlocked_heroes WHERE account_id = @accountId",
            new { accountId })).ToList();

        var worldsUnlocked = (await conn.QueryAsync<string>(
            "SELECT world_id FROM player_worlds_unlocked WHERE account_id = @accountId",
            new { accountId })).ToList();

        var clearRows = await conn.QueryAsync<PlayerClear>(
            "SELECT account_id, world_id, node_id, cleared_at FROM player_clears WHERE account_id = @accountId",
            new { accountId });

        var inventoryRows = await conn.QueryAsync<PlayerInventoryEntry>(
            "SELECT account_id, item_id, quantity FROM player_inventory WHERE account_id = @accountId",
            new { accountId });

        return new FullPlayerState
        {
            Account = account,
            Progress = progress,
            Party = partyRows.OrderBy(r => r.Slot).Select(r => r.HeroId).ToList(),
            UnlockedHeroes = unlockedHeroes,
            WorldsUnlocked = worldsUnlocked,
            Clears = clearRows.Select(r => $"{r.WorldId}:{r.NodeId}").ToList(),
            Inventory = inventoryRows.ToDictionary(r => r.ItemId, r => r.Quantity),
        };
    }

    public async Task SetWallet(int accountId, int wallet)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE player_progress SET wallet = @wallet WHERE account_id = @accountId",
            new { accountId, wallet });
    }

    public async Task SetAdminFlag(int accountId, bool isAdmin)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE accounts SET is_admin = @val WHERE id = @accountId",
            new { accountId, val = isAdmin ? 1 : 0 });
    }
}
