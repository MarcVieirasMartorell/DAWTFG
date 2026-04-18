using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

public class SocialRepository(IDbConnectionFactory db)
{
    const string AccountCols =
        "a.id, a.username, a.email, a.is_admin, a.email_verified, a.created_at, a.last_login";

    public async Task Follow(int followerId, int targetId)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "INSERT IGNORE INTO account_follows (follower_id, following_id) VALUES (@followerId, @targetId)",
            new { followerId, targetId });
    }

    public async Task Unfollow(int followerId, int targetId)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "DELETE FROM account_follows WHERE follower_id = @followerId AND following_id = @targetId",
            new { followerId, targetId });
    }

    public async Task<bool> IsFollowing(int followerId, int targetId)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM account_follows WHERE follower_id = @followerId AND following_id = @targetId",
            new { followerId, targetId }) > 0;
    }

    public async Task<IEnumerable<Account>> GetFollowing(int accountId)
    {
        using var conn = db.Create();
        return await conn.QueryAsync<Account>(
            $"""
            SELECT {AccountCols}
            FROM account_follows f
            JOIN accounts a ON a.id = f.following_id
            WHERE f.follower_id = @accountId
            ORDER BY f.created_at DESC
            """,
            new { accountId });
    }

    public async Task<IEnumerable<Account>> GetFollowers(int accountId)
    {
        using var conn = db.Create();
        return await conn.QueryAsync<Account>(
            $"""
            SELECT {AccountCols}
            FROM account_follows f
            JOIN accounts a ON a.id = f.follower_id
            WHERE f.following_id = @accountId
            ORDER BY f.created_at DESC
            """,
            new { accountId });
    }

    public async Task<IEnumerable<int>> GetFollowingIds(int accountId)
    {
        using var conn = db.Create();
        return await conn.QueryAsync<int>(
            "SELECT following_id FROM account_follows WHERE follower_id = @accountId",
            new { accountId });
    }
}
