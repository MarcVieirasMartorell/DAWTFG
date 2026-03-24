using dawrpg_api.Models;
using dawrpg_api.Repositories;
using dawrpg_api.Services;
using Microsoft.AspNetCore.Mvc;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AuthRepository auth,
    ProgressRepository progress,
    IEmailService email,
    IConfiguration config) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var existing = await auth.GetByUsername(req.Username);
        if (existing is not null)
            return Conflict(new { error = "Username already taken." });

        var emailTrimmed = req.Email?.Trim().ToLowerInvariant();
        if (emailTrimmed is not null)
        {
            var emailTaken = await auth.EmailExists(emailTrimmed);
            if (emailTaken)
                return Conflict(new { error = "Email already registered." });
        }

        var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        var accountId = await auth.CreateAccount(req.Username, emailTrimmed, hash);

        var account = await auth.GetById(accountId);

        // Fire-and-forget verification email — don't block or fail registration
        if (emailTrimmed is not null)
            _ = SendVerificationEmailAsync(accountId, req.Username, emailTrimmed);

        return Created($"/api/auth/{accountId}", new { account });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        Account? account;
        string? hash;

        if (req.Username.Contains('@'))
        {
            hash = await auth.GetPasswordHashByEmail(req.Username);
            if (hash is null || !BCrypt.Net.BCrypt.Verify(req.Password, hash))
                return Unauthorized(new { error = "Invalid email or password." });
            account = await auth.GetByEmail(req.Username);
        }
        else
        {
            hash = await auth.GetPasswordHash(req.Username);
            if (hash is null || !BCrypt.Net.BCrypt.Verify(req.Password, hash))
                return Unauthorized(new { error = "Invalid username or password." });
            account = await auth.GetByUsername(req.Username);
        }

        await auth.UpdateLastLogin(account!.Id);
        var hasSave = await progress.HasProgress(account.Id);
        return Ok(new { account, hasSave });
    }

    // ── Email verification ────────────────────────────────────────────────

    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return Content(VerifyHtml("Invalid Link", "No token provided.", false), "text/html");

        var account = await auth.GetByVerifyToken(token);
        if (account is null)
            return Content(VerifyHtml("Link Invalid", "This verification link is invalid or has already been used.", false), "text/html");

        await auth.MarkEmailVerified(account.Id);

        var frontendUrl = config["App:FrontendUrl"] ?? "http://localhost:5173";
        return Content(VerifyHtml("Email Verified", $"Your email has been verified, {account.Username}.", true, frontendUrl), "text/html");
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromQuery] int accountId)
    {
        var account = await auth.GetById(accountId);
        if (account is null) return NotFound(new { error = "Account not found." });
        if (account.Email is null) return BadRequest(new { error = "No email address on this account." });
        if (account.EmailVerified) return BadRequest(new { error = "Email already verified." });

        _ = SendVerificationEmailAsync(accountId, account.Username, account.Email);
        return Ok(new { message = "Verification email sent." });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private async Task SendVerificationEmailAsync(int accountId, string username, string emailAddress)
    {
        try
        {
            var token = AuthRepository.GenerateVerifyToken();
            await auth.SetVerifyToken(accountId, token);

            var apiUrl = config["App:ApiUrl"] ?? "http://localhost:5094";
            var verifyUrl = $"{apiUrl}/api/auth/verify-email?token={token}";
            await email.SendVerificationEmailAsync(emailAddress, username, verifyUrl);
        }
        catch (Exception ex)
        {
            // Swallow — email failure should not break registration/resend response
            Console.Error.WriteLine($"[EmailService] Failed for account {accountId}: {ex.Message}");
        }
    }

    private static string VerifyHtml(string title, string message, bool success, string? returnUrl = null) => $"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>{title} — DAW</title></head>
        <body style="margin:0;padding:0;background:#000;font-family:'Courier New',monospace;">
        <div style="max-width:480px;margin:80px auto;background:#06150c;border:2px solid {(success ? "#143a25" : "#3a1414")};padding:36px;text-align:center;">
          <div style="font-size:28px;color:#d4f4a3;letter-spacing:.14em;margin-bottom:16px;">D A W</div>
          <div style="font-size:{(success ? "22" : "18")}px;color:{(success ? "#d4f4a3" : "#ff6ec7")};letter-spacing:.1em;margin-bottom:20px;">
            {(success ? "▶ " : "! ")}{title.ToUpperInvariant()}
          </div>
          <p style="color:#a5b985;font-size:15px;line-height:1.6;margin:0 0 28px;">{message}</p>
          {(returnUrl is not null ? $"""<a href="{returnUrl}" style="border:2px solid #d4f4a3;color:#d4f4a3;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.1em;padding:10px 24px;text-decoration:none;">RETURN TO GAME</a>""" : "")}
          <p style="color:#5a8a3a;font-size:11px;margin-top:28px;">— SECTORWARE INDUSTRIES</p>
        </div>
        </body>
        </html>
        """;
}
