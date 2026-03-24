using System.ComponentModel.DataAnnotations;

namespace dawrpg_api.Models;

public class RegisterRequest
{
    [Required, StringLength(16, MinimumLength = 3)]
    public string Username { get; set; } = "";

    [EmailAddress, StringLength(255)]
    public string? Email { get; set; }

    [Required, StringLength(72, MinimumLength = 6)]
    public string Password { get; set; } = "";
}

public class AdminUpdateRequest
{
    public int? Wallet { get; set; }
    public bool? IsAdmin { get; set; }
    public bool? Seed { get; set; }
}

public class LoginRequest
{
    [Required] public string Username { get; set; } = "";
    [Required] public string Password { get; set; } = "";
}

public class SaveProgressRequest
{
    [Required] public string PlayerName { get; set; } = "";
    [Required] public string CurrentWorldId { get; set; } = "w1";
    public int Wallet { get; set; }
    public bool HasSave { get; set; }
    public int PlaytimeSec { get; set; }
    public List<string> Party { get; set; } = [];
    public List<string> UnlockedHeroes { get; set; } = [];
    public List<string> WorldsUnlocked { get; set; } = [];
    public List<string> Clears { get; set; } = [];
    public Dictionary<string, int> Inventory { get; set; } = [];
}

public class BuyItemRequest
{
    [Required] public string ItemId { get; set; } = "";
    public int Quantity { get; set; } = 1;
}

public class SellItemRequest
{
    [Required] public string ItemId { get; set; } = "";
    public int Quantity { get; set; } = 1;
}

public class CreateModRequest
{
    [Required, StringLength(128)] public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? IntroText { get; set; }
    public string Version { get; set; } = "1.0";
    public bool IsPublished { get; set; }
    [Required] public string Data { get; set; } = "";
}

public class UpdateModRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? IntroText { get; set; }
    public string? Version { get; set; }
    public bool? IsPublished { get; set; }
    public string? Data { get; set; }
}

public class RateModRequest
{
    [Range(1, 5)] public int Rating { get; set; }
}
