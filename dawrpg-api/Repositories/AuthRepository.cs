using System.Security.Cryptography;
using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

public class AuthRepository(IDbConnectionFactory db)
{
    const string AccountCols =
        "id, username, email, is_admin, email_verified, created_at, last_login";

    public async Task<Account?> GetByUsername(string username)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Account>(
            $"SELECT {AccountCols} FROM accounts WHERE username = @username",
            new { username });
    }

    public async Task<Account?> GetByEmail(string email)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Account>(
            $"SELECT {AccountCols} FROM accounts WHERE email = @email",
            new { email });
    }

    public async Task<bool> EmailExists(string email)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM accounts WHERE email = @email", new { email }) > 0;
    }

    public async Task<string?> GetPasswordHash(string username)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<string>(
            "SELECT password_hash FROM accounts WHERE username = @username",
            new { username });
    }

    public async Task<string?> GetPasswordHashByEmail(string email)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<string>(
            "SELECT password_hash FROM accounts WHERE email = @email",
            new { email });
    }

    public async Task<int> CreateAccount(string username, string? email, string passwordHash)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "INSERT INTO accounts (username, email, password_hash) VALUES (@username, @email, @passwordHash); SELECT LAST_INSERT_ID();",
            new { username, email, passwordHash });
    }

    public async Task UpdateLastLogin(int accountId)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE accounts SET last_login = NOW() WHERE id = @accountId",
            new { accountId });
    }

    public async Task<Account?> GetById(int accountId)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Account>(
            $"SELECT {AccountCols} FROM accounts WHERE id = @accountId",
            new { accountId });
    }

    // ── Email verification ────────────────────────────────────────────────

    public static string GenerateVerifyToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public async Task SetVerifyToken(int accountId, string token)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE accounts SET email_verify_token = @token WHERE id = @accountId",
            new { accountId, token });
    }

    public async Task<Account?> GetByVerifyToken(string token)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Account>(
            $"SELECT {AccountCols} FROM accounts WHERE email_verify_token = @token",
            new { token });
    }

    public async Task MarkEmailVerified(int accountId)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE accounts SET email_verified = 1, email_verify_token = NULL WHERE id = @accountId",
            new { accountId });
    }
}
