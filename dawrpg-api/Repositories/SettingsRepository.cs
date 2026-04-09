using Dapper;
using dawrpg_api.Data;

namespace dawrpg_api.Repositories;

public class SettingsRepository(IDbConnectionFactory db)
{
    public async Task<string?> Get(string key)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT value FROM game_settings WHERE `key` = @key", new { key });
    }

    public async Task Set(string key, string value)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            @"INSERT INTO game_settings (`key`, value)
              VALUES (@key, @value)
              ON DUPLICATE KEY UPDATE value = @value, updated_at = CURRENT_TIMESTAMP",
            new { key, value });
    }
}
