using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace dawrpg_api.Services;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string username, string verifyUrl);
}

public class GmailEmailService(IConfiguration config, ILogger<GmailEmailService> logger) : IEmailService
{
    public async Task SendVerificationEmailAsync(string toEmail, string username, string verifyUrl)
    {
        var smtp = config.GetSection("Smtp");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(smtp["FromName"], smtp["FromAddress"]));
        message.To.Add(new MailboxAddress(username, toEmail));
        message.Subject = "[DAW] Verify your MIPMIP Company email";
        message.Body = new TextPart("html") { Text = BuildHtml(username, verifyUrl) };

        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(smtp["Host"], int.Parse(smtp["Port"]!), SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(smtp["Username"], smtp["Password"]);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send verification email to {Email}", toEmail);
            throw;
        }
    }

    static string BuildHtml(string username, string verifyUrl) => $"""
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#080808;font-family:'Courier New',monospace;">
        <div style="max-width:560px;margin:40px auto;background:#111;border:2px solid #2e2e2e;padding:36px;">
          <div style="font-size:32px;color:#e8e4d4;letter-spacing:.14em;margin-bottom:4px;">D A W</div>
          <div style="font-size:12px;color:#888;letter-spacing:.28em;margin-bottom:28px;">DEFENDING · A · WORKSTATION</div>
          <hr style="border:none;border-top:1px solid #2e2e2e;margin-bottom:24px;" />
          <p style="color:#aaa;margin:0 0 16px;">
            Hey <b style="color:#e8e4d4;">{username}</b>,
          </p>
          <p style="color:#aaa;margin:0 0 28px;line-height:1.6;">
            Click the button below to verify your email address and link it to your MIPMIP Company account.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="{verifyUrl}"
               style="display:inline-block;border:2px solid #e8e4d4;color:#e8e4d4;
                      font-family:'Courier New',monospace;font-size:13px;letter-spacing:.12em;
                      padding:12px 28px;text-decoration:none;">
              ▶ VERIFY EMAIL
            </a>
          </div>
          <p style="color:#555;font-size:12px;margin:0;">
            If you did not register on MIPMIP Company, ignore this message.
          </p>
          <p style="color:#555;font-size:12px;margin:8px 0 0;">
            — MIPMIP COMPANY · 2026
          </p>
        </div>
        </body>
        </html>
        """;
}
