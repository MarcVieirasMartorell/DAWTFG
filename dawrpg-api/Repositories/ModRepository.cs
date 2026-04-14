using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

public class ModRepository(IDbConnectionFactory db)
{
    public async Task<List<CommunityMod>> GetPublished(int page, int pageSize)
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<CommunityMod>("""
            SELECT m.*, a.username AS author_name
            FROM community_mods m
            JOIN accounts a ON a.id = m.author_id
            WHERE m.is_published = 1
            ORDER BY m.updated_at DESC
            LIMIT @limit OFFSET @offset
            """, new { limit = pageSize, offset = (page - 1) * pageSize })).ToList();
    }

    public async Task<int> GetPublishedCount()
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM community_mods WHERE is_published = 1");
    }

    public async Task<List<CommunityMod>> GetByAuthor(int authorId)
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<CommunityMod>("""
            SELECT m.*, a.username AS author_name
            FROM community_mods m
            JOIN accounts a ON a.id = m.author_id
            WHERE m.author_id = @authorId AND m.is_published = 1
            ORDER BY m.updated_at DESC
            """, new { authorId })).ToList();
    }

    public async Task<CommunityModWithData?> GetById(int id)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<CommunityModWithData>("""
            SELECT m.*, a.username AS author_name, d.data_json AS data
            FROM community_mods m
            JOIN accounts a ON a.id = m.author_id
            LEFT JOIN mod_data d ON d.mod_id = m.id
            WHERE m.id = @id
            """, new { id });
    }

    public async Task<int> Create(int authorId, CreateModRequest req)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();

        var modId = await conn.ExecuteScalarAsync<int>("""
            INSERT INTO community_mods (author_id, title, description, intro_text, version, is_published)
            VALUES (@authorId, @title, @description, @introText, @version, @isPublished);
            SELECT LAST_INSERT_ID();
            """,
            new { authorId, req.Title, req.Description, req.IntroText, req.Version, req.IsPublished }, tx);

        await conn.ExecuteAsync(
            "INSERT INTO mod_data (mod_id, data_json) VALUES (@modId, @data)",
            new { modId, data = req.Data }, tx);

        tx.Commit();
        return modId;
    }

    public async Task<bool> Update(int id, int requesterId, UpdateModRequest req)
    {
        using var conn = db.Create();

        var authorId = await conn.ExecuteScalarAsync<int?>(
            "SELECT author_id FROM community_mods WHERE id = @id", new { id });

        if (authorId is null || authorId != requesterId) return false;

        conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("""
            UPDATE community_mods SET
              title        = COALESCE(@title, title),
              description  = COALESCE(@description, description),
              intro_text   = COALESCE(@introText, intro_text),
              version      = COALESCE(@version, version),
              is_published = COALESCE(@isPublished, is_published)
            WHERE id = @id
            """,
            new { id, req.Title, req.Description, req.IntroText, req.Version, req.IsPublished }, tx);

        if (req.Data is not null)
        {
            await conn.ExecuteAsync("""
                INSERT INTO mod_data (mod_id, data_json) VALUES (@id, @data)
                ON DUPLICATE KEY UPDATE data_json = @data
                """, new { id, data = req.Data }, tx);
        }

        tx.Commit();
        return true;
    }

    public async Task<bool> Delete(int id, int requesterId)
    {
        using var conn = db.Create();
        var rows = await conn.ExecuteAsync(
            "DELETE FROM community_mods WHERE id = @id AND author_id = @requesterId",
            new { id, requesterId });
        return rows > 0;
    }

    public async Task IncrementPlayCount(int id)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE community_mods SET play_count = play_count + 1 WHERE id = @id",
            new { id });
    }

    public async Task<(double Average, int Count)> Rate(int modId, int accountId, int rating)
    {
        using var conn = db.Create();

        var existing = await conn.ExecuteScalarAsync<int?>(
            "SELECT rating FROM mod_ratings WHERE mod_id = @modId AND account_id = @accountId",
            new { modId, accountId });

        if (existing.HasValue)
        {
            await conn.ExecuteAsync("""
                UPDATE community_mods SET
                  rating_sum   = rating_sum - @oldRating + @rating
                WHERE id = @modId;
                UPDATE mod_ratings SET rating = @rating
                WHERE mod_id = @modId AND account_id = @accountId;
                """, new { modId, oldRating = existing.Value, rating });
        }
        else
        {
            await conn.ExecuteAsync("""
                UPDATE community_mods SET
                  rating_sum   = rating_sum + @rating,
                  rating_count = rating_count + 1
                WHERE id = @modId;
                INSERT INTO mod_ratings (mod_id, account_id, rating) VALUES (@modId, @accountId, @rating);
                """, new { modId, accountId, rating });
        }

        var sum   = await conn.ExecuteScalarAsync<int>("SELECT rating_sum   FROM community_mods WHERE id = @modId", new { modId });
        var count = await conn.ExecuteScalarAsync<int>("SELECT rating_count FROM community_mods WHERE id = @modId", new { modId });

        return (count > 0 ? (double)sum / count : 0, count);
    }
}
