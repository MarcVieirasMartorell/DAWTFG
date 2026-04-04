using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

public class ProgressRepository(IDbConnectionFactory db)
{
    public async Task<FullPlayerState?> GetFullState(int accountId)
    {
        using var conn = db.Create();

        var account = await conn.QuerySingleOrDefaultAsync<Account>(
            "SELECT id, username, created_at, last_login, is_admin FROM accounts WHERE id = @accountId",
            new { accountId });

        if (account is null) return null;

        var progress = await conn.QuerySingleOrDefaultAsync<PlayerProgress>(
            "SELECT * FROM player_progress WHERE account_id = @accountId",
            new { accountId });

        if (progress is null) return null;

        var partySlots = (await conn.QueryAsync<PlayerPartySlot>(
            "SELECT slot, hero_id FROM player_party WHERE account_id = @accountId ORDER BY slot",
            new { accountId })).ToList();

        var unlockedHeroes = (await conn.QueryAsync<string>(
            "SELECT hero_id FROM player_unlocked_heroes WHERE account_id = @accountId",
            new { accountId })).ToList();

        var worldsUnlocked = (await conn.QueryAsync<string>(
            "SELECT world_id FROM player_worlds_unlocked WHERE account_id = @accountId",
            new { accountId })).ToList();

        var clears = (await conn.QueryAsync<PlayerClear>(
            "SELECT world_id, node_id FROM player_clears WHERE account_id = @accountId",
            new { accountId })).ToList();

        var inventory = (await conn.QueryAsync<PlayerInventoryEntry>(
            "SELECT item_id, quantity FROM player_inventory WHERE account_id = @accountId AND quantity > 0",
            new { accountId })).ToList();

        var party = new string[3];
        foreach (var slot in partySlots)
            if (slot.Slot < 3) party[slot.Slot] = slot.HeroId;

        return new FullPlayerState
        {
            Account = account,
            Progress = progress,
            Party = party.Where(h => h is not null).ToList(),
            UnlockedHeroes = unlockedHeroes,
            WorldsUnlocked = worldsUnlocked,
            Clears = clears.Select(c => $"{c.WorldId}:{c.NodeId}").ToList(),
            Inventory = inventory.ToDictionary(i => i.ItemId, i => i.Quantity)
        };
    }

    public async Task SaveFullState(int accountId, SaveProgressRequest req)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("""
            INSERT INTO player_progress (account_id, player_name, current_world_id, wallet, has_save, playtime_sec)
            VALUES (@accountId, @playerName, @currentWorldId, @wallet, @hasSave, @playtimeSec)
            ON DUPLICATE KEY UPDATE
              player_name      = VALUES(player_name),
              current_world_id = VALUES(current_world_id),
              wallet           = VALUES(wallet),
              has_save         = VALUES(has_save),
              playtime_sec     = VALUES(playtime_sec)
            """,
            new { accountId, req.PlayerName, req.CurrentWorldId, req.Wallet, req.HasSave, req.PlaytimeSec },
            tx);

        await conn.ExecuteAsync("DELETE FROM player_party WHERE account_id = @accountId", new { accountId }, tx);
        for (int i = 0; i < req.Party.Count; i++)
        {
            await conn.ExecuteAsync(
                "INSERT INTO player_party (account_id, slot, hero_id) VALUES (@accountId, @slot, @heroId)",
                new { accountId, slot = i, heroId = req.Party[i] }, tx);
        }

        foreach (var heroId in req.UnlockedHeroes)
        {
            await conn.ExecuteAsync("""
                INSERT IGNORE INTO player_unlocked_heroes (account_id, hero_id)
                VALUES (@accountId, @heroId)
                """, new { accountId, heroId }, tx);
        }

        foreach (var worldId in req.WorldsUnlocked)
        {
            await conn.ExecuteAsync("""
                INSERT IGNORE INTO player_worlds_unlocked (account_id, world_id)
                VALUES (@accountId, @worldId)
                """, new { accountId, worldId }, tx);
        }

        foreach (var clear in req.Clears)
        {
            var parts = clear.Split(':');
            if (parts.Length != 2) continue;
            await conn.ExecuteAsync("""
                INSERT IGNORE INTO player_clears (account_id, world_id, node_id)
                VALUES (@accountId, @worldId, @nodeId)
                """, new { accountId, worldId = parts[0], nodeId = parts[1] }, tx);
        }

        await conn.ExecuteAsync("DELETE FROM player_inventory WHERE account_id = @accountId", new { accountId }, tx);
        foreach (var (itemId, quantity) in req.Inventory)
        {
            if (quantity <= 0) continue;
            await conn.ExecuteAsync(
                "INSERT INTO player_inventory (account_id, item_id, quantity) VALUES (@accountId, @itemId, @quantity)",
                new { accountId, itemId, quantity }, tx);
        }

        tx.Commit();
    }

    public async Task<bool> HasProgress(int accountId)
    {
        using var conn = db.Create();
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM player_progress WHERE account_id = @accountId",
            new { accountId });
        return count > 0;
    }

    public async Task UpdateWallet(int accountId, int newBalance)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE player_progress SET wallet = @newBalance WHERE account_id = @accountId",
            new { accountId, newBalance });
    }

    public async Task UpsertInventoryItem(int accountId, string itemId, int quantity)
    {
        using var conn = db.Create();
        if (quantity <= 0)
        {
            await conn.ExecuteAsync(
                "DELETE FROM player_inventory WHERE account_id = @accountId AND item_id = @itemId",
                new { accountId, itemId });
        }
        else
        {
            await conn.ExecuteAsync("""
                INSERT INTO player_inventory (account_id, item_id, quantity)
                VALUES (@accountId, @itemId, @quantity)
                ON DUPLICATE KEY UPDATE quantity = @quantity
                """, new { accountId, itemId, quantity });
        }
    }

    public async Task<int> GetItemQuantity(int accountId, string itemId)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COALESCE(quantity, 0) FROM player_inventory WHERE account_id = @accountId AND item_id = @itemId",
            new { accountId, itemId });
    }

    public async Task<int> GetWallet(int accountId)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT wallet FROM player_progress WHERE account_id = @accountId",
            new { accountId });
    }
}
